import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vehicleCatalog,
  registerVehicleCatalog,
} from "../src/vehicle-catalog.js";
import express from "express";
test("catálogo usa somente caminhos FIPE validados e cacheia respostas sem consultar preço", async () => {
  const paths = [];
  const load = vehicleCatalog({
    fetcher: async (path) => {
      paths.push(path);
      return {
        ok: true,
        json: async () =>
          path.endsWith("/modelos")
            ? { modelos: [{ codigo: 1, nome: "Uno" }] }
            : [{ codigo: "21", nome: "Fiat" }],
      };
    },
  });
  assert.deepEqual(await load({ type: "CAR" }), [{ id: "21", name: "Fiat" }]);
  await load({ type: "CAR" });
  assert.equal(paths.length, 1);
  assert.deepEqual(await load({ type: "CAR", brand: "21" }), [
    { id: "1", name: "Uno" },
  ]);
  assert.match(paths[1], /carros\/marcas\/21\/modelos$/);
  await assert.rejects(load({ type: "CAR", brand: "../secrets" }));
  await assert.rejects(load({ type: "OTHER_VEHICLE" }));
  assert.equal(paths.length, 2);
});
test("falha do catálogo não é cacheada e permite tentar novamente", async () => {
  let calls = 0;
  const load = vehicleCatalog({
    fetcher: async () => {
      if (++calls === 1) throw Error("offline");
      return { ok: true, json: async () => [] };
    },
  });
  await assert.rejects(load({ type: "MOTORCYCLE" }), (e) => e.status === 503);
  assert.deepEqual(await load({ type: "MOTORCYCLE" }), []);
  assert.equal(calls, 2);
});
test("requisições simultâneas compartilham consulta e separam tipo, marca e modelo", async () => {
  let calls = 0;
  const load = vehicleCatalog({
    fetcher: async () => {
      calls++;
      return {
        ok: true,
        json: async () => [{ codigo: "2020-1", nome: "2020 Gasolina" }],
      };
    },
  });
  const data = await Promise.all([
    load({ type: "TRUCK", brand: "2", model: "3" }),
    load({ type: "TRUCK", brand: "2", model: "3" }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(data[0], [{ id: "2020-1", name: "2020 Gasolina" }]);
});
test("rotas públicas aceitam apenas tipos e identificadores válidos", async () => {
  const app = express();
  registerVehicleCatalog(app, {
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
    load: vehicleCatalog({
      fetcher: async () => ({ ok: true, json: async () => [] }),
    }),
  });
  app.use((e, q, r, n) => r.status(e.status || 400).json({ error: "catalog" }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const root = `http://127.0.0.1:${server.address().port}`;
    const valid = await fetch(
      root + "/api/vehicles/CAR/brands/21/models/4828/years",
    );
    assert.equal(valid.status, 200);
    assert.match(valid.headers.get("cache-control"), /max-age=3600/);
    assert.equal((await fetch(root + "/api/vehicles/FARM/brands")).status, 400);
    assert.equal(
      (await fetch(root + "/api/vehicles/CAR/brands/abc/models")).status,
      400,
    );
  } finally {
    server.close();
  }
});
