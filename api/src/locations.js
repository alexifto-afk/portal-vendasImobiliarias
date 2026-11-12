import { readFileSync } from "node:fs";
import { z } from "zod";
import { states } from "./classified-catalog.js";
const data = JSON.parse(
  readFileSync(new URL("../data/brazil-cities.json", import.meta.url), "utf8"),
);
export const normalizeCity = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const lookups = new Map(
  Object.entries(data).map(([uf, row]) => [
    uf,
    new Map(
      row.cities.map(([id, name]) => [normalizeCity(name), { id, name }]),
    ),
  ]),
);
export const cityForState = (state, name) =>
  lookups.get(state)?.get(normalizeCity(name));
export function registerLocationRoutes(app, { wrap }) {
  app.get(
    "/api/locations/:state/cities",
    wrap(async (q, r) => {
      const state = z.enum(states).parse(q.params.state);
      r.set("Cache-Control", "public, max-age=86400").json(
        data[state].cities.map(([id, name]) => ({ id, name })),
      );
    }),
  );
}
