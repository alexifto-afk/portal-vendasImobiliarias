import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import express from "express";
import { registerWebhookRoutes } from "../src/mp-webhooks.js";
const orderId = "ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9";
let events = new Map(),
  writes = 0,
  queries = 0,
  server,
  url,
  remoteStatus = "approved",
  remoteAmount = 29.9;
const listing = {
  id: "listing",
  adPrice: 2990,
  paidAt: null,
  paymentId: null,
  status: "PENDING",
};
before(async () => {
  const app = express();
  app.use(express.json());
  const created = {
    id: "created",
    action: "MP_TEST_ORDER_CREATED",
    entityId: orderId,
    detail: JSON.stringify({
      sellerId: 42,
      reference: "portal-test-key",
      order: { amount: "10.00" },
    }),
  };
  const audit = {
    findUnique: async ({ where }) => events.get(where.id),
    findFirst: async ({ where }) =>
      where.entityId === orderId ? created : null,
    create: async ({ data }) => {
      events.set(data.id, data);
    },
    findMany: async () => [...events.values()],
  };
  const db = {
    audit,
    listing: {
      findUnique: async () => listing,
      updateMany: async ({ where, data }) => {
        if (where.paidAt === null && listing.paidAt) return { count: 0 };
        Object.assign(listing, data);
        writes++;
        return { count: 1 };
      },
    },
    $transaction: async (fn) => fn(db),
  };
  registerWebhookRoutes(app, {
    db,
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
    env: {
      MP_TEST_ACCESS_TOKEN: "test-token",
      MP_ACCESS_TOKEN: "prod-token",
      MP_TEST_WEBHOOK_SECRET: "test-secret",
      MP_WEBHOOK_SECRET: "prod-secret",
      MP_COLLECTOR_ID: "42",
    },
    auth: (q, r, n) => {
      if (q.headers.authorization !== "ADMIN") return r.sendStatus(401);
      n();
    },
    admin: (q, r, n) => n(),
    requestMp: async (token, path) => {
      queries++;
      if (path.includes("/orders/")) {
        assert.equal(token, "test-token");
        return {
          id: orderId,
          type: "online",
          processing_mode: "manual",
          user_id: 42,
          currency: "BRL",
          total_amount: "10.00",
          external_reference: "portal-test-key",
          created_date: new Date().toISOString(),
          status: "processed",
          total_paid_amount: "10.00",
          checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${orderId}`,
        };
      }
      assert.equal(token, "prod-token");
      return {
        id: 123,
        status: remoteStatus,
        live_mode: true,
        transaction_amount: remoteAmount,
        currency_id: "BRL",
        collector_id: 42,
        external_reference: "listing",
      };
    },
  });
  app.use((e, q, r, n) => r.status(e.status || 500).json({ error: e.message }));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server?.close());
function notification(mode, id, body = {}, options = {}) {
  const ts = String(options.timestamp ?? Date.now()),
    requestId = options.requestId || "request-1",
    secret = mode === "test" ? "test-secret" : "prod-secret";
  const digest = createHmac("sha256", secret)
    .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return fetch(
    `${url}/webhooks/mercadopago/${mode}?data.id=${id}&type=${mode === "test" ? "order" : "payment"}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-signature": options.bad
          ? "ts=" + ts + ",v1=bad"
          : `ts=${ts},v1=${digest}`,
      },
      body: JSON.stringify({
        type: mode === "test" ? "order" : "payment",
        live_mode: mode === "production",
        data: { id },
        ...body,
      }),
    },
  );
}
test("assinatura ausente, falsa, expirada e corpo com outro recurso não consultam o provedor", async () => {
  assert.equal(
    (
      await fetch(url + "/webhooks/mercadopago/test?data.id=" + orderId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    401,
  );
  assert.equal(
    (await notification("test", orderId, {}, { bad: true })).status,
    401,
  );
  assert.equal(
    (
      await notification(
        "test",
        orderId,
        {},
        { timestamp: Date.now() - 700000 },
      )
    ).status,
    401,
  );
  assert.equal(
    (await notification("test", orderId, { data: { id: "outro" } })).status,
    400,
  );
  assert.equal(queries, 0);
  assert.equal(writes, 0);
});
test("testes aceitam ts assinado em segundos ou milissegundos e nunca baixam anúncios", async () => {
  for (const timestamp of [Math.floor(Date.now() / 1000), Date.now()]) {
    const response = await notification("test", orderId, {}, { timestamp });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result, "test_payment_verified");
  }
  assert.equal(writes, 0);
  assert.equal(listing.paidAt, null);
  assert.equal(events.size, 2);
});
test("evento repetido é idempotente; status e valores são confirmados na API, não no body", async () => {
  const timestamp = Date.now();
  remoteStatus = "pending";
  let r = await notification(
    "production",
    "123",
    { status: "approved" },
    { timestamp },
  );
  assert.equal(r.status, 200);
  assert.equal(listing.paidAt, null);
  const before = queries;
  r = await notification(
    "production",
    "123",
    { status: "approved" },
    { timestamp },
  );
  assert.equal((await r.json()).duplicate, true);
  assert.equal(queries, before);
  remoteStatus = "approved";
  remoteAmount = 9;
  r = await notification(
    "production",
    "123",
    {},
    { requestId: "invalid-value" },
  );
  assert.equal(r.status, 400);
  assert.equal(listing.paidAt, null);
  remoteAmount = 29.9;
  r = await notification("production", "123", {}, { requestId: "approved" });
  assert.equal(r.status, 200);
  assert.ok(listing.paidAt);
  assert.equal(listing.paymentId, "123");
  assert.equal(listing.status, "PENDING");
  assert.equal(writes, 1);
  r = await notification(
    "production",
    "123",
    {},
    { requestId: "approved-again" },
  );
  assert.equal(r.status, 200);
  assert.equal(writes, 1);
});
test("estorno retira anúncio da vitrine e eventos não misturam ambientes", async () => {
  listing.status = "PUBLISHED";
  listing.reviewed = true;
  remoteStatus = "refunded";
  const r = await notification(
    "production",
    "123",
    {},
    { requestId: "refund" },
  );
  assert.equal(r.status, 200);
  assert.equal(listing.status, "REJECTED");
  assert.equal(listing.reviewed, false);
  assert.ok(listing.paidAt);
  assert.equal(
    (await notification("test", orderId, { live_mode: true })).status,
    400,
  );
  const admin = await fetch(url + "/admin/webhooks", {
    headers: { Authorization: "ADMIN" },
  });
  assert.equal(admin.status, 200);
  const result = await admin.json();
  assert.equal(result.testConfigured, true);
  assert.ok(result.events.length);
  assert.ok(!JSON.stringify(result).includes("test-secret"));
});
