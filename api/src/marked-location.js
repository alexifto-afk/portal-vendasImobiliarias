// Exact advertiser coordinates stay private. A public 0.005° grid cell is
// roughly 550 m across; the 500 m circle covers its furthest corner in Brazil.
export function markedArea(latitude, longitude) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -34 ||
    latitude > 6 ||
    longitude < -74 ||
    longitude > -28
  )
    return null;
  const snap = (value) =>
    Number((Math.round(value / 0.005) * 0.005).toFixed(3));
  return {
    latitude: snap(latitude),
    longitude: snap(longitude),
    radiusMeters: 500,
    level: "listing",
  };
}
