import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  approximateArea,
  regionResolver,
  registerListingRegionRoutes,
} from "../src/listing-region.js";
const input = { city: "Tocantinópolis", state: "TO", neighborhood: "Centro" };
const neighborhood = {
  name: "Centro",
  addresstype: "suburb",
  boundingbox: ["-6.335", "-6.325", "-47.425", "-47.415"],
  address: {
    suburb: "Centro",
    town: "Tocantinópolis",
    "ISO3166-2-lvl4": "BR-TO",
    country_code: "br",
  },
};
const city = {
  ...neighborhood,
  name: "Tocantinópolis",
  addresstype: "town",
  boundingbox: ["-6.5", "-6.1", "-47.6", "-47.2"],
};
function fixture(results) {
  let time = 100000;
  const urls = [],
    times = [];
  const resolve = regionResolver({
    now: () => time,
    sleep: async (ms) => {
      time += ms;
    },
    fetcher: async (url) => {
      times.push(time);
      urls.push(url);
      return { ok: true, json: async () => results(url) };
    },
  });
  return { resolve, urls, times };
}
test("círculo cobre região pública, arredonda centro e mantém raio mínimo de 1 km", () => {
  const area = approximateArea(neighborhood, "neighborhood");
  assert.deepEqual(area, {
    latitude: -6.33,
    longitude: -47.42,
    radiusMeters: 1000,
    level: "neighborhood",
  });
  assert.ok(approximateArea(city, "city").radiusMeters > 5000);
  for (const boundingbox of [
    [],
    ["x", "-6", "-47", "-46"],
    ["-7", "-6", "-27", "-26"],
    ["-6", "-7", "-48", "-47"],
  ])
    assert.equal(approximateArea({ boundingbox }, "city"), null);
});
test("consulta usa só bairro/cidade/UF, compartilha concorrência e cacheia a região", async () => {
  const f = fixture(() => [neighborhood]);
  const [a, b] = await Promise.all([
    f.resolve({
      ...input,
      privateAddress: "Rua privada 123",
      ownerPhone: "63999999999",
    }),
    f.resolve(input),
  ]);
  assert.deepEqual(a, b);
  assert.equal(f.urls.length, 1);
  await f.resolve(input);
  assert.equal(f.urls.length, 1);
  assert.ok(!decodeURIComponent(f.urls[0]).includes("privada"));
  assert.ok(!f.urls[0].includes("63999999999"));
  assert.deepEqual(
    Object.keys(a).sort(),
    ["latitude", "longitude", "radiusMeters", "level"].sort(),
  );
});
test("não transforma escola/loja/endereço em pino; usa cidade e respeita intervalo do provedor", async () => {
  const f = fixture((url) =>
    new URL(url).searchParams.get("q").startsWith("Centro,")
      ? [
          {
            ...neighborhood,
            addresstype: "amenity",
            name: "Escola Centro",
            address: {
              ...neighborhood.address,
              house_number: "123",
              road: "Rua privada",
            },
          },
        ]
      : [city],
  );
  const area = await f.resolve(input);
  assert.equal(area.level, "city");
  assert.equal(f.urls.length, 2);
  assert.ok(f.times[1] - f.times[0] >= 1100);
});
test("região de outra cidade/UF não é exibida nem substituída por coordenadas inventadas", async () => {
  const f = fixture(() => [
    { ...neighborhood, address: { ...neighborhood.address, town: "Palmas" } },
    { ...city, address: { ...city.address, "ISO3166-2-lvl4": "BR-SP" } },
  ]);
  await assert.rejects(f.resolve(input), (e) => e.status === 422);
  await assert.rejects(f.resolve(input), (e) => e.status === 422);
  assert.equal(f.urls.length, 2);
});
test("indisponibilidade permite nova tentativa, sem cachear falha de rede", async () => {
  let fail = true;
  const resolve = regionResolver({
    sleep: async () => {},
    fetcher: async () => {
      if (fail) throw Error("network");
      return { ok: true, json: async () => [neighborhood] };
    },
  });
  await assert.rejects(resolve(input), (e) => e.status === 503);
  fail = false;
  assert.equal((await resolve(input)).level, "neighborhood");
});
test("rota seleciona só região pública e revalida disponibilidade após consultar o mapa", async () => {
  const queries = [],
    received = [];
  let visible = true,
    removeDuringLookup = false;
  const app = express();
  registerListingRegionRoutes(app, {
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
    publicWhere: () => ({
      status: "PUBLISHED",
      reviewed: true,
      paidAt: { not: null },
      expiresAt: { gt: new Date() },
      affiliateVoidedAt: null,
    }),
    db: {
      listing: {
        findFirst: async (args) => {
          queries.push(args);
          return visible ? (args.select.id ? { id: "listing" } : input) : null;
        },
      },
    },
    resolve: async (region) => {
      received.push(region);
      if (removeDuringLookup) visible = false;
      return approximateArea(neighborhood, "neighborhood");
    },
  });
  app.use((e, q, r, n) => r.status(e.status || 500).json({ error: e.message }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/listings/listing/region`;
  try {
    const ok = await fetch(url);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("cache-control"), "no-store");
    const data = await ok.json();
    assert.equal(data.label, "Centro · Tocantinópolis · TO");
    assert.deepEqual(queries[0].select, {
      city: true,
      state: true,
      neighborhood: true,
    });
    assert.equal(queries[0].where.category, "REAL_ESTATE");
    assert.equal(queries[0].where.status, "PUBLISHED");
    assert.deepEqual(received, [input]);
    visible = false;
    assert.equal((await fetch(url)).status, 404);
    visible = true;
    removeDuringLookup = true;
    assert.equal((await fetch(url)).status, 404);
  } finally {
    server.close();
  }
});
