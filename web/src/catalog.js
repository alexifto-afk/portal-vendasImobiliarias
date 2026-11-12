import { categoryFor, listingFeatures } from "./classified-catalog.js";
export const emptyFilters = {
  purpose: "",
  category: "",
  type: "",
  city: "",
  state: "",
  search: "",
  maxPrice: "",
};
const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function findListings(listings, filters, sort = "recommended") {
  const result = listings.filter(
    (l) =>
      (!filters.category ||
        (l.category || categoryFor(l.type)) === filters.category) &&
      (!filters.state || (l.state || "TO") === filters.state) &&
      (!filters.search ||
        normalize(
          `${l.title} ${l.description || ""} ${Object.values(l.details || {}).join(" ")}`,
        ).includes(normalize(filters.search))) &&
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
  if ((listing.category || categoryFor(listing.type)) !== "REAL_ESTATE")
    return listingFeatures(listing).join(" · ");
  return listing.type === "FARM" && listing.area >= 10000
    ? `${(listing.area / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`
    : `${listing.area.toLocaleString("pt-BR")} m²`;
}
