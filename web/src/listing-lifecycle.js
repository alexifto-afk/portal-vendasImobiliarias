export function listingState(l, items = [], now = new Date()) {
  const expired = Boolean(l.expiresAt) && new Date(l.expiresAt) <= now;
  const terminal =
    Boolean(l.deletedAt || l.affiliateVoidedAt) ||
    ["CLOSED", "CANCELLED"].includes(l.status);
  const renewal = items.find(
    (item) => item.renewalOfId === l.id && !item.deletedAt,
  );
  return {
    expired,
    renewal,
    editable: !terminal && Boolean(l.paidAt) && !expired,
    renewable: !terminal && Boolean(l.paidAt) && expired && !renewal,
    label: l.deletedAt
      ? "Excluído"
      : l.affiliateVoidedAt
        ? "Pagamento estornado"
        : terminal
          ? "Encerrado"
          : expired
            ? "Prazo encerrado"
            : l.paidAt && l.status === "PENDING"
              ? "Em análise"
              : null,
  };
}
export function listingFormValues(l) {
  return {
    type: l.type,
    purpose: l.purpose,
    title: l.title,
    description: l.description,
    price: String(l.price / 100),
    area: String(l.area),
    bedrooms: String(l.bedrooms),
    brand: l.details?.brand || "",
    model: l.details?.model || "",
    year: String(l.details?.year || ""),
    mileage: String(l.details?.mileage ?? ""),
    condition: l.details?.condition || "USED",
    city: l.city,
    state: l.state || "TO",
    neighborhood: l.neighborhood,
    ownerPhone: l.ownerPhone,
  };
}
export async function retainedPhotos(images, request) {
  const result = [];
  try {
    for (const url of images) {
      const preview = url.startsWith("/uploads/")
        ? URL.createObjectURL(await request(url, { responseType: "blob" }))
        : url;
      result.push({ key: crypto.randomUUID(), url, preview, existing: true });
    }
    return result;
  } catch (e) {
    result.forEach((p) => URL.revokeObjectURL(p.preview));
    throw e;
  }
}
