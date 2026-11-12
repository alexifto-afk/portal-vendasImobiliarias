import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commission,
  paymentMatches,
  isPublic,
  publicFields,
  terms,
} from "../src/rules.js";
test("comissão em centavos, com arredondamento e validação", () => {
  assert.equal(commission(68000000, 600), 4080000);
  assert.equal(commission(1999, 500), 100);
  assert.equal(commission(200000, 10000), 200000);
  for (const [v, b] of [
    [-1, 600],
    [1, 10001],
    [1, 0.5],
    [1.5, 600],
  ])
    assert.throws(() => commission(v, b));
});
const listing = { id: "imovel-1", adPrice: 2990 };
const payment = {
  id: 123,
  status: "approved",
  live_mode: true,
  currency_id: "BRL",
  external_reference: "imovel-1",
  transaction_amount: 29.9,
  collector_id: 42,
};
test("somente confirmação do PSP com valor, destinatário, moeda e referência correspondentes", () => {
  assert.equal(paymentMatches(payment, listing, "42"), true);
  for (const patch of [
    { status: "pending" },
    { status: "refunded" },
    { live_mode: false },
    { currency_id: "USD" },
    { external_reference: "outro" },
    { transaction_amount: 59.9 },
    { collector_id: 77 },
    { id: null },
  ])
    assert.equal(
      paymentMatches({ ...payment, ...patch }, listing, "42"),
      false,
    );
});
test("anúncio exige pagamento, revisão, publicação e prazo vigente", () => {
  const now = new Date("2026-11-10");
  const l = {
    status: "PUBLISHED",
    paidAt: now,
    reviewed: true,
    expiresAt: new Date("2026-12-10"),
  };
  assert.equal(isPublic(l, now), true);
  for (const patch of [
    { status: "PENDING" },
    { status: "REJECTED" },
    { status: "CLOSED" },
    { paidAt: null },
    { affiliateVoidedAt: now },
    { reviewed: false },
    { expiresAt: new Date("2026-11-09") },
  ])
    assert.equal(isPublic({ ...l, ...patch }, now), false);
});
test("projeção pública não inclui contatos privados, proprietário ou endereço exato", () => {
  for (const field of [
    "ownerId",
    "owner",
    "ownerPhone",
    "privateAddress",
    "termsText",
    "checkoutUrl",
    "paymentId",
  ])
    assert.equal(field in publicFields, false);
});
test("condições de classificados removem comissão, autorizam contato e preservam preço", () => {
  const c = {
    durationDays: 30,
    adPrice: 5990,
    brokerName: "Lourival",
    brokerCreci: "778D-22",
    saleCommissionBps: 600,
    rentCommissionBps: 10000,
  };
  assert.match(terms(c, "SALE"), /Não há comissão/);
  assert.match(
    terms(c, "SALE"),
    /WhatsApp informado no anúncio para contato direto/,
  );
  assert.match(terms(c, "RENT"), /Não há comissão/);
  assert.match(terms(c, "SALE"), /59.90/);
});
