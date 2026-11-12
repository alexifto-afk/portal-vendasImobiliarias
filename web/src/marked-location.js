export function markedArea(latitude, longitude) {
  const snap = (value) =>
    Number((Math.round(value / 0.005) * 0.005).toFixed(3));
  return {
    latitude: snap(latitude),
    longitude: snap(longitude),
    radiusMeters: 500,
    level: "listing",
  };
}
