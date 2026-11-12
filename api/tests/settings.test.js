import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  commercialState,
  registerCommercialRoutes,
} from "../src/commercial-settings.js";
const base = {
  brokerName: "Lourival",
  brokerCreci: "778D-22",
  brokerPhone: "5563999915770",
  adPrice: 2990,
  featuredPrice: 5990,
  durationDays: 30,
  saleCommissionBps: 0,
  rentCommissionBps: 0,
};
test("configuração comercial exige ativação e credenciais, sem comissão sem expor segredos", () => {
  const saved = {
    saleCommissionBps: 600,
    rentCommissionBps: 10000,
    enabled: true,
  };
  assert.equal(
    commercialState(base, saved, {}).config.commercialEnabled,
    false,
  );
  const ready = commercialState(base, saved, {
    MP_ACCESS_TOKEN: "private-token",
    MP_COLLECTOR_ID: "private-id",
  });
  assert.equal(ready.config.commercialEnabled, true);
  assert.equal(ready.config.saleCommissionBps, 0);
  assert.ok(!JSON.stringify(ready).includes("private-token"));
  assert.equal(
    ready.termsVersion,
    commercialState(
      base,
      { ...saved, saleCommissionBps: 500 },
      { MP_ACCESS_TOKEN: "x", MP_COLLECTOR_ID: "y" },
    ).termsVersion,
  );
});
let server,
  url,
  saved = null;
const env = {};
before(async () => {
  const app = express();
  app.use(express.json());
  const tx = {
    commercialSettings: {
      findUnique: async () => saved,
      upsert: async (args) => {
        saved = args.update;
      },
    },
    audit: { create: async () => {} },
  };
  const db = { ...tx, $transaction: (fn) => fn(tx) };
  registerCommercialRoutes(app, {
    db,
    base,
    env,
    auth: (q, r, n) => {
      if (!q.headers.authorization) return r.sendStatus(401);
      q.user = { id: "owner", role: q.headers.authorization };
      n();
    },
    admin: (q, r, n) => (q.user.role === "ADMIN" ? n() : r.sendStatus(403)),
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
    audit: async () => {},
  });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server?.close());
test("somente administrador pode configurar cobranças; não ativa sem Mercado Pago", async () => {
  assert.equal((await fetch(url + "/admin/settings")).status, 401);
  assert.equal(
    (
      await fetch(url + "/admin/settings", {
        headers: { Authorization: "OWNER" },
      })
    ).status,
    403,
  );
  const save = (body) =>
    fetch(url + "/admin/settings", {
      method: "PUT",
      headers: { Authorization: "ADMIN", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await save({
        saleCommissionBps: 600,
        rentCommissionBps: 10000,
        enabled: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await save({
        enabled: "false",
      })
    ).status,
    400,
  );
  const r = await save({
    saleCommissionBps: 600,
    rentCommissionBps: 10000,
    enabled: false,
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.paymentsConfigured, false);
  const current = await (await fetch(url + "/config")).json();
  assert.equal(current.saleCommissionBps, 0);
  assert.equal(current.rentCommissionBps, 0);
  assert.equal(current.commercialEnabled, false);
  assert.match(current.terms.SALE, /Não há comissão/);
});

test("zero de comissão não impede ativação com credenciais válidas", () => {
  assert.equal(
    commercialState(
      base,
      { enabled: true },
      { MP_ACCESS_TOKEN: "local", MP_COLLECTOR_ID: "42" },
    ).config.commercialEnabled,
    true,
  );
  assert.equal(
    commercialState(
      base,
      { enabled: false },
      { MP_ACCESS_TOKEN: "local", MP_COLLECTOR_ID: "42" },
    ).config.commercialEnabled,
    false,
  );
});
