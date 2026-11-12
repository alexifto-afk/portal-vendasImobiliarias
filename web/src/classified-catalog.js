// Catalog contract mirrored in api/src/classified-catalog.js; checked by tests.
export const categories = {
  REAL_ESTATE: {
    name: "Imóveis",
    types: {
      HOUSE: "Casa",
      APARTMENT: "Apartamento",
      LOT: "Lote",
      FARM: "Fazenda",
      COMMERCIAL: "Imóvel comercial",
    },
  },
  VEHICLES: {
    name: "Veículos",
    types: {
      CAR: "Carro",
      MOTORCYCLE: "Moto",
      TRUCK: "Caminhão",
      OTHER_VEHICLE: "Outro veículo",
    },
  },
  ELECTRONICS: {
    name: "Eletrônicos",
    types: {
      PHONE: "Celular",
      COMPUTER: "Computador",
      TV: "TV",
      OTHER_ELECTRONIC: "Outro eletrônico",
    },
  },
  HOME: {
    name: "Casa e móveis",
    types: {
      FURNITURE: "Móvel",
      APPLIANCE: "Eletrodoméstico",
      HOME_ITEM: "Outro item para casa",
    },
  },
  RURAL: {
    name: "Máquinas e equipamentos rurais",
    types: {
      FARM_MACHINE: "Máquina agrícola",
      RURAL_EQUIPMENT: "Equipamento rural",
    },
  },
  OTHER: { name: "Outros produtos", types: { OTHER: "Outro produto" } },
};
export const typeNames = Object.assign(
  {},
  ...Object.values(categories).map((c) => c.types),
);
export const categoryFor = (type) =>
  Object.keys(categories).find((c) => type in categories[c].types);
export const states =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  );
export const conditions = { NEW: "Novo", USED: "Usado" };
export function listingFeatures(l) {
  if ((l.category || categoryFor(l.type)) === "REAL_ESTATE")
    return [
      l.area
        ? `${l.type === "FARM" && l.area >= 10000 ? (l.area / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " ha" : l.area.toLocaleString("pt-BR") + " m²"}`
        : "",
      l.bedrooms > 0 ? `${l.bedrooms} quartos` : "",
    ].filter(Boolean);
  const d = l.details || {};
  return [
    d.brand,
    d.model,
    d.year,
    d.mileage != null ? `${Number(d.mileage).toLocaleString("pt-BR")} km` : "",
    conditions[d.condition],
  ].filter((v) => v !== "" && v != null);
}
