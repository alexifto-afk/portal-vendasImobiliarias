import { test } from "node:test";
import assert from "node:assert/strict";
import { couponCode, couponPrice, partnerBalances } from "../src/partners.js";
const now = new Date("2026-11-11T12:00:00Z");
const coupon = {
  code: "MARIA",
  active: true,
  partner: { active: true, userId: "blogger" },
  expiresAt: "2026-12-01T12:00:00Z",
  plans: ["BASIC"],
  reservations: 0,
  maxUses: 2,
  discountCents: 500,
  rewardCents: 500,
  createdAt: now,
};
test("cupom normaliza código e preço em centavos sem mudar a comissão do imóvel", () => {
  assert.equal(couponCode.parse(" maria "), "MARIA");
  assert.deepEqual(couponPrice(coupon, 2990, "BASIC", "buyer", now), {
    code: "MARIA",
    version: now.toISOString(),
    originalPrice: 2990,
    discount: 500,
    finalPrice: 2490,
    plan: "BASIC",
  });
  assert.throws(() => couponCode.parse("MARIA<script>"));
});
test("cupom bloqueia autoindicação, vencimento, limite, plano e preço incompatíveis", () => {
  for (const [c, price, plan, buyer] of [
    [coupon, 2990, "BASIC", "blogger"],
    [null, 2990, "BASIC", "buyer"],
    [{ ...coupon, active: false }, 2990, "BASIC", "buyer"],
    [
      { ...coupon, partner: { ...coupon.partner, active: false } },
      2990,
      "BASIC",
      "buyer",
    ],
    [{ ...coupon, expiresAt: now }, 2990, "BASIC", "buyer"],
    [{ ...coupon, reservations: 2 }, 2990, "BASIC", "buyer"],
    [coupon, 2990, "FEATURED", "buyer"],
    [coupon, 500, "BASIC", "buyer"],
    [coupon, 999, "BASIC", "buyer"],
  ])
    assert.throws(() => couponPrice(c, price, plan, buyer, now));
});
test("extrato separa prazo, reserva e pagamento; estorno pago vira débito disponível", () => {
  const entry = { amount: 500, availableAt: now };
  assert.deepEqual(
    partnerBalances(
      [
        { ...entry, availableAt: "2026-11-20" },
        entry,
        { ...entry, payout: { status: "REQUESTED" } },
        { ...entry, payout: { status: "PAID" } },
        { ...entry, amount: -500 },
      ],
      now,
    ),
    { pending: 500, available: 0, reserved: 500, paid: 500 },
  );
});
