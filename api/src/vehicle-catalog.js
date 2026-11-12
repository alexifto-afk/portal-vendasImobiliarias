import { z } from "zod";
const kinds = { CAR: "carros", MOTORCYCLE: "motos", TRUCK: "caminhoes" };
const id = z.string().regex(/^\d{1,8}$/);
const params = z.object({
  type: z.enum(["CAR", "MOTORCYCLE", "TRUCK"]),
  brand: id.optional(),
  model: id.optional(),
});
export function vehicleCatalog({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map(),
    pending = new Map();
  return async function load(input) {
    const { type, brand, model } = params.parse(input);
    const path = `${kinds[type]}/marcas${brand ? "/" + brand + "/modelos" : ""}${model ? "/" + model + "/anos" : ""}`;
    const hit = cache.get(path);
    if (hit?.until > now()) return hit.data;
    if (pending.has(path)) return pending.get(path);
    if (pending.size >= 8)
      throw Object.assign(
        Error("O catálogo está ocupado. Tente novamente em instantes."),
        { status: 503 },
      );
    const task = (async () => {
      try {
        const response = await fetcher(
          "https://parallelum.com.br/fipe/api/v1/" + path,
          {
            signal: AbortSignal.timeout(10000),
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) throw Error("provider");
        const raw = await response.json();
        const list = brand && !model ? raw.modelos : raw;
        if (!Array.isArray(list) || list.length > 15000) throw Error("payload");
        const data = list
          .map((item) => ({ id: String(item.codigo), name: String(item.nome) }))
          .filter(
            (item) =>
              item.name &&
              item.name.length <= (brand ? 100 : 60) &&
              (model ? /^\d{4}-\d+$/.test(item.id) : /^\d{1,8}$/.test(item.id)),
          );
        if (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(path, { data, until: now() + 86400000 });
        return data;
      } catch {
        throw Object.assign(
          Error(
            "O catálogo de veículos está indisponível. Tente novamente ou informe os dados manualmente.",
          ),
          { status: 503 },
        );
      } finally {
        pending.delete(path);
      }
    })();
    pending.set(path, task);
    return task;
  };
}
export function registerVehicleCatalog(app, { wrap, load = vehicleCatalog() }) {
  for (const path of [
    "/api/vehicles/:type/brands",
    "/api/vehicles/:type/brands/:brand/models",
    "/api/vehicles/:type/brands/:brand/models/:model/years",
  ]) {
    app.get(
      path,
      wrap(async (q, r) =>
        r
          .set("Cache-Control", "public, max-age=3600")
          .json(await load(q.params)),
      ),
    );
  }
}
