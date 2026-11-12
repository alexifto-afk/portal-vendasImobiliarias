import { markedArea } from "./marked-location.js";
import { z } from "zod";
import { states } from "./classified-catalog.js";
const inputSchema = z.object({
  city: z.string().trim().min(2).max(100),
  neighborhood: z.string().trim().max(100),
  state: z.enum(states),
});
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const fail = (status, message) => Object.assign(Error(message), { status });
const radians = (x) => (x * Math.PI) / 180;
function distance(a, b) {
  const lat = radians(b[0] - a[0]),
    lng = radians(b[1] - a[1]);
  const v =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(lng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(v)));
}
// A circle around a PUBLIC region's bounding box, never a property's address.
export function approximateArea(result, level) {
  // OSM place nodes have a synthetic bounding box (often +/-0.02°).
  // It is not the neighborhood boundary: use the public place reference instead.
  if (level === "neighborhood" && result.osm_type === "node") {
    const latitude = Number(result.lat),
      longitude = Number(result.lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -34 ||
      latitude > 6 ||
      longitude < -74 ||
      longitude > -28
    )
      return null;
    return {
      latitude: Math.round(latitude * 1000) / 1000,
      longitude: Math.round(longitude * 1000) / 1000,
      radiusMeters: 500,
      level,
    };
  }
  if (!Array.isArray(result.boundingbox) || result.boundingbox.length !== 4)
    return null;
  const [south, north, west, east] = result.boundingbox.map(Number);
  if (
    ![south, north, west, east].every(Number.isFinite) ||
    south < -34 ||
    north > 6 ||
    west < -74 ||
    east > -28 ||
    south >= north ||
    west >= east
  )
    return null;
  const latitude = Math.round(((south + north) / 2) * 1000) / 1000;
  const longitude = Math.round(((west + east) / 2) * 1000) / 1000;
  const radiusMeters = Math.max(
    level === "city" ? 5000 : 500,
    Math.ceil(
      (Math.max(
        ...[
          [south, west],
          [south, east],
          [north, west],
          [north, east],
        ].map((p) => distance([latitude, longitude], p)),
      ) +
        150) /
        250,
    ) * 250,
  );
  if (radiusMeters > 600000) return null;
  return { latitude, longitude, radiusMeters, level };
}
function candidate(data, region, requestedLevel) {
  if (!Array.isArray(data)) return null;
  for (const result of data.slice(0, 5)) {
    const address = result.address || {};
    if (
      address.country_code !== "br" ||
      address["ISO3166-2-lvl4"] !== "BR-" + region.state
    )
      continue;
    if (
      ![
        address.city,
        address.town,
        address.village,
        address.municipality,
        address.county,
      ].some((v) => normalize(v) === normalize(region.city))
    )
      continue;
    const neighborhood = [
      "neighbourhood",
      "suburb",
      "quarter",
      "city_district",
      "borough",
      "hamlet",
    ].includes(result.addresstype);
    const city = ["city", "town", "village", "municipality"].includes(
      result.addresstype,
    );
    // Reject streets, buildings, shops, schools and other points of interest.
    if (
      requestedLevel === "neighborhood" &&
      (!neighborhood ||
        ![
          result.name,
          address.neighbourhood,
          address.suburb,
          address.quarter,
          address.city_district,
          address.borough,
        ].some((v) => normalize(v) === normalize(region.neighborhood)))
    )
      continue;
    if (
      requestedLevel === "city" &&
      (!city || normalize(result.name) !== normalize(region.city))
    )
      continue;
    const area = approximateArea(result, requestedLevel);
    if (area) return area;
  }
  return null;
}
export function regionResolver({
  fetcher = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const cache = new Map(),
    pending = new Map(),
    queryCache = new Map(),
    queryPending = new Map();
  let queue = Promise.resolve(),
    nextAt = 0;
  function search(query) {
    const cached = queryCache.get(query);
    if (cached?.until > now()) return Promise.resolve(cached.data);
    if (queryPending.has(query)) return queryPending.get(query);
    const job = queue
      .catch(() => {})
      .then(async () => {
        await sleep(Math.max(0, nextAt - now()));
        nextAt = now() + 1100; // Nominatim public policy: at most one request/second.
        const params = new URLSearchParams({
          q: query,
          format: "jsonv2",
          addressdetails: "1",
          limit: "5",
          countrycodes: "br",
          "accept-language": "pt-BR",
        });
        const response = await fetcher(
          "https://nominatim.openstreetmap.org/search?" + params,
          {
            signal: AbortSignal.timeout(8000),
            headers: {
              Accept: "application/json",
              "User-Agent": "Negociee/1.0 (https://negociee.com)",
            },
          },
        );
        if (!response.ok) throw Error("geocoder");
        const raw = await response.json();
        if (!Array.isArray(raw)) throw Error("geocoder-response");
        const regionTypes = [
          "neighbourhood",
          "suburb",
          "quarter",
          "city_district",
          "borough",
          "hamlet",
          "city",
          "town",
          "village",
          "municipality",
        ];
        const data = raw
          .slice(0, 5)
          .filter((item) => regionTypes.includes(item.addresstype))
          .map((item) => ({
            name: item.name,
            osm_type: item.osm_type,
            lat: item.lat,
            lon: item.lon,
            addresstype: item.addresstype,
            boundingbox: item.boundingbox,
            address: Object.fromEntries(
              [
                "country_code",
                "ISO3166-2-lvl4",
                "city",
                "town",
                "village",
                "municipality",
                "county",
                "neighbourhood",
                "suburb",
                "quarter",
                "city_district",
                "borough",
              ].map((k) => [k, item.address?.[k]]),
            ),
          }));
        if (queryCache.size >= 200)
          queryCache.delete(queryCache.keys().next().value);
        queryCache.set(query, {
          data,
          until: now() + (data.length ? 7 * 86400000 : 30 * 60000),
        });
        return data;
      });
    queryPending.set(query, job);
    queue = job.catch(() => {}).finally(() => queryPending.delete(query));
    return job;
  }
  return async function resolve(input) {
    const region = inputSchema.parse(input);
    const key = JSON.stringify([
      region.state,
      normalize(region.city),
      normalize(region.neighborhood),
    ]);
    const existing = cache.get(key);
    if (existing?.until > now()) {
      if (!existing.area)
        throw fail(
          422,
          "Não foi possível localizar o bairro no mapa com segurança. Confirme a região com o anunciante.",
        );
      return { ...existing.area };
    }
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 4)
      throw fail(503, "O mapa está ocupado. Tente novamente em instantes.");
    const task = (async () => {
      try {
        let area = null;
        if (region.neighborhood)
          area = candidate(
            await search(
              `${region.neighborhood}, ${region.city}, ${region.state}, Brasil`,
            ),
            region,
            "neighborhood",
          );
        if (!area && !region.neighborhood)
          area = candidate(
            await search(`${region.city}, ${region.state}, Brasil`),
            region,
            "city",
          );
        if (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(key, {
          area,
          until: now() + (area ? 7 * 86400000 : 30 * 60000),
        });
        if (!area)
          throw fail(
            422,
            "Não foi possível localizar o bairro no mapa com segurança. Confirme a região com o anunciante.",
          );
        return { ...area };
      } catch (e) {
        if (e.status) throw e;
        throw fail(
          503,
          "O serviço de mapas está indisponível. Tente novamente ou confirme a região com o anunciante.",
        );
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, task);
    return task;
  };
}
export function registerListingRegionRoutes(
  app,
  {
    db,
    wrap,
    publicWhere,
    auth,
    requireAdvertiser,
    resolve = regionResolver(),
  },
) {
  app.post(
    "/api/owner/location-preview",
    auth,
    requireAdvertiser,
    wrap(async (q, r) => {
      const region = inputSchema.parse(q.body);
      let area;
      try {
        area = await resolve(region);
      } catch (error) {
        if (error.status !== 422) throw error;
        area = await resolve({ ...region, neighborhood: "" });
      }
      r.set("Cache-Control", "no-store").json(area);
    }),
  );
  app.get(
    "/api/listings/:id/region",
    wrap(async (q, r) => {
      const where = () => ({
        id: q.params.id,
        category: "REAL_ESTATE",
        ...publicWhere(),
      });
      const l = await db.listing.findFirst({
        where: where(),
        select: {
          city: true,
          state: true,
          neighborhood: true,
          locationLatitude: true,
          locationLongitude: true,
        },
      });
      if (!l) throw fail(404, "Imóvel indisponível.");
      const area =
        markedArea(l.locationLatitude, l.locationLongitude) ||
        (await resolve({
          city: l.city,
          state: l.state,
          neighborhood: l.neighborhood,
        }));
      // Publication can change while an external lookup is in progress.
      if (
        !(await db.listing.findFirst({ where: where(), select: { id: true } }))
      )
        throw fail(404, "Imóvel indisponível.");
      const label = (
        area.level === "city"
          ? [l.city, l.state]
          : [l.neighborhood, l.city, l.state]
      )
        .filter(Boolean)
        .join(" · ");
      r.set("Cache-Control", "no-store").json({ ...area, label });
    }),
  );
}
