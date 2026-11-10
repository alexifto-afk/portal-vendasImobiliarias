export const emptyFilters = { purpose: "", type: "", city: "", maxPrice: "" };
const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function findListings(listings, filters, sort = "recommended") {
  const result = listings.filter(
    (l) =>
      (!filters.purpose || l.purpose === filters.purpose) &&
      (!filters.type || l.type === filters.type) &&
      (!filters.city || normalize(l.city).includes(normalize(filters.city))) &&
      (!filters.maxPrice || l.price <= Number(filters.maxPrice) * 100),
  );
  if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
  return result;
}
export function areaLabel(listing) {
  return listing.type === "FARM" && listing.area >= 10000
    ? `${(listing.area / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`
    : `${listing.area.toLocaleString("pt-BR")} m²`;
}
