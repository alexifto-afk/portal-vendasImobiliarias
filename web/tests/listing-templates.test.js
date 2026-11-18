import { test } from "node:test";
import assert from "node:assert/strict";
import { typeNames } from "../src/classified-catalog.js";
import {
  listingTemplate,
  templateProfiles,
  hasTemplatePlaceholders,
} from "../src/listing-templates.js";
test("todos os 19 tipos têm modelo próprio de título e descrição para venda e aluguel", () => {
  assert.deepEqual(
    Object.keys(templateProfiles).sort(),
    Object.keys(typeNames).sort(),
  );
  const descriptions = new Set();
  for (const type of Object.keys(typeNames))
    for (const purpose of ["SALE", "RENT"]) {
      const result = listingTemplate({ type, purpose });
      assert.ok(
        result.title.length >= 8 && result.title.length <= 100,
        `${type}: ${result.title}`,
      );
      assert.ok(
        result.description.length >= 30 && result.description.length <= 5000,
        type,
      );
      assert.ok(
        result.title.includes(purpose === "RENT" ? "para alugar" : "à venda"),
      );
      assert.ok(hasTemplatePlaceholders(result.title));
      assert.ok(hasTemplatePlaceholders(result.description));
      assert.ok(result.description.includes("botão de contato"));
      if (purpose === "SALE") descriptions.add(result.description);
    }
  assert.equal(descriptions.size, Object.keys(typeNames).length);
});
test("modelo reaproveita dados informados sem inventar fatos e respeita zero km e zero quartos", () => {
  const car = listingTemplate({
    type: "CAR",
    purpose: "SALE",
    brand: "Fiat",
    model: "Uno",
    year: "2020",
    mileage: "0",
    condition: "USED",
  });
  assert.match(car.title, /Fiat Uno 2020/);
  assert.match(car.description, /Quilometragem: 0 km/);
  assert.match(car.description, /Condição: Usado/);
  const house = listingTemplate({
    type: "HOUSE",
    purpose: "RENT",
    city: "Palmas",
    neighborhood: "Centro",
    state: "TO",
    area: "120",
    bedrooms: "0",
  });
  assert.match(house.description, /Centro · Palmas · TO/);
  assert.match(house.description, /120 m²/);
  assert.match(house.description, /Quartos: 0/);
  assert.match(house.description, /condições do aluguel/);
  assert.ok(!house.description.includes("documentação em dia"));
  assert.match(
    listingTemplate({ type: "HOUSE", state: "TO" }).description,
    /\[preencha: bairro e cidade\]/,
  );
});
test("modelos preservam o objeto original e títulos cabem mesmo com campos longos", () => {
  const original = {
    type: "CAR",
    brand: "a".repeat(60),
    model: "b".repeat(100),
    year: "2026",
    description: "Texto próprio",
    title: "Meu título",
  };
  const before = JSON.stringify(original),
    model = listingTemplate(original);
  assert.equal(JSON.stringify(original), before);
  assert.ok(model.title.length <= 100);
  assert.ok(model.title.endsWith("[preencha: destaque]"));
  assert.ok(
    listingTemplate({ type: "HOUSE", city: "a".repeat(100) }).title.length <=
      100,
  );
});
test("somente o marcador do modelo bloqueia publicação, não colchetes usados em textos comuns", () => {
  for (const text of [
    "[preencha: cor]",
    "[PREENCHA: dados]",
    "[preencha : dados]",
    "[preencha:",
  ])
    assert.ok(hasTemplatePlaceholders(text));
  for (const text of [
    "Produto [novo]",
    "Apartamento com [2 quartos]",
    "Completo",
    null,
  ])
    assert.equal(hasTemplatePlaceholders(text), false);
});
