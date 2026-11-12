import { z } from "zod";
import { listingSchemaFor, contactPhone } from "./listing-schema.js";
import { uploadId } from "./image-uploads.js";
import { moneyTransaction, reserveCoupon } from "./partners.js";
import { terms } from "./rules.js";
const fail = (status, message) => Object.assign(Error(message), { status });
export function canEditListing(l, now = new Date()) {
  return (
    !l.deletedAt &&
    !l.affiliateVoidedAt &&
    Boolean(l.paidAt) &&
    !["CANCELLED", "CLOSED"].includes(l.status) &&
    (!l.expiresAt || new Date(l.expiresAt) > now)
  );
}
export function canRenewListing(l, now = new Date()) {
  return (
    !l.deletedAt &&
    !l.affiliateVoidedAt &&
    Boolean(l.paidAt) &&
    Boolean(l.expiresAt) &&
    new Date(l.expiresAt) <= now &&
    !["CANCELLED", "CLOSED"].includes(l.status)
  );
}
async function ownerListing(tx, id, userId) {
  const l = await tx.listing.findUnique({ where: { id } });
  if (!l || l.deletedAt) throw fail(404, "Anúncio não encontrado.");
  if (l.ownerId !== userId)
    throw fail(403, "Somente o anunciante pode gerenciar este anúncio.");
  return l;
}
const revisionSchema = z.number().int().min(0);
export function parseEdit(body, l) {
  const revision = revisionSchema.parse(body?.revision);
  if (revision !== l.revision)
    throw fail(
      409,
      "O anúncio mudou. Atualize o painel antes de editar novamente.",
    );
  const { termsAccepted, termsVersion, couponCode, couponVersion, ...data } =
    listingSchemaFor(l.images, { state: l.state, city: l.city }).parse({
      ...body,
      termsAccepted: true,
      termsVersion: l.termsVersion,
    });
  if (
    data.type !== l.type ||
    data.purpose !== l.purpose ||
    data.plan !== l.plan
  )
    throw fail(
      400,
      "Categoria, tipo, finalidade e plano não podem ser trocados na edição.",
    );
  // Explicit whitelist: edits never change payment, coupon, credits or contract.
  return Object.fromEntries(
    [
      "title",
      "description",
      "city",
      "state",
      "neighborhood",
      "locationLatitude",
      "locationLongitude",
      "ownerPhone",
      "price",
      "area",
      "bedrooms",
      "images",
      "details",
      "contactMode",
    ].map((key) => [key, data[key]]),
  );
}
async function editPhotos(tx, l, data) {
  const retained = data.images.filter((src) => l.images.includes(src));
  const fresh = data.images.filter((src) => !l.images.includes(src));
  if (new Set(data.images).size !== data.images.length)
    throw fail(400, "Remova fotos repetidas.");
  const ids = fresh.map(uploadId);
  if (
    (await tx.imageUpload.count({
      where: { id: { in: ids }, ownerId: l.ownerId, listingId: null },
    })) !== ids.length
  )
    throw fail(
      400,
      "Uma das fotos não está disponível ou pertence a outro anúncio.",
    );
  // Existing references remain immutable assets, including shared renewal photos.
  const retainedIds = retained.map(uploadId).filter(Boolean);
  if (
    (await tx.imageUpload.count({
      where: { id: { in: retainedIds }, ownerId: l.ownerId },
    })) !== retainedIds.length
  )
    throw fail(400, "Uma foto antiga não está disponível. Envie-a novamente.");
  if (ids.length) {
    const linked = await tx.imageUpload.updateMany({
      where: { id: { in: ids }, ownerId: l.ownerId, listingId: null },
      data: { listingId: l.id },
    });
    if (linked.count !== ids.length)
      throw fail(
        409,
        "As fotos foram usadas em outro anúncio. Atualize o painel.",
      );
  }
}
export function registerListingLifecycle(
  app,
  { db, auth, requireAdvertiser, wrap, getCommercial, audit },
) {
  app.put(
    "/api/owner/listings/:id",
    auth,
    requireAdvertiser,
    wrap(async (q, r) => {
      const updated = await moneyTransaction(db, async (tx) => {
        const l = await ownerListing(tx, q.params.id, q.user.id);
        if (!canEditListing(l))
          throw fail(
            409,
            "O prazo para editar terminou ou este anúncio está encerrado. Renove a divulgação para um novo período.",
          );
        const data = parseEdit(q.body, l);
        await editPhotos(tx, l, data);
        const updated = await tx.listing.update({
          where: { id: l.id },
          data: {
            ...data,
            reviewed: false,
            status: "PENDING",
            revision: { increment: 1 },
          },
        });
        await audit(
          tx,
          q.user.id,
          "LISTING_EDITED",
          l.id,
          JSON.stringify({
            revision: updated.revision,
            expiresAt: updated.expiresAt,
          }),
        );
        return updated;
      });
      r.json(updated);
    }),
  );
  app.delete(
    "/api/owner/listings/:id",
    auth,
    requireAdvertiser,
    wrap(async (q, r) => {
      await moneyTransaction(db, async (tx) => {
        const l = await ownerListing(tx, q.params.id, q.user.id);
        await tx.listing.update({
          where: { id: l.id },
          data: {
            deletedAt: new Date(),
            status: "CANCELLED",
            reviewed: false,
            revision: { increment: 1 },
          },
        });
        await audit(
          tx,
          q.user.id,
          "LISTING_DELETED",
          l.id,
          "Retirado pelo anunciante; histórico financeiro preservado.",
        );
      });
      r.json({ ok: true });
    }),
  );
  app.post(
    "/api/owner/listings/:id/renew",
    auth,
    requireAdvertiser,
    wrap(async (q, r) => {
      const state = await getCommercial(),
        config = state.config;
      if (!config.commercialEnabled)
        throw fail(
          503,
          "Novas contratações estão temporariamente indisponíveis.",
        );
      const input = z
        .object({
          plan: z.enum(["BASIC", "FEATURED"]),
          ownerPhone: contactPhone,
          contactAccepted: z.literal(true),
          termsAccepted: z.literal(true),
          termsVersion: z.string(),
          couponCode: z.string().trim().max(32).optional(),
          couponVersion: z.string().datetime().optional(),
        })
        .parse(q.body);
      if (input.termsVersion !== state.termsVersion + "-renewal-30")
        throw fail(
          409,
          "As condições comerciais mudaram. Atualize o painel e confira a renovação.",
        );
      const sameContract = (existing) =>
        existing.plan === input.plan &&
        existing.ownerPhone === input.ownerPhone &&
        existing.termsVersion === input.termsVersion &&
        (existing.couponCode || "") ===
          (input.couponCode?.trim().toUpperCase() || "");
      let created;
      try {
        created = await moneyTransaction(db, async (tx) => {
          const l = await ownerListing(tx, q.params.id, q.user.id);
          if (!canRenewListing(l))
            throw fail(
              409,
              "A renovação fica disponível após terminar o prazo de um anúncio pago.",
            );
          const existing = await tx.listing.findFirst({
            where: { renewalOfId: l.id, deletedAt: null },
          });
          if (existing) {
            if (!sameContract(existing))
              throw fail(
                409,
                "Já existe uma renovação para este anúncio. Atualize o painel e retome o pagamento do período já cadastrado.",
              );
            return existing;
          }
          const basePrice =
            input.plan === "FEATURED" ? config.featuredPrice : config.adPrice;
          const promotion = await reserveCoupon(tx, {
            code: input.couponCode,
            version: input.couponVersion,
            basePrice,
            plan: input.plan,
            userId: q.user.id,
          });
          const data = Object.fromEntries(
            [
              "title",
              "description",
              "type",
              "category",
              "purpose",
              "city",
              "state",
              "neighborhood",
              "locationLatitude",
              "locationLongitude",
              "privateAddress",
              "price",
              "area",
              "bedrooms",
              "images",
              "details",
            ].map((key) => [key, l[key]]),
          );
          const next = await tx.listing.create({
            data: {
              ...data,
              ownerId: l.ownerId,
              renewalOfId: l.id,
              ownerPhone: input.ownerPhone,
              contactMode: "DIRECT",
              ...promotion,
              plan: input.plan,
              durationDays: 30,
              commissionBps: 0,
              termsVersion: input.termsVersion,
              acceptedAt: new Date(),
              termsText:
                terms(
                  { ...config, durationDays: 30, adPrice: promotion.adPrice },
                  l.purpose,
                ) +
                (promotion.couponCode
                  ? ` Cupom ${promotion.couponCode}: divulgação promocional de R$ ${(promotion.adPrice / 100).toFixed(2)}.`
                  : ""),
            },
          });
          await audit(tx, q.user.id, "LISTING_RENEWAL_CREATED", next.id, l.id);
          return next;
        });
      } catch (e) {
        if (e.code !== "P2002") throw e;
        const existing = await db.listing.findFirst({
          where: {
            renewalOfId: q.params.id,
            ownerId: q.user.id,
            deletedAt: null,
          },
        });
        if (!existing || !sameContract(existing))
          throw fail(
            409,
            "Uma renovação já foi criada. Atualize o painel para continuar.",
          );
        created = existing;
      }
      r.status(201).json(created);
    }),
  );
}
