import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import express from "express";
import {
  registerWhatsappCampaigns,
  consentVersion,
  whatsappSettings,
  campaignMessage,
} from "../src/whatsapp-campaigns.js";
const databaseUrl = process.env.PORTAL_PARTNER_TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname) ||
  new URL(databaseUrl).pathname !== "/portal_partner_test"
)
  throw Error("Use banco local portal_partner_test.");
const db = new PrismaClient({ datasourceUrl: databaseUrl }),
  prefix = "wa-" + randomUUID();
const env = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_NUMBER: "5563999998888",
  WHATSAPP_PHONE_NUMBER_ID: "123456",
  WHATSAPP_ACCESS_TOKEN: "fake-never-sent",
  WHATSAPP_APP_SECRET: "local-test-only-secret",
  WHATSAPP_VERIFY_TOKEN: "local-verify",
  WHATSAPP_MARKETING_TEMPLATE: "novidades_negociee",
};
let server, root, owner, listing, worker;
const sent = [];
let unknown = false;
const audit = async () => {};
const phone = "63911111111",
  phone2 = "63911111112";
async function call(path, body, user = "admin") {
  const response = await fetch(root + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { Authorization: user } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => null),
  };
}
async function inbound(from, text, signature = true, extra = {}) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID },
              messages: text
                ? [{ from, type: "text", text: { body: text } }]
                : [],
              ...extra,
            },
          },
        ],
      },
    ],
  });
  return fetch(root + "/whatsapp/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": signature
        ? "sha256=" +
          createHmac("sha256", env.WHATSAPP_APP_SECRET)
            .update(body)
            .digest("hex")
        : "sha256=" + "0".repeat(64),
    },
    body,
  });
}
async function subscribe(number = phone) {
  const result = await call(
    "/whatsapp/subscribe",
    { phone: number, consent: true, consentVersion },
    null,
  );
  assert.equal(result.status, 200, JSON.stringify(result));
  return new URL(result.data.url).searchParams.get("text");
}
async function draft() {
  const result = await call("/admin/whatsapp/campaigns", {
    title: prefix,
    listingIds: [listing.id],
  });
  assert.equal(result.status, 201, JSON.stringify(result));
  return result.data;
}
const dispatch = (c, count = 1) =>
  call(`/admin/whatsapp/campaigns/${c.id}/dispatch`, {
    confirmed: true,
    recipientCount: count,
  });
