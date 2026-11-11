import { test } from "node:test";
import assert from "node:assert/strict";
import {
  payerSchema,
  preferencePayload,
  testOrderPayload,
  validCpf,
} from "../src/payment-payloads.js";
test("dados de cobrança validam nome, sobrenome e dígitos do CPF sem inventar dados ausentes", () => {
  assert.equal(validCpf("123.456.789-09"), true);
  assert.equal(validCpf("11111111111"), false);
  assert.equal(validCpf("12345678900"), false);
  assert.throws(() =>
    payerSchema.parse({ firstName: "Ana", lastName: "", cpf: "12345678909" }),
  );
  assert.throws(() =>
    payerSchema.parse({
      firstName: "Ana",
      lastName: "Silva",
      cpf: "12345678900",
    }),
  );
  assert.deepEqual(
    payerSchema.parse({
      firstName: " Ana ",
      lastName: " Silva ",
      cpf: "123.456.789-09",
    }),
    { firstName: "Ana", lastName: "Silva", cpf: "12345678909" },
  );
});
test("preferência usa preço do anúncio, data real de cadastro, dados do pagador e descrição do serviço", () => {
  const listing = {
      id: "imovel",
      title: "Casa",
      durationDays: 30,
      adPrice: 2990,
      plan: "BASIC",
    },
    user = {
      email: "owner@example.com",
      createdAt: new Date("2026-01-05T10:00:00Z"),
    },
    payer = { firstName: "Ana", lastName: "Silva", cpf: "12345678909" };
  const body = preferencePayload(
    listing,
    user,
    payer,
    "https://portal.example",
  );
  assert.equal(body.items[0].unit_price, 29.9);
  assert.equal(body.items[0].category_id, "services");
  assert.match(body.items[0].description, /divulgação/);
  assert.equal(body.payer.name, "Ana");
  assert.equal(body.payer.surname, "Silva");
  assert.equal(body.payer.email, "owner@example.com");
  assert.equal(body.payer.registration_date, "2026-01-05T10:00:00.000Z");
  assert.deepEqual(body.payer.identification, {
    type: "CPF",
    number: payer.cpf,
  });
  assert.equal(
    body.back_urls.success,
    "https://portal.example/?payment=returned",
  );
  assert.ok(!JSON.stringify(body).includes("buyer@email.com"));
});
test("ordem administrativa inclui metadados de qualidade apenas de simulação no formato Orders", () => {
  const body = testOrderPayload("portal-test-abc", "10.00");
  assert.equal(body.total_amount, "10.00");
  assert.equal(body.payer.first_name, "APRO");
  assert.equal(body.payer.last_name, "Teste");
  assert.equal(body.payer.identification.number, "12345678909");
  assert.equal(body.items[0].category_id, "services");
  assert.equal(body.items[0].unit_price, "10.00");
  assert.ok(body.items[0].description);
  assert.ok(
    !Number.isNaN(Date.parse(body.additional_info["payer.registration_date"])),
  );
  assert.equal(body.external_reference, "portal-test-abc");
});

test("Orders inclui retorno HTTPS, identificação de fatura e 3DS obrigatório", () => {
  const body = testOrderPayload("reference", "10.00", {
    origin: "https://portal.example/",
    descriptor: "LPIMOVEIS",
  });
  assert.equal(body.config.statement_descriptor, "LPIMOVEIS");
  assert.equal(
    body.config.online.transaction_security.validation,
    "on_fraud_risk",
  );
  assert.equal(
    body.config.online.transaction_security.liability_shift,
    "required",
  );
  assert.equal(
    body.config.online.success_url,
    "https://portal.example/?payment=returned&flow=test",
  );
  assert.equal(
    body.config.online.failure_url,
    "https://portal.example/?payment=failure&flow=test",
  );
  assert.equal(
    body.config.online.pending_url,
    "https://portal.example/?payment=pending&flow=test",
  );
  assert.throws(
    () => testOrderPayload("ref", "10.00", { origin: "http://portal.example" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      testOrderPayload("ref", "10.00", {
        origin: "https://portal.example",
        descriptor: "12345678901234",
      }),
    /MP_STATEMENT_DESCRIPTOR/,
  );
});
