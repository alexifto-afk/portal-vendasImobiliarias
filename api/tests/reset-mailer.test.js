import { test } from "node:test";
import assert from "node:assert/strict";
import { createResetMailer } from "../src/reset-mailer.js";
import { resetCodeHash, resetEmailKey } from "../src/password-reset.js";
test("código fica vinculado à solicitação e HMAC não grava e-mail em claro", () => {
  const secret = "local-test-secret-not-a-real-credential-12345";
  assert.match(resetEmailKey(secret, "private@example.com"), /^[a-f0-9]{64}$/);
  assert.notEqual(
    resetCodeHash(secret, "first", "000123"),
    resetCodeHash(secret, "second", "000123"),
  );
  assert.notEqual(
    resetCodeHash(secret, "first", "000123"),
    resetCodeHash(secret, "first", "000124"),
  );
});
test("envio usa HTTPS, remetente configurado e idempotência sem retornar código", async () => {
  let outgoing;
  const mailer = createResetMailer(
    {
      RESEND_API_KEY: "local-fake-key",
      RESET_EMAIL_FROM: "LP Imóveis <no-reply@example.com>",
    },
    async (url, options) => {
      outgoing = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ id: "local-provider-id" }), {
        status: 200,
      });
    },
  );
  const response = await mailer.send({
    email: "private@example.com",
    code: "000123",
    requestId: "test-request",
  });
  assert.equal(mailer.configured, true);
  assert.equal(outgoing.url, "https://api.resend.com/emails");
  assert.equal(
    outgoing.options.headers["Idempotency-Key"],
    "password-reset-test-request",
  );
  assert.deepEqual(outgoing.body.to, ["private@example.com"]);
  assert.ok(outgoing.body.text.includes("000123"));
  assert.deepEqual(response, { accepted: true });
});
test("falha do provedor não expõe resposta livre ou credenciais; sem configuração não envia", async () => {
  const mailer = createResetMailer(
    { RESEND_API_KEY: "local-fake-key", RESET_EMAIL_FROM: "test@example.com" },
    async () =>
      new Response("secret code and private@example.com", { status: 422 }),
  );
  await assert.rejects(
    () =>
      mailer.send({
        email: "private@example.com",
        code: "000123",
        requestId: "test",
      }),
    (e) => e.status === 422 && !e.message.includes("secret"),
  );
  const unavailable = createResetMailer({}, () => {
    throw Error("não deveria chamar rede");
  });
  assert.equal(unavailable.configured, false);
  await assert.rejects(
    () => unavailable.send({}),
    (e) => e.status === 503,
  );
});
