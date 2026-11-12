import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  whatsappSettings,
  validMetaSignature,
  sendMarketingTemplate,
  campaignMessage,
} from "../src/whatsapp-campaigns.js";
const env = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_ACCESS_TOKEN: "fake-token-test-only",
  WHATSAPP_PHONE_NUMBER_ID: "1234",
  WHATSAPP_NUMBER: "5563999998888",
  WHATSAPP_APP_SECRET: "fake-secret",
  WHATSAPP_VERIFY_TOKEN: "fake-verify",
  WHATSAPP_MARKETING_TEMPLATE: "novos_anuncios",
};
test("envio exige habilitação explícita e todas as configurações válidas", () => {
  assert.equal(whatsappSettings({}).enabled, false);
  assert.equal(whatsappSettings(env).enabled, true);
  for (const key of Object.keys(env))
    assert.equal(whatsappSettings({ ...env, [key]: "" }).enabled, false);
  assert.equal(
    whatsappSettings({ ...env, WHATSAPP_PHONE_NUMBER_ID: "not-id" }).enabled,
    false,
  );
});
test("assinatura do webhook usa corpo original e rejeita corpo alterado ou segredo ausente", () => {
  const raw = Buffer.from('{"a":1}'),
    signature =
      "sha256=" +
      createHmac("sha256", env.WHATSAPP_APP_SECRET).update(raw).digest("hex");
  assert.equal(
    validMetaSignature(raw, signature, env.WHATSAPP_APP_SECRET),
    true,
  );
  assert.equal(
    validMetaSignature(
      Buffer.from('{"a":2}'),
      signature,
      env.WHATSAPP_APP_SECRET,
    ),
    false,
  );
  assert.equal(validMetaSignature(raw, signature, ""), false);
  assert.equal(
    validMetaSignature(raw, "invalid", env.WHATSAPP_APP_SECRET),
    false,
  );
});
test("adaptador usa modelo aprovado com uma variável e diferencia rejeição e resultado desconhecido", async () => {
  let sent;
  const id = await sendMarketingTemplate(
    { phone: "5563911111111" },
    { messageText: "Anúncios locais" },
    env,
    async (url, options) => {
      sent = { url, options };
      return {
        ok: true,
        json: async () => ({ messages: [{ id: "fake-id" }] }),
      };
    },
  );
  assert.equal(id, "fake-id");
  assert.match(sent.url, /graph.facebook.com\/v23.0\/1234\/messages/);
  const body = JSON.parse(sent.options.body);
  assert.equal(body.type, "template");
  assert.equal(body.template.name, "novos_anuncios");
  assert.equal(
    body.template.components[0].parameters[0].text,
    "Anúncios locais",
  );
  assert.equal(body.template.language.code, "pt_BR");
  await assert.rejects(
    sendMarketingTemplate(
      { phone: "test" },
      { messageText: "test" },
      env,
      async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 131026 } }),
      }),
    ),
    (error) => error.providerCode === "131026",
  );
  await assert.rejects(
    sendMarketingTemplate(
      { phone: "test" },
      { messageText: "test" },
      env,
      async () => {
        throw Error("timeout");
      },
    ),
    (error) => !error.providerCode,
  );
});
test("mensagem contém links individuais e identifica aluguel sem expor telefone do anunciante", () => {
  const result = campaignMessage(
    [
      {
        id: "ad",
        title: "Casa",
        price: 100000,
        purpose: "RENT",
        ownerPhone: "private",
      },
    ],
    "https://negociee.example",
  );
  assert.match(result, /anuncio=ad/);
  assert.match(result, /mês/);
  assert.ok(!result.includes("private"));
});

test("variável do modelo não contém quebras de linha, tabs ou espaços repetidos", () => {
  const value = campaignMessage(
    [
      { id: "one", title: "Casa\n\t    nova", price: 100, purpose: "SALE" },
      { id: "two", title: "Carro", price: 200, purpose: "SALE" },
    ],
    "https://negociee.example",
  );
  assert.ok(!/[\n\r\t]| {4}/.test(value));
});
