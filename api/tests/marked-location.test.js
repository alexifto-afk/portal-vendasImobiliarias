import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { markedArea } from "../src/marked-location.js";
import { publicFields } from "../src/rules.js";
import { registerListingRegionRoutes } from "../src/listing-region.js";
test("círculo público arredonda em grade e não divulga o ponto reservado", () => {
  const area = markedArea(-5.648864, -48.1236783);
  assert.deepEqual(area, {
    latitude: -5.65,
    longitude: -48.125,
    radiusMeters: 500,
    level: "listing",
  });
  assert.notEqual(area.latitude, -5.648864);
  assert.notEqual(area.longitude, -48.1236783);
  for (const pair of [
    [null, null],
    [NaN, -48],
    [90, -48],
    [-5, 0],
    ["-5", "-48"],
  ])
    assert.equal(markedArea(...pair), null);
  assert.equal("locationLatitude" in publicFields, false);
  assert.equal("locationLongitude" in publicFields, false);
});
test("mapa usa ponto salvo sem geocodificar e prévia exige anunciante autenticado", async () => {
  const app = express();
  app.use(express.json());
  let visible = true;
  const resolved = [];
  const listing = {
    city: "Araguatins",
    state: "TO",
    neighborhood: "Centro",
    locationLatitude: -5.648864,
    locationLongitude: -48.1236783,
  };
  registerListingRegionRoutes(app, {
    db: {
      listing: {
        findFirst: async (args) =>
          visible ? (args.select.id ? { id: "ad" } : listing) : null,
      },
    },
    wrap: (fn) => (q, r, next) => Promise.resolve(fn(q, r)).catch(next),
    publicWhere: () => ({ status: "PUBLISHED", deletedAt: null }),
    auth: (q, r, next) => (q.get("Authorization") ? next() : r.sendStatus(401)),
    requireAdvertiser: (q, r, next) =>
      q.get("Authorization") === "owner" ? next() : r.sendStatus(403),
    resolve: async (data) => {
      resolved.push(data);
      return {
        latitude: -5.649,
        longitude: -48.124,
        radiusMeters: 500,
        level: "neighborhood",
      };
    },
  });
  app.use((error, q, r, next) =>
    r.status(error.status || 400).json({ error: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const root = `http://127.0.0.1:${server.address().port}/api`;
  try {
    let response = await fetch(root + "/listings/ad/region");
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.level, "listing");
    assert.equal(data.latitude, -5.65);
    assert.equal(data.label, "Centro · Araguatins · TO");
    assert.equal("locationLatitude" in data, false);
    assert.equal(resolved.length, 0);
    visible = false;
    assert.equal((await fetch(root + "/listings/ad/region")).status, 404);
    visible = true;
    const preview = async (user) =>
      fetch(root + "/owner/location-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user ? { Authorization: user } : {}),
        },
        body: JSON.stringify({ ...listing, privateAddress: "Rua privada 123" }),
      });
    assert.equal((await preview()).status, 401);
    assert.equal((await preview("partner")).status, 403);
    assert.equal((await preview("owner")).status, 200);
    assert.deepEqual(resolved, [
      { city: "Araguatins", state: "TO", neighborhood: "Centro" },
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
