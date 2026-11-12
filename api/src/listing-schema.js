import { cityForState } from "./locations.js";
import { z } from "zod";
import { categoryFor, typeNames, states } from "./classified-catalog.js";
import { uploadId } from "./image-uploads.js";
import { normalizeMobile } from "./user-profile.js";
export const contactPhone = z
  .string()
  .max(24)
  .transform(normalizeMobile)
  .refine(
    (s) => /^[1-9]{2}9\d{8}$/.test(s),
    "Informe um WhatsApp válido com DDD.",
  );
export function listingSchemaFor(existingImages = [], existingLocation = null) {
  const retained = new Set(
    existingImages.filter((src) => src.startsWith("https://")),
  );
  return z
    .object({
      couponCode: z.string().trim().max(32).optional(),
      couponVersion: z.string().datetime().optional(),
      title: z.string().trim().min(8).max(100),
      description: z.string().trim().min(30).max(5000),
      type: z.enum(Object.keys(typeNames)),
      purpose: z.enum(["SALE", "RENT"]),
      plan: z.enum(["BASIC", "FEATURED"]),
      city: z.string().trim().min(2).max(100),
      state: z.enum(states).default("TO"),
      neighborhood: z.string().trim().min(2).max(100),
      locationLatitude: z.number().min(-34).max(6).nullable().default(null),
      locationLongitude: z.number().min(-74).max(-28).nullable().default(null),
      privateAddress: z.string().trim().max(250).default(""),
      ownerPhone: contactPhone,
      contactAccepted: z.literal(true, {
        error: "Autorize o contato direto pelo WhatsApp.",
      }),
      price: z.number().int().positive().max(2000000000),
      area: z.number().min(0).max(1e10).default(0),
      bedrooms: z.number().int().min(0).max(100).default(0),
      details: z
        .object({
          brand: z.string().trim().min(1).max(60).optional(),
          model: z.string().trim().min(1).max(100).optional(),
          year: z
            .number()
            .int()
            .min(1900)
            .max(new Date().getFullYear() + 1)
            .optional(),
          mileage: z.number().int().min(0).max(10000000).optional(),
          condition: z.enum(["NEW", "USED"]).optional(),
        })
        .strict()
        .default({}),
      images: z
        .array(
          z
            .string()
            .refine(
              (v) => Boolean(uploadId(v)) || retained.has(v),
              "Envie as fotos pelo seletor de arquivos.",
            ),
        )
        .min(1)
        .max(12),
      termsAccepted: z.literal(true),
      termsVersion: z.string(),
    })
    .superRefine((d, ctx) => {
      const category = categoryFor(d.type);
      const legacyLocation =
        existingLocation &&
        d.city === existingLocation.city &&
        d.state === existingLocation.state;
      if (!cityForState(d.state, d.city) && !legacyLocation)
        ctx.addIssue({
          code: "custom",
          path: ["city"],
          message: "Selecione uma cidade válida para o estado informado.",
        });
      const issue = (field, message) =>
        ctx.addIssue({ code: "custom", path: field.split("."), message });
      if ((d.locationLatitude == null) !== (d.locationLongitude == null))
        issue("locationLatitude", "Marque a localização completa no mapa.");
      if (
        category !== "REAL_ESTATE" &&
        (d.locationLatitude != null || d.locationLongitude != null)
      )
        issue(
          "locationLatitude",
          "A marcação no mapa é exclusiva dos imóveis.",
        );
      if (category === "REAL_ESTATE") {
        if (d.area <= 0) issue("area", "Informe a área do imóvel.");
        if (Object.keys(d.details).length)
          issue("details", "Imóvel não aceita detalhes de produto.");
      } else {
        if (d.area !== 0 || d.bedrooms !== 0)
          issue("area", "Campos de imóvel não se aplicam a este produto.");
        if (category === "VEHICLES") {
          for (const k of ["brand", "model", "year", "mileage"])
            if (d.details[k] == null)
              issue(`details.${k}`, "Informe este dado do veículo.");
        } else if (d.details.year != null || d.details.mileage != null)
          issue("details", "Ano e quilometragem são exclusivos de veículos.");
        if (!d.details.condition)
          issue("details.condition", "Informe se o produto é novo ou usado.");
      }
    })
    .transform(({ contactAccepted, ...d }) => ({
      ...d,
      city: cityForState(d.state, d.city)?.name || d.city,
      category: categoryFor(d.type),
      contactMode: "DIRECT",
    }));
}
export const listingSchema = listingSchemaFor();
export const catalogFilter = z.object({
  category: z
    .enum(["REAL_ESTATE", "VEHICLES", "ELECTRONICS", "HOME", "RURAL", "OTHER"])
    .optional(),
  type: z.enum(Object.keys(typeNames)).optional(),
  purpose: z.enum(["SALE", "RENT"]).optional(),
  state: z.enum(states).optional(),
  city: z.string().max(100).optional(),
  search: z.string().trim().max(100).optional(),
});
export function whatsappFor(listing) {
  if (listing.contactMode !== "DIRECT") return null;
  const digits = String(listing.ownerPhone).replace(/\D/g, "");
  const phone = digits.length === 11 ? "55" + digits : digits;
  if (!/^55[1-9]{2}9\d{8}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Tenho interesse no anúncio "${listing.title}" no Negocieê. Referência: ${listing.id}.`)}`;
}
