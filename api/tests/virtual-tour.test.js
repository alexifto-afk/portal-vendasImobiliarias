import { test } from "node:test";
import assert from "node:assert/strict";
import { tourLink } from "../src/tour-links.js";
import { tourLink as browserTourLink } from "../../web/src/tour-links.js";
import { listingSchema } from "../src/listing-schema.js";
const cases = [
  [
    "https://my.matterport.com/show/?m=SxQL3iGyoDo&utm_source=test#fragment",
    "https://my.matterport.com/show/?m=SxQL3iGyoDo",
    "Matterport",
  ],
  [
    "https://kuula.co/post/7m2Gb?logo=0",
    "https://kuula.co/share/7m2Gb",
    "Kuula",
  ],
  [
    "https://kuula.co/share/collection/7qVGJ",
    "https://kuula.co/share/collection/7qVGJ",
    "Kuula",
  ],
  [
    "https://sketchfab.com/3d-models/car-0123456789abcdef0123456789abcdef",
    "https://sketchfab.com/models/0123456789abcdef0123456789abcdef",
    "Sketchfab",
  ],
  [
    "https://sketchfab.com/models/0123456789abcdef0123456789abcdef/embed?autostart=1",
    "https://sketchfab.com/models/0123456789abcdef0123456789abcdef",
    "Sketchfab",
  ],
];
test("links públicos são normalizados e o parser do navegador coincide com o da API", () => {
  for (const [input, url, provider] of cases) {
    const actual = tourLink(input);
    assert.equal(actual.url, url);
    assert.equal(actual.provider, provider);
    assert.deepEqual(browserTourLink(input), actual);
    assert.ok(actual.embedUrl.startsWith("https://"));
  }
});
test("links arbitrários, credenciais, javascript e domínios parecidos são recusados", () => {
  for (const input of [
    null,
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "http://kuula.co/post/7m2Gb",
    "https://kuula.co.evil.test/post/7m2Gb",
    "https://kuula.co@evil.test/post/7m2Gb",
    "https://user:password@kuula.co/post/7m2Gb",
    "https://kuula.co:8443/post/7m2Gb",
    "https://127.0.0.1/tour",
    "https://my.matterport.com/show/?m=bad",
    "https://my.matterport.com/show/?m=SxQL3iGyoDo&m=other",
    "https://kuula.co/profile/test",
    "https://sketchfab.com/3d-models/not-a-model",
    "https://evil.test/iframe",
    "https://kuula.co/post/" + "a".repeat(900),
  ]) {
    assert.equal(tourLink(input), null, input);
    assert.equal(browserTourLink(input), null, input);
  }
});
const base = {
  title: "Anúncio de teste",
  description: "Descrição suficientemente completa para testar o tour virtual.",
  type: "HOUSE",
  purpose: "SALE",
  plan: "BASIC",
  city: "Palmas",
  state: "TO",
  neighborhood: "Centro",
  ownerPhone: "63999999999",
  contactAccepted: true,
  price: 100000,
  area: 100,
  bedrooms: 2,
  details: {},
  images: ["/uploads/123e4567-e89b-42d3-a456-426614174000"],
  termsAccepted: true,
  termsVersion: "current",
};
test("tour é opcional, pode ser removido e funciona para todas as categorias sem alterar preço ou comissão", () => {
  assert.equal(listingSchema.parse(base).virtualTourUrl, null);
  for (const value of ["", null, "   "])
    assert.equal(
      listingSchema.parse({ ...base, virtualTourUrl: value }).virtualTourUrl,
      null,
    );
  for (const item of [
    {},
    {
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
    },
    { type: "APPLIANCE", area: 0, bedrooms: 0, details: { condition: "USED" } },
    {
      type: "FARM_MACHINE",
      area: 0,
      bedrooms: 0,
      details: { condition: "USED" },
    },
  ]) {
    const parsed = listingSchema.parse({
      ...base,
      ...item,
      virtualTourUrl: cases[0][0],
    });
    assert.equal(parsed.virtualTourUrl, cases[0][1]);
    assert.equal(parsed.price, base.price);
  }
  assert.equal(
    listingSchema.safeParse({ ...base, virtualTourUrl: "https://evil.test/x" })
      .success,
    false,
  );
});

test("edição pode remover o tour sem aceitar alterações financeiras", async () => {
  const { parseEdit } = await import("../src/listing-lifecycle.js");
  const original = { ...base, revision: 0, virtualTourUrl: cases[0][1] };
  const result = parseEdit(
    {
      ...base,
      revision: 0,
      virtualTourUrl: "",
      adPrice: 1,
      paidAt: "2099-01-01",
    },
    original,
  );
  assert.equal(result.virtualTourUrl, null);
  assert.equal("adPrice" in result, false);
  assert.equal("paidAt" in result, false);
});
