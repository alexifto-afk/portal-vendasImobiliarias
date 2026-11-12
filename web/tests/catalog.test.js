import { test } from "node:test";
import assert from "node:assert/strict";
import { findListings, emptyFilters, areaLabel } from "../src/catalog.js";
const listings = [
  { id: 1, type: "HOUSE", purpose: "SALE", city: "Araguaína", price: 30000000 },
  { id: 2, type: "LOT", purpose: "SALE", city: "Palmas", price: 15000000 },
  { id: 3, type: "HOUSE", purpose: "RENT", city: "Palmas", price: 200000 },
];
test("catálogo abre com todos os imóveis e combina finalidade, cidade e preço em reais", () => {
  assert.deepEqual(findListings(listings, emptyFilters), listings);
  assert.deepEqual(
    findListings(listings, {
      ...emptyFilters,
      purpose: "RENT",
      city: " palmas ",
      maxPrice: "2000",
    }).map((l) => l.id),
    [3],
  );
  assert.equal(
    findListings(listings, {
      ...emptyFilters,
      purpose: "RENT",
      maxPrice: "1999",
    }).length,
    0,
  );
  assert.deepEqual(
    findListings(listings, {
      ...emptyFilters,
      type: "HOUSE",
      city: "araguaina",
    }).map((l) => l.id),
    [1],
  );
});
test("ordenação por preço não altera a ordem recomendada original", () => {
  assert.deepEqual(
    findListings(listings, emptyFilters, "price-asc").map((l) => l.id),
    [3, 2, 1],
  );
  assert.deepEqual(
    findListings(listings, emptyFilters, "price-desc").map((l) => l.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    listings.map((l) => l.id),
    [1, 2, 3],
  );
});
test("área rural aparece em hectares, casas e lotes em metros quadrados", () => {
  assert.equal(areaLabel({ type: "FARM", area: 960000 }), "96 ha");
  assert.equal(areaLabel({ type: "LOT", area: 360 }), "360 m²");
});
test("busca combina categoria, estado e texto dos produtos sem perder imóveis antigos", () => {
  const mixed = [
    ...listings,
    {
      id: 4,
      type: "CAR",
      category: "VEHICLES",
      state: "GO",
      title: "Carro econômico",
      description: "Revisado",
      details: { brand: "Fiat" },
      price: 4000000,
    },
  ];
  assert.deepEqual(
    findListings(mixed, {
      ...emptyFilters,
      category: "VEHICLES",
      state: "GO",
      search: "economico",
    }).map((l) => l.id),
    [4],
  );
  assert.deepEqual(
    findListings(mixed, {
      ...emptyFilters,
      category: "REAL_ESTATE",
      state: "TO",
    }).map((l) => l.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    findListings(mixed, { ...emptyFilters, search: "fiat" }).map((l) => l.id),
    [4],
  );
});
test("catálogo do frontend mantém o mesmo contrato de categorias e tipos da API", async () => {
  const web = await import("../src/classified-catalog.js");
  const api = await import("../../api/src/classified-catalog.js");
  assert.deepEqual(web.categories, api.categories);
  assert.deepEqual(web.states, api.states);
});
