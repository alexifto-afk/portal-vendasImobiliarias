export function listingRegion(listing) {
  return [listing.neighborhood, listing.city, listing.state || "TO", "Brasil"]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
}
export function regionMaps(listing) {
  const query = encodeURIComponent(listingRegion(listing));
  return {
    embed: `https://maps.google.com/maps?q=${query}&z=13&output=embed`,
    external: `https://www.google.com/maps/search/?api=1&query=${query}`,
  };
}
