import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  registerTestCheckoutRoutes,
  safeTestOrder,
} from "../src/test-checkout.js";
const orderId = "ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9",
  key = "12345678-1234-4234-8234-123456789abc";
let records = new Map(),
  requests = [],
  tags = ["test_user"],
  status = "created",
  token = "test-only-token",
  server,
  url;
const raw = () => ({
  id: orderId,
  type: "online",
  processing_mode: "manual",
  external_reference: "portal-test-" + key,
  total_amount: "1.00",
  currency: "BRL",
  user_id: "42",
  created_date: new Date().toISOString(),
  status,
  total_paid_amount: status === "processed" ? "1.00" : "0.00",
  checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${orderId}`,
  client_token: "must-not-leak",
});
before(async () => {
  const app = express();
  app.use(express.json());
  const env = {
    get MP_TEST_ACCESS_TOKEN() {
      return token;
    },
    MP_ACCESS_TOKEN: "production-token-must-not-be-used",
  };
  const db = {
    audit: {
      findMany: async () => [...records.values()],
      findUnique: async ({ where }) => records.get(where.id),
      findFirst: async ({ where }) =>
        [...records.values()].find(
          (r) => r.entityId === where.entityId && r.action === where.action,
        ),
      upsert: async ({ where, create }) => {
        if (!records.has(where.id)) records.set(where.id, create);
        return records.get(where.id);
      },
    },
  };
  const auth = (q, r, n) => {
    if (!q.headers.authorization) return r.sendStatus(401);
    q.user = { id: "admin-1", role: q.headers.authorization };
    n();
  };
  registerTestCheckoutRoutes(app, {
    db,
    env,
    auth,
    admin: (q, r, n) => (q.user.role === "ADMIN" ? n() : r.sendStatus(403)),
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
    fetchImpl: async (path, options) => {
      requests.push({ path, options });
      assert.equal(options.headers.Authorization, "Bearer test-only-token");
      return {
        ok: true,
        json: async () =>
          path.endsWith("/users/me") ? { id: 42, tags } : raw(),
      };
    },
  });
  app.use((e, q, r, n) => r.status(e.status || 500).json({ error: e.message }));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${server.address().port}/api/admin/test-checkout`;
});
after(() => server?.close());
const create = () =>
  fetch(url, {
    method: "POST",
    headers: { Authorization: "ADMIN", "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: key }),
  });
test("somente administrador acessa teste; sem token não há requisição ao provedor", async () => {
  assert.equal((await fetch(url)).status, 401);
  assert.equal(
    (await fetch(url, { headers: { Authorization: "OWNER" } })).status,
    403,
  );
  token = "";
  assert.equal((await create()).status, 503);
  assert.equal(requests.length, 0);
  token = "test-only-token";
});
test("bloqueia credencial real antes de criar ordem, mesmo com variável de teste preenchida", async () => {
  tags = [];
  assert.equal((await create()).status, 400);
  assert.ok(requests.every((r) => r.path.endsWith("/users/me")));
  tags = ["test_user"];
  requests = [];
});
test("cria ordem sem vínculo financeiro e retoma tentativa idempotente sem repetir criação", async () => {
  const response = await create();
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.orderId, orderId);
  assert.equal(data.approved, false);
  assert.equal(data.readyForMeasurement, false);
  assert.ok(!JSON.stringify(data).includes("must-not-leak"));
  assert.equal(records.size, 1);
  const post = requests.find((r) => r.options.method === "POST");
  assert.equal(post.path, "https://api.mercadopago.com/v1/orders");
  assert.equal(post.options.headers["X-Idempotency-Key"], key);
  const body = JSON.parse(post.options.body);
  assert.equal(body.total_amount, "1.00");
  assert.equal(body.processing_mode, "manual");
  assert.equal(body.external_reference, "portal-test-" + key);
  const count = requests.length;
  assert.equal((await create()).status, 200);
  assert.equal(requests.length, count);
});
test("consulta apenas ordens geradas pelo portal e só libera medição após pagamento", async () => {
  status = "processed";
  const response = await fetch(url + "/" + orderId, {
    headers: { Authorization: "ADMIN" },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.approved, true);
  assert.equal(data.readyForMeasurement, true);
  const before = requests.length;
  assert.equal(
    (
      await fetch(url + "/ORDTST000000000000000", {
        headers: { Authorization: "ADMIN" },
      })
    ).status,
    404,
  );
  assert.equal(requests.length, before);
  const history = await (
    await fetch(url, { headers: { Authorization: "ADMIN" } })
  ).json();
  assert.equal(history.orders[0].readyForMeasurement, false);
  assert.ok(!JSON.stringify(history).includes("production-token"));
});
test("resposta com ordem real, valor incorreto, vendedor diferente ou URL adulterada é bloqueada", () => {
  for (const patch of [
    { id: "ORDREAL0000000000" },
    { live_mode: true },
    { user_id: 99 },
    { external_reference: "outro" },
    { total_amount: "29.90" },
    { checkout_url: "https://evil.example/checkout" },
  ])
    assert.throws(
      () => safeTestOrder({ ...raw(), ...patch }, 42, "portal-test-" + key),
      /resposta|Link/,
    );
  const old = safeTestOrder(
    {
      ...raw(),
      created_date: new Date(Date.now() - 8 * 86400000).toISOString(),
    },
    42,
    "portal-test-" + key,
  );
  assert.equal(old.readyForMeasurement, false);
});
