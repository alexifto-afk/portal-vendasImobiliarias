import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import {
  cityForState,
  normalizeCity,
  registerLocationRoutes,
} from "../src/locations.js";
import { listingSchema, listingSchemaFor } from "../src/listing-schema.js";
import { states } from "../src/classified-catalog.js";
test("base contém as 27 UFs e 5571 localidades, incluindo o município novo de Boa Esperança do Norte", () => {
  const data = JSON.parse(
    readFileSync(
      new URL("../data/brazil-cities.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(Object.keys(data).sort(), [...states].sort());
  assert.equal(
    Object.values(data).reduce((sum, uf) => sum + uf.cities.length, 0),
    5571,
  );
  const ids = Object.values(data).flatMap((uf) => uf.cities.map((c) => c[0]));
  assert.equal(new Set(ids).size, ids.length);
  for (const uf of Object.values(data))
    assert.deepEqual(
      uf.cities.map((c) => normalizeCity(c[1])),
      uf.cities.map((c) => normalizeCity(c[1])).sort(),
    );
  assert.equal(cityForState("MT", "Boa Esperança do Norte").id, "5101837");
  assert.equal(cityForState("TO", " araguaina ").name, "Araguaína");
  assert.equal(cityForState("TO", "São Paulo"), undefined);
});
test("rota retorna só cidades da UF escolhida, cacheia dados públicos e rejeita UF inválida", async () => {
  const app = express();
  registerLocationRoutes(app, {
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
  });
  app.use((e, q, r, n) => r.status(400).json({ error: "UF inválida" }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const root = `http://127.0.0.1:${server.address().port}/api/locations`;
    const r = await fetch(root + "/TO/cities"),
      cities = await r.json();
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /public/);
    assert.equal(cities.length, 139);
    assert.ok(cities.every((c) => c.id.startsWith("17")));
    assert.ok(cities.some((c) => c.name === "Palmas"));
    assert.ok(!cities.some((c) => c.name === "São Paulo"));
    assert.equal((await fetch(root + "/ZZ/cities")).status, 400);
  } finally {
    server.close();
  }
});
const listing = {
  title: "Casa de teste municipal",
  description:
    "Descrição suficientemente completa do imóvel que será anunciado.",
  type: "HOUSE",
  purpose: "SALE",
  plan: "BASIC",
  city: "Palmas",
  state: "TO",
  neighborhood: "Centro",
  ownerPhone: "63999999999",
  contactAccepted: true,
  price: 10000000,
  area: 100,
  bedrooms: 2,
  images: ["/uploads/123e4567-e89b-42d3-a456-426614174000"],
  termsAccepted: true,
  termsVersion: "current",
};
test("servidor valida UF/cidade mesmo se o navegador for burlado e normaliza o nome canônico", () => {
  assert.equal(
    listingSchema.parse({ ...listing, city: "araguaina" }).city,
    "Araguaína",
  );
  assert.equal(
    listingSchema.safeParse({ ...listing, city: "São Paulo" }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({ ...listing, state: "SP", city: "Palmas" })
      .success,
    false,
  );
});
test("localidade antiga pode ser mantida na edição, mas não escolhida para outro estado ou novo anúncio", () => {
  const old = { state: "TO", city: "Luzimangues" };
  assert.equal(
    listingSchemaFor([], old).parse({ ...listing, ...old }).city,
    "Luzimangues",
  );
  assert.equal(
    listingSchemaFor([], old).safeParse({
      ...listing,
      city: "Luzimangues",
      state: "SP",
    }).success,
    false,
  );
  assert.equal(listingSchema.safeParse({ ...listing, ...old }).success, false);
});
