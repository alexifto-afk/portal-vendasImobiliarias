export const normalizeLocation = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
export function selectedCity(cities, value, legacy) {
  const canonical = cities.find(
    (c) => normalizeLocation(c.name) === normalizeLocation(value.city),
  );
  if (canonical) return { name: canonical.name, legacy: false };
  if (
    legacy &&
    value.state === legacy.state &&
    value.city === legacy.city &&
    value.city
  )
    return { name: value.city, legacy: true };
  return { name: "", legacy: false };
}
