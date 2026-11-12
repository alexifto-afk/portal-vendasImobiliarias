import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  makePdf,
  registerReportingRoutes,
  reportPeriod,
} from "../src/reporting.js";
test("período inclui o último dia em Brasília e valida datas", () => {
  const p = reportPeriod({ from: "2026-11-01", to: "2026-11-12" });
  assert.equal(p.gte.toISOString(), "2026-11-01T03:00:00.000Z");
  assert.equal(p.lt.toISOString(), "2026-11-13T03:00:00.000Z");
  for (const [from, to] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-11-12", "2026-11-01"],
    ["2020-01-01", "2026-01-01"],
  ])
    assert.throws(() => reportPeriod({ from, to }));
});
test("PDF suporta conteúdo multipágina e acentos", async () => {
  const result = await makePdf(
    "Relatório de anúncios",
    Array.from({ length: 100 }, (_, i) => ({
      title: `Anúncio ${i}`,
      lines: ["Crédito — R$ 29,90", "Confirmação de pagamento"],
    })),
  );
  assert.equal(result.subarray(0, 5).toString(), "%PDF-");
  assert.match(result.toString("latin1"), /\/Count [2-9]\d*/);
});
test("recibos exigem titularidade e confirmação; relatórios exigem administrador e rejeitam truncamento", async () => {
  const now = new Date();
  const listing = {
    id: "ad",
    ownerId: "owner",
    owner: { name: "Maria" },
    title: "Casa",
    paidAt: now,
    adPrice: 2990,
    plan: "BASIC",
    durationDays: 30,
  };
  const payout = {
    id: "pix",
    partner: { userId: "partner" },
    status: "PAID",
    recipientName: "José",
    amount: 500,
    resolvedAt: now,
  };
  let reportQuery;
  const db = {
    listing: {
      findUnique: async () => listing,
      findMany: async (args) => {
        reportQuery = args;
        return [listing];
      },
    },
    partnerPayout: {
      findUnique: async () => payout,
      findMany: async () => [payout],
    },
    affiliateEntry: {
      findMany: async () => [
        {
          id: "entry",
          partner: { user: { name: "José" } },
          listingId: "ad",
          kind: "REVERSAL",
          amount: -500,
          createdAt: now,
          availableAt: now,
        },
      ],
    },
  };
  const app = express();
  const auth = (q, r, next) => {
    const id = q.get("Authorization");
    if (!id) return r.sendStatus(401);
    q.user = { id, role: id === "admin" ? "ADMIN" : "OWNER" };
    next();
  };
  registerReportingRoutes(app, {
    db,
    auth,
    admin: (q, r, next) =>
      q.user.role === "ADMIN" ? next() : r.sendStatus(403),
    wrap: (fn) => (q, r, next) => Promise.resolve(fn(q, r)).catch(next),
  });
  app.use((error, q, r, next) =>
    r.status(error.status || 400).json({ error: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const call = (path, user) =>
    fetch(`http://127.0.0.1:${server.address().port}` + path, {
      headers: user ? { Authorization: user } : {},
    });
  try {
    assert.equal((await call("/api/receipts/listings/ad")).status, 401);
    assert.equal(
      (await call("/api/receipts/listings/ad", "other")).status,
      404,
    );
    const response = await call("/api/receipts/listings/ad", "owner");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/pdf/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(
      Buffer.from(await response.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    listing.affiliateVoidedAt = now;
    assert.equal(
      (await call("/api/receipts/listings/ad", "owner")).status,
      409,
    );
    listing.affiliateVoidedAt = null;
    listing.paidAt = null;
    assert.equal(
      (await call("/api/receipts/listings/ad", "admin")).status,
      409,
    );
    listing.paidAt = now;
    assert.equal(
      (await call("/api/receipts/payouts/pix", "other")).status,
      404,
    );
    assert.equal(
      (await call("/api/receipts/payouts/pix", "partner")).status,
      200,
    );
    payout.status = "REQUESTED";
    assert.equal(
      (await call("/api/receipts/payouts/pix", "admin")).status,
      409,
    );
    payout.status = "PAID";
    const query = "?from=2026-11-01&to=2026-11-12",
      path = "/api/admin/reports/payments" + query;
    assert.equal((await call(path, "owner")).status, 403);
    assert.equal((await call(path, "admin")).status, 200);
    assert.equal(reportQuery.take, 10001);
    assert.equal(
      reportQuery.where.paidAt.lt.toISOString(),
      "2026-11-13T03:00:00.000Z",
    );
    assert.equal(
      (await call("/api/admin/reports/payouts" + query, "admin")).status,
      200,
    );
    assert.equal(
      (await call("/api/admin/reports/credits" + query, "admin")).status,
      200,
    );
    db.listing.findMany = async () => Array(10001).fill(listing);
    assert.equal((await call(path, "admin")).status, 422);
    assert.equal(
      (await call("/api/admin/reports/unknown" + query, "admin")).status,
      400,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
