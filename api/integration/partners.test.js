import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import express from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { spawn } from "node:child_process";
import {
  registerPartnerRoutes,
  moneyTransaction,
  reserveCoupon,
  creditPartner,
  reversePartner,
  requestPayout,
  partnerBalances,
} from "../src/partners.js";
import { registerWebhookRoutes } from "../src/mp-webhooks.js";
const databaseUrl = process.env.PORTAL_PARTNER_TEST_DATABASE_URL;
if (!databaseUrl)
  throw Error(
    "Configure PORTAL_PARTNER_TEST_DATABASE_URL com PostgreSQL local isolado.",
  );
const target = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.pathname !== "/portal_partner_test"
)
  throw Error(
    "A integração só aceita banco LOCAL chamado portal_partner_test.",
  );
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const prefix = "partners-test-" + randomUUID();
let partner, otherPartner, coupon, service, url, child;
const users = {};
const payments = new Map();
const secret = "integration-test-only-01234567890123456789012345";
const serial = (fn) => moneyTransaction(db, fn);
const now = new Date(),
  past = new Date(Date.now() - 20 * 86400000);
async function listing(options = {}) {
  return db.listing.create({
    data: {
      ownerId: users.buyer.id,
      title: "Casa de teste de integração",
      description:
        "Descrição privada que não pode aparecer no painel do parceiro.",
      type: "HOUSE",
      purpose: "SALE",
      city: "Palmas",
      neighborhood: "Centro",
      privateAddress: "Endereço privado do cliente",
      ownerPhone: "63999999999",
      price: 10000000,
      area: 100,
      images: [],
      adPrice: 2490,
      originalAdPrice: 2990,
      plan: "BASIC",
      durationDays: 30,
      commissionBps: 600,
      termsVersion: "test",
      acceptedAt: now,
      termsText: "test",
      couponId: coupon.id,
      couponCode: coupon.code,
      partnerReward: 500,
      partnerHoldDays: 7,
      ...options,
    },
  });
}
async function paidListing(options = {}) {
  const l = await listing({
    paidAt: past,
    paymentId: "test-" + randomUUID(),
    ...options,
  });
  await serial((tx) => creditPartner(tx, l, l.paymentId));
  return l;
}
async function call(path, who = "admin", body, method = body ? "POST" : "GET") {
  const response = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(who ? { Authorization: who } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function entries(p = partner) {
  return db.affiliateEntry.findMany({
    where: { partnerId: p.id },
    include: { payout: true },
  });
}
async function clearEntries() {
  await db.affiliateEntry.deleteMany({
    where: { partnerId: { in: [partner.id, otherPartner.id] } },
  });
  await db.partnerPayout.deleteMany({
    where: { partnerId: { in: [partner.id, otherPartner.id] } },
  });
}
async function webhook(l, id, status = "approved", extra = {}) {
  const payment = {
    id: Number(id),
    status,
    live_mode: true,
    transaction_amount: l.adPrice / 100,
    currency_id: "BRL",
    collector_id: 42,
    external_reference: l.id,
    ...extra,
  };
  payments.set(id, payment);
  const ts = String(Date.now()),
    requestId = randomUUID();
  const digest = createHmac("sha256", "local-webhook-secret")
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  const response = await fetch(
    url + `/webhooks/mercadopago/production?type=payment&data.id=${id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-signature": `ts=${ts},v1=${digest}`,
      },
      body: JSON.stringify({ type: "payment", live_mode: true, data: { id } }),
    },
  );
  return { status: response.status, data: await response.json() };
}
before(async () => {
  for (const role of ["admin", "blogger", "other", "buyer"])
    users[role] = await db.user.create({
      data: {
        email: `${prefix}-${role}@example.com`,
        name: role + " Pessoa",
        passwordHash: "unused-test-only",
        role: role === "admin" ? "ADMIN" : "OWNER",
      },
    });
  partner = await db.partner.create({
    data: { userId: users.blogger.id, minWithdrawal: 500 },
  });
  otherPartner = await db.partner.create({
    data: { userId: users.other.id, minWithdrawal: 500 },
  });
  coupon = await db.coupon.create({
    data: {
      code: "T" + randomUUID().replaceAll("-", "").slice(0, 25).toUpperCase(),
      partnerId: partner.id,
      discountCents: 500,
      rewardCents: 500,
      holdDays: 7,
      plans: ["BASIC"],
      expiresAt: new Date(Date.now() + 86400000),
      maxUses: null,
    },
  });
  const app = express();
  app.use(express.json());
  const auth = (q, r, n) => {
    const user = users[q.headers.authorization];
    if (!user) return r.status(401).json({ error: "login" });
    q.user = user;
    n();
  };
  const admin = (q, r, n) =>
    q.user.role === "ADMIN" ? n() : r.status(403).json({ error: "admin" });
  const wrap = (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n);
  const getCommercial = async () => ({
    config: { commercialEnabled: true, adPrice: 2990, featuredPrice: 5990 },
  });
  const audit = (tx, actorId, action, entityId, detail = "") =>
    tx.audit.create({ data: { actorId, action, entityId, detail } });
  registerPartnerRoutes(app, { db, auth, admin, wrap, getCommercial, audit });
  registerWebhookRoutes(app, {
    db,
    auth,
    admin,
    wrap,
    env: {
      MP_ACCESS_TOKEN: "local-test",
      MP_WEBHOOK_SECRET: "local-webhook-secret",
      MP_COLLECTOR_ID: "42",
    },
    requestMp: async (_token, path) => payments.get(path.split("/").pop()),
  });
  app.use((e, q, r, n) =>
    r
      .status(
        e.status ||
          (e instanceof z.ZodError ? 400 : e.code === "P2002" ? 409 : 500),
      )
      .json({ error: e.message, code: e.code }),
  );
  await new Promise((resolve) => {
    service = app.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${service.address().port}/api`;
  child = spawn(
    process.execPath,
    [new URL("../src/server.js", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PORT: "3097",
        JWT_SECRET: secret,
        WEB_ORIGIN: "http://localhost:5173",
        NODE_ENV: "test",
        COMMERCIAL_ENABLED: "true",
        SALE_COMMISSION_BPS: "600",
        RENT_COMMISSION_BPS: "10000",
        MP_ACCESS_TOKEN: "unused-no-network-calls",
        MP_COLLECTOR_ID: "42",
        AD_PRICE_CENTS: "2990",
        FEATURED_PRICE_CENTS: "5990",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(Error(output || "startup timeout")),
      10000,
    );
    child.stdout.on("data", (b) => {
      output += b;
      if (output.includes("Portal API iniciada.")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", (b) => (output += b));
    child.on("exit", () => {
      clearTimeout(timer);
      reject(Error(output));
    });
  });
});
after(async () => {
  child?.kill();
  service?.close();
  const partnerIds = [partner?.id, otherPartner?.id].filter(Boolean);
  const userIds = Object.values(users).map((u) => u.id);
  await db.audit.deleteMany({
    where: {
      OR: [{ actorId: { in: userIds } }, { entityId: { startsWith: prefix } }],
    },
  });
  await db.affiliateEntry.deleteMany({
    where: { partnerId: { in: partnerIds } },
  });
  await db.partnerPayout.deleteMany({
    where: { partnerId: { in: partnerIds } },
  });
  await db.imageUpload.deleteMany({ where: { ownerId: { in: userIds } } });
  await db.listing.deleteMany({ where: { ownerId: { in: userIds } } });
  await db.coupon.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await db.partner.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
test("permissões: parceiro não administra, cliente não acessa extrato, acesso anônimo negado", async () => {
  assert.equal((await call("/admin/partners", "blogger")).status, 403);
  assert.equal((await call("/partner/dashboard", "buyer")).status, 403);
  assert.equal((await call("/partner/dashboard", null)).status, 401);
  assert.equal((await call("/admin/partners", null)).status, 401);
  assert.equal((await call("/admin/coupons", "blogger", {})).status, 403);
});
test("cadastro de parceiro exige conta comum existente e cupom exige margem, validade e condições válidas", async () => {
  assert.equal(
    (
      await call("/admin/partners", "admin", {
        email: users.admin.email,
        minWithdrawal: 500,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/admin/partners", "admin", {
        email: "nonexistent@example.com",
        minWithdrawal: 500,
      })
    ).status,
    400,
  );
  const input = {
    code: "BAD" + randomUUID().slice(0, 8),
    partnerId: partner.id,
    active: true,
    discountCents: 2500,
    rewardCents: 600,
    holdDays: 7,
    plans: ["BASIC"],
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    maxUses: null,
  };
  assert.equal((await call("/admin/coupons", "admin", input)).status, 400);
  assert.equal(
    (
      await call("/admin/coupons", "admin", {
        ...input,
        discountCents: 500,
        holdDays: 0,
      })
    ).status,
    400,
  );
  const result = await call("/admin/coupons", "admin", {
    ...input,
    discountCents: 500,
    holdDays: 1,
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.holdDays, 1);
  assert.equal(
    (
      await call(
        `/admin/coupons/${result.data.id}`,
        "admin",
        { active: false },
        "PUT",
      )
    ).status,
    200,
  );
});
test("cupom é cotado pelo servidor, rejeita autoindicação e não revela recompensa ou dados do parceiro", async () => {
  const quote = await call("/coupons/quote", "buyer", {
    code: coupon.code.toLowerCase(),
    plan: "BASIC",
  });
  assert.equal(quote.status, 200);
  assert.equal(quote.data.finalPrice, 2490);
  assert.ok(!JSON.stringify(quote.data).includes("partnerId"));
  assert.ok(!JSON.stringify(quote.data).includes("reward"));
  assert.equal(
    (
      await call("/coupons/quote", "blogger", {
        code: coupon.code,
        plan: "BASIC",
      })
    ).status,
    400,
  );
});
test("anúncio real congela desconto e condições, ignora valores adulterados e não gera crédito no cadastro", async () => {
  const token = jwt.sign({ sub: users.buyer.id }, secret);
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
  const config = await (await fetch("http://127.0.0.1:3097/api/config")).json();
  const photo = await db.imageUpload.create({
    data: {
      id: randomUUID(),
      ownerId: users.buyer.id,
      mimeType: "image/webp",
      data: Buffer.from("local-fixture"),
    },
  });
  // Image URLs are the same server-generated paths accepted by uploadId().
  const imagePath = `/uploads/${photo.id}`;
  const quote = (
    await call("/coupons/quote", "buyer", { code: coupon.code, plan: "BASIC" })
  ).data;
  const body = {
    title: "Casa para integração",
    description: "Descrição suficientemente longa do imóvel anunciado.",
    type: "HOUSE",
    purpose: "SALE",
    plan: "BASIC",
    city: "Palmas",
    neighborhood: "Centro",
    privateAddress: "Endereço completo privado",
    ownerPhone: "63999999999",
    price: 10000000,
    area: 100,
    bedrooms: 2,
    images: [imagePath],
    termsAccepted: true,
    termsVersion: config.termsVersion,
    couponCode: coupon.code,
    couponVersion: quote.version,
    adPrice: 1,
    partnerReward: 99999999,
  };
  const result = await fetch("http://127.0.0.1:3097/api/owner/listings", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const saved = await result.json();
  assert.equal(result.status, 201, JSON.stringify(saved));
  assert.equal(saved.adPrice, 2490);
  assert.equal(saved.originalAdPrice, 2990);
  assert.equal(saved.partnerReward, 500);
  assert.equal(saved.commissionBps, 600);
  assert.ok(saved.termsText.includes("24.90"));
  assert.ok(saved.termsText.includes(coupon.code));
  assert.equal(
    await db.affiliateEntry.count({ where: { listingId: saved.id } }),
    0,
  );
  assert.equal(saved.paidAt, null);
  const stale = await fetch("http://127.0.0.1:3097/api/owner/listings", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, couponVersion: past.toISOString() }),
  });
  assert.equal(stale.status, 409);
});
test("duas reservas simultâneas respeitam a última utilização disponível", async () => {
  const c = await db.coupon.create({
    data: {
      code: "L" + randomUUID().replaceAll("-", "").slice(0, 25).toUpperCase(),
      partnerId: partner.id,
      discountCents: 500,
      rewardCents: 500,
      holdDays: 7,
      plans: ["BASIC"],
      expiresAt: new Date(Date.now() + 86400000),
      maxUses: 1,
    },
  });
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      serial((tx) =>
        reserveCoupon(tx, {
          code: c.code,
          version: c.createdAt.toISOString(),
          basePrice: 2990,
          plan: "BASIC",
          userId: users.buyer.id,
        }),
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.coupon.findUnique({ where: { id: c.id } })).reservations,
    1,
  );
});
test("webhooks e consulta de pagamento concorrentes geram um único crédito com prazo correto", async () => {
  const l = await listing();
  assert.equal((await webhook(l, "101", "pending")).status, 200);
  assert.equal(
    await db.affiliateEntry.count({ where: { listingId: l.id } }),
    0,
  );
  assert.equal(
    (await webhook(l, "101", "approved", { transaction_amount: 29.9 })).status,
    400,
  );
  const results = await Promise.all([webhook(l, "101"), webhook(l, "101")]);
  for (const result of results)
    assert.equal(result.status, 200, JSON.stringify(result));
  await Promise.all(
    [1, 2].map(() => serial((tx) => creditPartner(tx, l, "101"))),
  );
  const saved = await db.listing.findUnique({ where: { id: l.id } });
  const rows = await db.affiliateEntry.findMany({ where: { listingId: l.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 500);
  assert.equal(
    rows[0].availableAt.getTime() - saved.paidAt.getTime(),
    7 * 86400000,
  );
  const dashboard = await call("/partner/dashboard", "blogger");
  const json = JSON.stringify(dashboard.data);
  assert.ok(!json.includes("Endereço privado"));
  assert.ok(!json.includes(users.buyer.email));
  assert.ok(!json.includes("63999999999"));
  assert.equal(
    (await call("/partner/dashboard", "other")).data.entries.length,
    0,
  );
});
test("saque bloqueia crédito ainda no prazo de liberação", async () => {
  await clearEntries();
  await paidListing({ paidAt: new Date() });
  const result = await call("/partner/payouts", "blogger", {
    requestKey: randomUUID(),
    pixKey: "partner@example.com",
    recipientName: "Parceiro Teste",
    accepted: true,
  });
  assert.equal(result.status, 400);
  assert.equal(
    await db.partnerPayout.count({ where: { partnerId: partner.id } }),
    0,
  );
});
test("saques concorrentes reservam o saldo uma única vez; repetição da chave devolve o mesmo protocolo", async () => {
  await clearEntries();
  await paidListing();
  await paidListing();
  const base = {
    pixKey: "partner@example.com",
    recipientName: "Parceiro Teste",
    accepted: true,
  };
  const keys = [randomUUID(), randomUUID()];
  const results = await Promise.all(
    keys.map((requestKey) =>
      call("/partner/payouts", "blogger", { ...base, requestKey }),
    ),
  );
  assert.equal(
    results.filter((r) => r.status === 201).length,
    1,
    JSON.stringify(results),
  );
  const success = results.find((r) => r.status === 201);
  assert.equal(success.data.amount, 1000);
  const replay = await call("/partner/payouts", "blogger", {
    ...base,
    requestKey: success.data.requestKey,
  });
  assert.equal(replay.status, 201);
  assert.equal(replay.data.id, success.data.id);
  assert.equal(partnerBalances(await entries()).reserved, 1000);
  assert.equal(partnerBalances(await entries()).available, 0);
  assert.equal(
    (
      await call(`/admin/partner-payouts/${success.data.id}/resolve`, "other", {
        status: "PAID",
        confirmed: true,
        receiptReference: "TESTPIX123",
      })
    ).status,
    403,
  );
  const rejected = await call(
    `/admin/partner-payouts/${success.data.id}/resolve`,
    "admin",
    { status: "REJECTED", note: "Chave Pix precisa de correção" },
  );
  assert.equal(rejected.status, 200);
  assert.equal(partnerBalances(await entries()).available, 1000);
});
test("estorno cancela saque pendente e libera somente os outros créditos", async () => {
  await clearEntries();
  const l = await paidListing({ paymentId: "201" });
  await paidListing();
  const p = await serial((tx) =>
    requestPayout(tx, partner, {
      requestKey: randomUUID(),
      pixKey: "test-pix",
      recipientName: "Teste Parceiro",
    }),
  );
  assert.equal((await webhook(l, "201", "refunded")).status, 200);
  assert.equal(
    (await db.partnerPayout.findUnique({ where: { id: p.id } })).status,
    "REJECTED",
  );
  assert.equal(partnerBalances(await entries()).available, 500);
  assert.equal(partnerBalances(await entries()).reserved, 0);
  assert.equal((await webhook(l, "201", "refunded")).status, 200);
  assert.equal(
    await db.affiliateEntry.count({
      where: { listingId: l.id, kind: "REVERSAL" },
    }),
    1,
  );
  assert.equal((await webhook(l, "201", "approved")).status, 200);
  assert.equal(
    await db.affiliateEntry.count({
      where: { listingId: l.id, kind: "CREDIT" },
    }),
    1,
  );
});
test("estorno repetido não cancela um novo saque que já compensou o lançamento", async () => {
  await clearEntries();
  const l = await paidListing({ paymentId: "251" });
  await paidListing();
  assert.equal((await webhook(l, "251", "refunded")).status, 200);
  const payout = await serial((tx) =>
    requestPayout(tx, partner, {
      requestKey: randomUUID(),
      pixKey: "test-pix",
      recipientName: "Teste Parceiro",
    }),
  );
  assert.equal(payout.amount, 500);
  assert.equal((await webhook(l, "251", "refunded")).status, 200);
  assert.equal(
    (await db.partnerPayout.findUnique({ where: { id: payout.id } })).status,
    "REQUESTED",
  );
  assert.equal(partnerBalances(await entries()).reserved, 500);
});
test("estorno anterior à aprovação impede crédito tardio e republicação", async () => {
  await clearEntries();
  const l = await listing();
  assert.equal((await webhook(l, "261", "refunded")).status, 200);
  assert.equal((await webhook(l, "261", "approved")).status, 200);
  assert.equal(
    await db.affiliateEntry.count({ where: { listingId: l.id } }),
    0,
  );
  const current = await db.listing.findUnique({ where: { id: l.id } });
  assert.equal(current.paidAt, null);
  assert.ok(current.affiliateVoidedAt);
  const response = await fetch(
    `http://127.0.0.1:3097/api/admin/listings/${l.id}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + jwt.sign({ sub: users.admin.id }, secret),
      },
      body: JSON.stringify({ approve: true }),
    },
  );
  assert.equal(response.status, 409);
});
test("estorno e baixa simultâneos preservam saldo líquido sem dupla reserva", async () => {
  await clearEntries();
  const l = await paidListing({ paymentId: "271" });
  const p = await serial((tx) =>
    requestPayout(tx, partner, {
      requestKey: randomUUID(),
      pixKey: "test-pix",
      recipientName: "Teste Parceiro",
    }),
  );
  const [refund, resolution] = await Promise.all([
    webhook(l, "271", "refunded"),
    call(`/admin/partner-payouts/${p.id}/resolve`, "admin", {
      status: "PAID",
      confirmed: true,
      receiptReference: "CONCURRENT-PIX-TEST",
    }),
  ]);
  assert.equal(refund.status, 200);
  assert.ok([200, 409].includes(resolution.status), JSON.stringify(resolution));
  const balance = partnerBalances(await entries());
  assert.equal(balance.available + balance.paid, 0);
  assert.equal(balance.reserved, 0);
});
test("baixa manual exige comprovante, não repete pagamento e estorno posterior compensa futuros créditos", async () => {
  await clearEntries();
  const l = await paidListing({ paymentId: "301" });
  const p = await serial((tx) =>
    requestPayout(tx, partner, {
      requestKey: randomUUID(),
      pixKey: "test-pix",
      recipientName: "Teste Parceiro",
    }),
  );
  assert.equal(
    (
      await call(`/admin/partner-payouts/${p.id}/resolve`, "admin", {
        status: "PAID",
        confirmed: true,
      })
    ).status,
    400,
  );
  const paid = await call(`/admin/partner-payouts/${p.id}/resolve`, "admin", {
    status: "PAID",
    confirmed: true,
    receiptReference: "E-LOCAL-PIX-TEST",
  });
  assert.equal(paid.status, 200);
  assert.equal(partnerBalances(await entries()).paid, 500);
  assert.equal(
    (
      await call(`/admin/partner-payouts/${p.id}/resolve`, "admin", {
        status: "PAID",
        confirmed: true,
        receiptReference: "E-LOCAL-PIX-TEST",
      })
    ).status,
    409,
  );
  // Partial refunds also cancel the full referral credit, conservatively.
  assert.equal(
    (await webhook(l, "301", "approved", { transaction_amount_refunded: 1 }))
      .status,
    200,
  );
  assert.equal(partnerBalances(await entries()).available, -500);
  await paidListing();
  await paidListing();
  const next = await serial((tx) =>
    requestPayout(tx, partner, {
      requestKey: randomUUID(),
      pixKey: "test-pix",
      recipientName: "Teste Parceiro",
    }),
  );
  assert.equal(next.amount, 500);
  assert.equal(partnerBalances(await entries()).reserved, 500);
});
test("parceiro desativado mantém extrato mas não usa cupom nem solicita saque", async () => {
  await clearEntries();
  await paidListing();
  assert.equal(
    (
      await call(
        `/admin/partners/${partner.id}`,
        "admin",
        { active: false, minWithdrawal: 500 },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal((await call("/partner/dashboard", "blogger")).status, 200);
  assert.equal(
    (
      await call("/coupons/quote", "buyer", {
        code: coupon.code,
        plan: "BASIC",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/partner/payouts", "blogger", {
        requestKey: randomUUID(),
        pixKey: "test-pix",
        recipientName: "Teste Parceiro",
        accepted: true,
      })
    ).status,
    403,
  );
});
