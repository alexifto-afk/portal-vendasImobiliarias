import { test } from "node:test";
import assert from "node:assert/strict";
import { selectedCity } from "../src/location-options.js";
import { findListings, emptyFilters } from "../src/catalog.js";
test("seleção reconhece nomes com/sem acento e preserva somente localidade antiga da mesma UF", () => {
  const cities = [
    { id: "1", name: "Araguaína" },
    { id: "2", name: "Palmas" },
  ];
  assert.deepEqual(selectedCity(cities, { state: "TO", city: "araguaina" }), {
    name: "Araguaína",
    legacy: false,
  });
  assert.deepEqual(
    selectedCity(
      cities,
      { state: "TO", city: "Luzimangues" },
      { state: "TO", city: "Luzimangues" },
    ),
    { name: "Luzimangues", legacy: true },
  );
  assert.deepEqual(
    selectedCity(
      cities,
      { state: "SP", city: "Luzimangues" },
      { state: "TO", city: "Luzimangues" },
    ),
    { name: "", legacy: false },
  );
});
test("município escolhido com UF não inclui municípios que só compartilham prefixo do nome", () => {
  const items = [
    { id: 1, state: "SC", city: "São José", price: 1000 },
    { id: 2, state: "SC", city: "São José do Cedro", price: 1000 },
  ];
  assert.deepEqual(
    findListings(items, { ...emptyFilters, state: "SC", city: "São José" }).map(
      (l) => l.id,
    ),
    [1],
  );
});
