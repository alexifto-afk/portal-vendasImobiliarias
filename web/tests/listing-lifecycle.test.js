import { test } from "node:test";
import assert from "node:assert/strict";
import { listingState, listingFormValues } from "../src/listing-lifecycle.js";
import { createListingCheckout } from "../src/listing-checkout.js";
const now = new Date("2026-11-12T12:00:00Z");
const l = {
  id: "old",
  paidAt: now,
  status: "PUBLISHED",
  expiresAt: "2026-11-12T12:00:00Z",
};
test("painel identifica vencimento mesmo sem mudar status no banco e não oferece duas renovações", () => {
  assert.equal(listingState(l, [], now).label, "Prazo encerrado");
  assert.equal(listingState(l, [], now).editable, false);
  assert.equal(listingState(l, [], now).renewable, true);
  assert.equal(
    listingState(l, [{ id: "new", renewalOfId: "old" }], now).renewable,
    false,
  );
  assert.equal(
    listingState({ ...l, status: "PENDING", expiresAt: null }, [], now).label,
    "Em análise",
  );
});
test("renovação paga reutilizada não inicia outro checkout", async () => {
  const calls = [];
  const result = await createListingCheckout(
    async (path) => {
      calls.push(path);
      return { id: "new", paidAt: now };
    },
    {},
    () => {},
    {},
    "/owner/listings/old/renew",
  );
  assert.deepEqual(calls, ["/owner/listings/old/renew"]);
  assert.equal(result.paid, true);
});
test("editor preenche preço em reais e não perde zero km", () => {
  const v = listingFormValues({
    type: "CAR",
    purpose: "SALE",
    title: "Carro",
    price: 12345,
    area: 0,
    bedrooms: 0,
    details: { brand: "Fiat", model: "Uno", year: 2020, mileage: 0 },
    city: "Palmas",
    neighborhood: "Centro",
    ownerPhone: "63999999999",
  });
  assert.equal(v.price, "123.45");
  assert.equal(v.mileage, "0");
  assert.equal(v.brand, "Fiat");
});