before(async () => {
  owner = await db.user.create({
    data: {
      name: "Local test",
      email: prefix + "@example.test",
      passwordHash: "test-only",
    },
  });
  listing = await db.listing.create({
    data: {
      ownerId: owner.id,
      title: "Casa de teste campanha",
      description: "Casa para testar campanha sem enviar mensagens reais.",
      type: "HOUSE",
      category: "REAL_ESTATE",
      purpose: "SALE",
      state: "TO",
      city: "Araguatins",
      neighborhood: "Centro",
      privateAddress: "",
      ownerPhone: phone,
      price: 10000000,
      area: 100,
      images: [],
      status: "PUBLISHED",
      reviewed: true,
      paidAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      adPrice: 2990,
      termsVersion: "test",
      acceptedAt: new Date(),
      termsText: "test",
      commissionBps: 0,
      durationDays: 30,
    },
  });
  const app = express();
  app.use(
    express.json({
      verify: (q, r, b) => {
        q.rawBody = b;
      },
    }),
  );
  worker = registerWhatsappCampaigns(app, {
    db,
    env,
    webOrigin: "https://negociee.example",
    audit,
    startWorker: false,
    wrap: (fn) => (q, r, next) => Promise.resolve(fn(q, r)).catch(next),
    auth: (q, r, next) => (q.get("Authorization") ? next() : r.sendStatus(401)),
    admin: (q, r, next) => {
      if (q.get("Authorization") !== "admin") return r.sendStatus(403);
      q.user = { id: owner.id };
      next();
    },
    send: async (c, campaign) => {
      sent.push({ phone: c.phone, campaign: campaign.id });
      if (unknown) throw Error("timeout");
      return "fake-message-" + randomUUID();
    },
  });
  app.use((e, q, r, next) =>
    r.status(e.status || 400).json({ error: e.message }),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  root = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  worker?.stop();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (owner) {
    const campaigns = await db.whatsappCampaign.findMany({
      where: { createdById: owner.id },
      select: { id: true },
    });
    await db.whatsappDelivery.deleteMany({
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
    });
    await db.whatsappCampaign.deleteMany({ where: { createdById: owner.id } });
    await db.listing.deleteMany({ where: { ownerId: owner.id } });
    await db.user.delete({ where: { id: owner.id } });
  }
  await db.whatsappContact.deleteMany({
    where: { phone: { in: ["55" + phone, "55" + phone2] } },
  });
  await db.$disconnect();
});
test("cadastro exige consentimento e confirmação pelo próprio número; webhook rejeita assinatura falsa", async () => {
  assert.equal((await call("/admin/whatsapp", null, null)).status, 401);
  assert.equal((await call("/admin/whatsapp", null, "owner")).status, 403);
  assert.equal(
    (
      await call(
        "/whatsapp/subscribe",
        { phone, consent: false, consentVersion },
        null,
      )
    ).status,
    400,
  );
  const text = await subscribe();
  let contact = await db.whatsappContact.findUnique({
    where: { phone: "55" + phone },
  });
  assert.equal(contact.status, "PENDING");
  assert.ok(contact.pendingTokenHash);
  assert.ok(!text.includes(contact.pendingTokenHash));
  assert.equal((await inbound("55" + phone, text, false)).status, 401);
  await inbound("55" + phone2, text);
  assert.equal(
    (await db.whatsappContact.findUnique({ where: { id: contact.id } })).status,
    "PENDING",
  );
  await inbound("55" + phone, text);
  contact = await db.whatsappContact.findUnique({ where: { id: contact.id } });
  assert.equal(contact.status, "ACTIVE");
  assert.equal(contact.consentVersion, consentVersion);
  assert.ok(contact.consentAt);
  assert.equal(contact.pendingTokenHash, null);
  await subscribe(phone2);
  const dashboard = await call("/admin/whatsapp");
  assert.equal(
    dashboard.data.counts.find((c) => c.status === "ACTIVE")._count,
    1,
  );
  assert.equal("pendingTokenHash" in dashboard.data.contacts[0], false);
});
test("fila inclui somente confirmados, bloqueia duplo disparo e acompanha entrega sem rebaixar leitura", async () => {
  const c = await draft();
  assert.equal(
    c.messageText,
    campaignMessage([listing], "https://negociee.example"),
  );
  assert.equal((await dispatch(c, 2)).status, 409);
  assert.equal((await dispatch(c)).status, 200);
  assert.equal((await dispatch(c)).status, 409);
  await worker.tick();
  await worker.tick();
  assert.equal(sent.length, 1);
  let delivery = await db.whatsappDelivery.findFirst({
    where: { campaignId: c.id },
  });
  assert.equal(delivery.status, "ACCEPTED");
  assert.equal(
    (await db.whatsappCampaign.findUnique({ where: { id: c.id } })).status,
    "COMPLETE",
  );
  await inbound(null, null, true, {
    statuses: [
      { id: delivery.providerMessageId, status: "read" },
      { id: delivery.providerMessageId, status: "delivered" },
    ],
  });
  delivery = await db.whatsappDelivery.findUnique({
    where: { id: delivery.id },
  });
  assert.equal(delivery.status, "READ");
  const dashboard = await call("/admin/whatsapp");
  assert.equal(
    dashboard.data.campaigns.find((x) => x.id === c.id).counts[0]._count,
    1,
  );
});
test("SAIR interrompe próximos envios e reativação exige nova mensagem do titular", async () => {
  const c = await draft();
  await dispatch(c);
  await inbound("55" + phone, "SAIR");
  await worker.tick();
  assert.equal(sent.length, 1);
  assert.equal(
    (await db.whatsappDelivery.findFirst({ where: { campaignId: c.id } }))
      .status,
    "SKIPPED",
  );
  const text = await subscribe();
  assert.equal(
    (await db.whatsappContact.findUnique({ where: { phone: "55" + phone } }))
      .status,
    "STOPPED",
  );
  await inbound("55" + phone, text);
  assert.equal(
    (await db.whatsappContact.findUnique({ where: { phone: "55" + phone } }))
      .status,
    "ACTIVE",
  );
});
test("timeout fica incerto sem reenvio automático; cancelamento e anúncio alterado impedem disparo", async () => {
  unknown = true;
  const c = await draft();
  await dispatch(c);
  await worker.tick();
  await worker.tick();
  assert.equal(sent.length, 2);
  assert.equal(
    (await db.whatsappDelivery.findFirst({ where: { campaignId: c.id } }))
      .status,
    "UNCERTAIN",
  );
  unknown = false;
  const cancelled = await draft();
  await dispatch(cancelled);
  assert.equal(
    (await call(`/admin/whatsapp/campaigns/${cancelled.id}/cancel`, {})).status,
    200,
  );
  await worker.tick();
  assert.equal(sent.length, 2);
  const changed = await draft();
  await db.listing.update({
    where: { id: listing.id },
    data: { price: 20000000 },
  });
  assert.equal((await dispatch(changed)).status, 409);
});
test("configuração ausente bloqueia inscrição e envio, mas permite rascunho", async () => {
  const c = await draft();
  env.WHATSAPP_ENABLED = "false";
  assert.equal(whatsappSettings(env).enabled, false);
  assert.equal((await dispatch(c)).status, 503);
  assert.equal(
    (
      await call(
        "/whatsapp/subscribe",
        { phone, consent: true, consentVersion },
        null,
      )
    ).status,
    503,
  );
});
