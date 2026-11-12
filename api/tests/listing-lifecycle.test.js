import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEditListing,
  canRenewListing,
  parseEdit,
} from "../src/listing-lifecycle.js";
const now = new Date("2026-11-12T12:00:00Z");
const listing = {
  revision: 0,
  status: "PUBLISHED",
  paidAt: new Date(),
  expiresAt: new Date("2026-11-13T12:00:00Z"),
  plan: "BASIC",
  type: "HOUSE",
  purpose: "SALE",
  termsVersion: "old",
};
test("edição termina exatamente no vencimento; renovação exige pagamento anterior e prazo encerrado", () => {
  assert.equal(canEditListing(listing, now), true);
  assert.equal(canRenewListing(listing, now), false);
  assert.equal(canEditListing({ ...listing, expiresAt: now }, now), false);
  assert.equal(canRenewListing({ ...listing, expiresAt: now }, now), true);
  for (const patch of [
    { paidAt: null },
    { deletedAt: now },
    { affiliateVoidedAt: now },
    { status: "CANCELLED" },
    { status: "CLOSED" },
  ]) {
    assert.equal(canEditListing({ ...listing, ...patch }, now), false);
    assert.equal(
      canRenewListing({ ...listing, expiresAt: now, ...patch }, now),
      false,
    );
  }
  assert.equal(
    canEditListing({ ...listing, expiresAt: null, status: "PENDING" }, now),
    true,
  );
});
test("edição usa lista de campos permitidos, protege contrato/plano e detecta versões antigas", () => {
  const body = {
    revision: 0,
    type: "HOUSE",
    purpose: "SALE",
    plan: "BASIC",
    title: "Casa editada de teste",
    description: "Descrição revisada e suficientemente longa do imóvel.",
    city: "Palmas",
    state: "TO",
    neighborhood: "Centro",
    ownerPhone: "63999999999",
    contactAccepted: true,
    price: 123000,
    area: 120,
    bedrooms: 2,
    images: ["/uploads/123e4567-e89b-42d3-a456-426614174000"],
    adPrice: 1,
    commissionBps: 9999,
    paidAt: now,
    expiresAt: "2099-01-01",
    partnerReward: 999999,
    couponCode: "FAKE",
    termsText: "fake",
  };
  const data = parseEdit(body, listing);
  for (const key of [
    "plan",
    "adPrice",
    "paidAt",
    "expiresAt",
    "partnerReward",
    "couponCode",
    "commissionBps",
    "termsText",
  ])
    assert.equal(key in data, false);
  assert.equal(data.price, 123000);
  assert.equal(data.contactMode, "DIRECT");
  assert.throws(
    () => parseEdit({ ...body, revision: 1 }, listing),
    (e) => e.status === 409,
  );
  assert.throws(
    () => parseEdit({ ...body, plan: "FEATURED" }, listing),
    (e) => e.status === 400,
  );
});

test("edição preserva URLs externas já existentes, sem aceitar novas URLs arbitrárias", () => {
  const l = { ...listing, images: ["https://example.com/original.jpg"] };
  const body = {
    revision: 0,
    type: "HOUSE",
    purpose: "SALE",
    plan: "BASIC",
    title: "Casa original de teste",
    description: "Descrição completa suficientemente longa para edição.",
    city: "Palmas",
    neighborhood: "Centro",
    ownerPhone: "63999999999",
    contactAccepted: true,
    price: 100000,
    area: 100,
    bedrooms: 0,
    images: l.images,
  };
  assert.deepEqual(parseEdit(body, l).images, l.images);
  assert.throws(() =>
    parseEdit({ ...body, images: ["https://example.com/other.jpg"] }, l),
  );
});
