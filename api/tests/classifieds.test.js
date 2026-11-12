import { test } from "node:test";
import assert from "node:assert/strict";
import { listingSchema, whatsappFor } from "../src/listing-schema.js";
const base = {
  title: "Anúncio de teste",
  description: "Descrição de teste suficientemente detalhada para anúncio.",
  type: "HOUSE",
  purpose: "SALE",
  plan: "BASIC",
  city: "Palmas",
  neighborhood: "Centro",
  ownerPhone: "(63) 99999-9999",
  price: 100000,
  area: 100,
  bedrooms: 2,
  images: ["/uploads/123e4567-e89b-42d3-a456-426614174000"],
  contactAccepted: true,
  termsAccepted: true,
  termsVersion: "current",
};
test("cadastro exige consentimento de contato e deriva categoria sem aceitar comissão adulterada", () => {
  const d = listingSchema.parse({
    ...base,
    commissionBps: 600,
    category: "VEHICLES",
  });
  assert.equal(d.category, "REAL_ESTATE");
  assert.equal(d.ownerPhone, "63999999999");
  assert.equal(d.contactMode, "DIRECT");
  assert.equal("commissionBps" in d, false);
  for (const patch of [
    { contactAccepted: false },
    { contactAccepted: undefined },
    { area: 0 },
    { ownerPhone: "123" },
  ])
    assert.equal(listingSchema.safeParse({ ...base, ...patch }).success, false);
});
test("veículos exigem marca, modelo, ano, km; zero km é válido e não pede área", () => {
  const car = {
    ...base,
    type: "CAR",
    area: 0,
    bedrooms: 0,
    details: {
      brand: "Fiat",
      model: "Uno",
      year: 2020,
      mileage: 0,
      condition: "USED",
    },
  };
  assert.equal(listingSchema.parse(car).category, "VEHICLES");
  for (const key of ["brand", "model", "year", "mileage"]) {
    const details = { ...car.details };
    delete details[key];
    assert.equal(listingSchema.safeParse({ ...car, details }).success, false);
  }
  assert.equal(listingSchema.safeParse({ ...car, area: 10 }).success, false);
});
test("produtos aceitam condição e campos próprios sem exigir dados de imóvel ou veículo", () => {
  for (const [type, category] of [
    ["PHONE", "ELECTRONICS"],
    ["APPLIANCE", "HOME"],
    ["FARM_MACHINE", "RURAL"],
    ["OTHER", "OTHER"],
  ]) {
    assert.equal(
      listingSchema.parse({
        ...base,
        type,
        area: 0,
        bedrooms: 0,
        details: { condition: "USED" },
      }).category,
      category,
    );
  }
  assert.equal(
    listingSchema.safeParse({
      ...base,
      type: "PHONE",
      area: 0,
      bedrooms: 0,
      details: { condition: "USED", mileage: 10 },
    }).success,
    false,
  );
});
test("WhatsApp usa somente número autorizado do anúncio e não disponibiliza contatos antigos privados", () => {
  const l = {
    id: "anuncio",
    title: "Carro & moto",
    ownerPhone: "63999999999",
    contactMode: "DIRECT",
  };
  assert.match(whatsappFor(l), /^https:\/\/wa.me\/5563999999999\?text=/);
  assert.match(decodeURIComponent(whatsappFor(l)), /Carro & moto/);
  assert.equal(whatsappFor({ ...l, contactMode: "PRIVATE" }), null);
  assert.equal(whatsappFor({ ...l, ownerPhone: "invalid" }), null);
});
