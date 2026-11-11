import { requestMercadoPago } from "./mp-sdk.js";
import { payerSchema, preferencePayload } from "./payment-payloads.js";
import "dotenv/config";
import { registerTestCheckoutRoutes } from "./test-checkout.js";
import express from "express";
import { registerCommercialRoutes } from "./commercial-settings.js";
import { registerImageRoutes, uploadId } from "./image-uploads.js";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { terms, commission, paymentMatches, publicFields } from "./rules.js";
const db = new PrismaClient(),
  app = express(),
  env = process.env;
if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
  throw Error("Configure JWT_SECRET com pelo menos 32 caracteres.");
const integer = (key, fallback) => {
  const n = Number(env[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 0)
    throw Error(`Configuração inválida: ${key}`);
  return n;
};
const config = {
  brokerName: env.BROKER_NAME || "Lourival Missias Pereira",
  brokerPhone: env.BROKER_PHONE || "5563999915770",
  brokerCreci: env.BROKER_CRECI || "778D-22",
  adPrice: integer("AD_PRICE_CENTS", 2990),
  featuredPrice: integer("FEATURED_PRICE_CENTS", 5990),
  durationDays: integer("AD_DURATION_DAYS", 30),
  saleCommissionBps: integer("SALE_COMMISSION_BPS", 0),
  rentCommissionBps: integer("RENT_COMMISSION_BPS", 0),
};
if (
  config.saleCommissionBps > 10000 ||
  config.rentCommissionBps > 10000 ||
  config.durationDays < 1 ||
  config.durationDays > 365 ||
  !/^55\d{10,11}$/.test(config.brokerPhone)
)
  throw Error("Configuração comercial inválida.");
const webOrigin = env.WEB_ORIGIN || "http://localhost:5173";
if (env.NODE_ENV === "production" && !webOrigin.startsWith("https://"))
  throw Error("WEB_ORIGIN deve usar HTTPS.");
app.disable("x-powered-by");
app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);
app.use(helmet());
app.use(cors({ origin: webOrigin }));
app.use(express.json({ limit: "100kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const wrap = (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n);
const fail = (status, message) => Object.assign(new Error(message), { status });
const auth = wrap(async (q, r, n) => {
  let token;
  try {
    token = jwt.verify(
      (q.headers.authorization || "").replace(/^Bearer /, ""),
      env.JWT_SECRET,
      { algorithms: ["HS256"] },
    );
  } catch {
    throw fail(401, "Entre na sua conta.");
  }
  q.user = await db.user.findUnique({
    where: { id: token.sub },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!q.user) throw fail(401, "Conta não encontrada.");
  n();
});
const admin = (q, r, n) =>
  q.user.role === "ADMIN" ? n() : n(fail(403, "Acesso restrito ao corretor."));
const publicWhere = () => ({
  status: "PUBLISHED",
  reviewed: true,
  paidAt: { not: null },
  expiresAt: { gt: new Date() },
});
const tokenFor = (u) =>
  jwt.sign({ sub: u.id }, env.JWT_SECRET, {
    expiresIn: "8h",
    algorithm: "HS256",
  });
const audit = (tx, actorId, action, entityId, detail = "") =>
  tx.audit.create({ data: { actorId, action, entityId, detail } });
async function owned(q) {
  const l = await db.listing.findUnique({ where: { id: q.params.id } });
  if (!l) throw fail(404, "Anúncio não encontrado.");
  if (l.ownerId !== q.user.id && q.user.role !== "ADMIN")
    throw fail(403, "Acesso negado.");
  return l;
}
async function mp(path, options = {}) {
  try {
    return await requestMercadoPago(env.MP_ACCESS_TOKEN, path, options);
  } catch {
    throw fail(
      502,
      "Não foi possível consultar o provedor de pagamento. Tente novamente.",
    );
  }
}
app.get("/api/health", (_q, r) => r.json({ ok: true }));
const getCommercial = registerCommercialRoutes(app, {
  db,
  auth,
  admin,
  wrap,
  base: config,
  env,
  audit,
});
registerImageRoutes(app, { db, auth, wrap });
registerTestCheckoutRoutes(app, { db, auth, admin, wrap, env });
app.post(
  "/api/auth/register",
  authLimit,
  wrap(async (q, r) => {
    const d = z
      .object({
        name: z.string().trim().min(3).max(100),
        email: z
          .string()
          .email()
          .max(254)
          .transform((x) => x.toLowerCase()),
        password: z.string().min(12).max(128),
      })
      .parse(q.body);
    const u = await db.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash: await bcrypt.hash(d.password, 12),
      },
    });
    r.status(201).json({
      token: tokenFor(u),
      user: { id: u.id, name: u.name, role: u.role },
    });
  }),
);
app.post(
  "/api/auth/login",
  authLimit,
  wrap(async (q, r) => {
    const d = z
      .object({
        email: z
          .string()
          .email()
          .transform((x) => x.toLowerCase()),
        password: z.string().max(128),
      })
      .parse(q.body);
    const u = await db.user.findUnique({ where: { email: d.email } });
    if (!u || !(await bcrypt.compare(d.password, u.passwordHash)))
      throw fail(401, "E-mail ou senha inválidos.");
    r.json({
      token: tokenFor(u),
      user: { id: u.id, name: u.name, role: u.role },
    });
  }),
);
app.get("/api/me", auth, (q, r) => r.json(q.user));
app.get(
  "/api/listings",
  wrap(async (q, r) => {
    const filter = z
      .object({
        type: z.enum(["HOUSE", "LOT", "FARM"]).optional(),
        purpose: z.enum(["SALE", "RENT"]).optional(),
        city: z.string().max(100).optional(),
      })
      .parse(q.query);
    r.json(
      await db.listing.findMany({
        where: {
          ...publicWhere(),
          ...filter,
          city: filter.city
            ? { contains: filter.city, mode: "insensitive" }
            : undefined,
        },
        select: publicFields,
        orderBy: [{ plan: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
    );
  }),
);
app.get(
  "/api/listings/:id",
  wrap(async (q, r) => {
    const l = await db.listing.findFirst({
      where: { id: q.params.id, ...publicWhere() },
      select: publicFields,
    });
    if (!l) throw fail(404, "Imóvel indisponível.");
    r.json(l);
  }),
);
const phone = z.string().regex(/^\d{10,13}$/, "Informe o telefone com DDD.");
const listingSchema = z.object({
  title: z.string().trim().min(8).max(100),
  description: z.string().trim().min(30).max(5000),
  type: z.enum(["HOUSE", "LOT", "FARM"]),
  purpose: z.enum(["SALE", "RENT"]),
  plan: z.enum(["BASIC", "FEATURED"]),
  city: z.string().trim().min(2).max(100),
  neighborhood: z.string().trim().min(2).max(100),
  privateAddress: z.string().trim().min(8).max(250),
  ownerPhone: phone,
  price: z.number().int().positive().max(2000000000),
  area: z.number().positive().max(1e10),
  bedrooms: z.number().int().min(0).max(100),
  images: z
    .array(
      z
        .string()
        .refine(
          (v) => Boolean(uploadId(v)),
          "Envie as fotos pelo seletor de arquivos.",
        ),
    )
    .min(1)
    .max(12),
  termsAccepted: z.literal(true),
  termsVersion: z.string(),
});
app.post(
  "/api/owner/listings",
  auth,
  wrap(async (q, r) => {
    const { config, termsVersion: currentTermsVersion } = await getCommercial();
    if (!config.commercialEnabled)
      throw fail(
        503,
        "Contratações ainda não estão habilitadas. Fale com o corretor.",
      );
    const { termsAccepted, termsVersion, ...d } = listingSchema.parse(q.body);
    if (termsVersion !== currentTermsVersion)
      throw fail(
        409,
        "As condições comerciais mudaram. Atualize a página, confira os valores e aceite novamente.",
      );
    const adPrice =
      d.plan === "FEATURED" ? config.featuredPrice : config.adPrice;
    const l = await db.$transaction(async (tx) => {
      const ids = d.images.map(uploadId);
      if (new Set(ids).size !== ids.length)
        throw fail(400, "Remova fotos repetidas.");
      const ownedPhotos = await tx.imageUpload.count({
        where: { id: { in: ids }, ownerId: q.user.id, listingId: null },
      });
      if (ownedPhotos !== ids.length)
        throw fail(
          400,
          "Uma das fotos não está disponível. Envie suas fotos novamente.",
        );
      const l = await tx.listing.create({
        data: {
          ...d,
          ownerId: q.user.id,
          adPrice,
          durationDays: config.durationDays,
          commissionBps:
            d.purpose === "SALE"
              ? config.saleCommissionBps
              : config.rentCommissionBps,
          termsVersion,
          termsText: terms({ ...config, adPrice }, d.purpose),
          acceptedAt: new Date(),
        },
      });
      const linked = await tx.imageUpload.updateMany({
        where: { id: { in: ids }, ownerId: q.user.id, listingId: null },
        data: { listingId: l.id },
      });
      if (linked.count !== ids.length)
        throw fail(409, "As fotos já foram utilizadas. Atualize a página.");
      await audit(tx, q.user.id, "TERMS_ACCEPTED", l.id, termsVersion);
      return l;
    });
    r.status(201).json(l);
  }),
);
app.get(
  "/api/owner/listings",
  auth,
  wrap(async (q, r) =>
    r.json(
      await db.listing.findMany({
        where: { ownerId: q.user.id },
        orderBy: { createdAt: "desc" },
      }),
    ),
  ),
);
app.post(
  "/api/owner/listings/:id/checkout",
  auth,
  wrap(async (q, r) => {
    if (!(await getCommercial()).config.commercialEnabled)
      throw fail(503, "Pagamentos desativados.");
    const l = await owned(q);
    if (l.paidAt || l.status === "CANCELLED")
      throw fail(409, "Anúncio já pago ou cancelado.");
    if (l.checkoutUrl) return r.json({ url: l.checkoutUrl });
    const payer = payerSchema.parse(q.body?.payer);
    const owner = await db.user.findUnique({
      where: { id: l.ownerId },
      select: { email: true, createdAt: true },
    });
    if (!owner) throw fail(404, "Proprietário não encontrado.");
    const pref = await mp("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preferencePayload(l, owner, payer, webOrigin)),
    });
    const url = pref.init_point;
    if (!url?.startsWith("https://")) throw fail(502, "Checkout indisponível.");
    await db.listing.update({
      where: { id: l.id },
      data: { checkoutUrl: url },
    });
    r.json({ url });
  }),
);
// O retorno do navegador nunca confirma pagamento. A consulta usa a API autenticada do PSP.
app.post(
  "/api/owner/listings/:id/sync-payment",
  auth,
  wrap(async (q, r) => {
    if (!(await getCommercial()).config.commercialEnabled)
      throw fail(503, "Pagamentos desativados.");
    const l = await owned(q);
    if (l.paidAt) return r.json({ paid: true });
    const result = await mp(
      `/v1/payments/search?external_reference=${encodeURIComponent(l.id)}&sort=date_created&criteria=desc&limit=50`,
    );
    const p = result.results?.find((p) =>
      paymentMatches(p, l, env.MP_COLLECTOR_ID),
    );
    if (!p) return r.json({ paid: false });
    await db.$transaction(async (tx) => {
      await tx.listing.updateMany({
        where: { id: l.id, paidAt: null },
        data: { paidAt: new Date(), paymentId: String(p.id) },
      });
      await audit(tx, q.user.id, "PAYMENT_VERIFIED", l.id, String(p.id));
    });
    r.json({ paid: true });
  }),
);
const leadLimit = rateLimit({
  windowMs: 3600000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
app.post(
  "/api/listings/:id/leads",
  leadLimit,
  wrap(async (q, r) => {
    const { consent, ...d } = z
      .object({
        name: z.string().trim().min(3).max(100),
        phone,
        message: z.string().trim().max(1000).default(""),
        consent: z.literal(true),
      })
      .parse(q.body);
    const l = await db.listing.findFirst({
      where: { id: q.params.id, ...publicWhere() },
    });
    if (!l) throw fail(404, "Imóvel indisponível.");
    const lead = await db.lead.create({
      data: { ...d, listingId: l.id, consentAt: new Date() },
    });
    r.status(201).json({
      whatsapp: `https://wa.me/${config.brokerPhone}?text=${encodeURIComponent(`Olá, ${config.brokerName}! Tenho interesse em ${l.title}. Referência ${l.id}. Atendimento ${lead.id}. Meu nome é ${d.name}. ${d.message}`)}`,
    });
  }),
);
app.get(
  "/api/admin/listings",
  auth,
  admin,
  wrap(async (_q, r) =>
    r.json(
      await db.listing.findMany({
        include: { owner: { select: { name: true, email: true } }, deal: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ),
  ),
);
app.post(
  "/api/admin/listings/:id/review",
  auth,
  admin,
  wrap(async (q, r) => {
    const { approve } = z.object({ approve: z.boolean() }).parse(q.body);
    await db.$transaction(async (tx) => {
      const l = await tx.listing.findUnique({ where: { id: q.params.id } });
      if (!l) throw fail(404, "Imóvel não encontrado.");
      if (["CLOSED", "CANCELLED"].includes(l.status))
        throw fail(409, "Anúncio encerrado.");
      if (approve && !l.paidAt)
        throw fail(409, "Confirme o pagamento antes de publicar.");
      await tx.listing.update({
        where: { id: l.id },
        data: approve
          ? {
              reviewed: true,
              status: "PUBLISHED",
              expiresAt:
                l.expiresAt || new Date(Date.now() + l.durationDays * 86400000),
            }
          : { reviewed: false, status: "REJECTED" },
      });
      await audit(tx, q.user.id, approve ? "PUBLISHED" : "REJECTED", l.id);
    });
    r.json({ ok: true });
  }),
);
app.get(
  "/api/admin/leads",
  auth,
  admin,
  wrap(async (_q, r) =>
    r.json(
      await db.lead.findMany({
        include: { listing: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ),
  ),
);
app.patch(
  "/api/admin/leads/:id",
  auth,
  admin,
  wrap(async (q, r) => {
    const d = z
      .object({
        stage: z.enum([
          "NEW",
          "CONTACTED",
          "VISIT",
          "PROPOSAL",
          "CLOSED",
          "LOST",
        ]),
        notes: z.string().max(5000),
        visitAt: z.string().datetime().nullable(),
      })
      .parse(q.body);
    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: q.params.id },
        data: { ...d, visitAt: d.visitAt ? new Date(d.visitAt) : null },
      });
      await audit(tx, q.user.id, "LEAD_UPDATED", q.params.id, d.stage);
    });
    r.json({ ok: true });
  }),
);
app.post(
  "/api/admin/listings/:id/deal",
  auth,
  admin,
  wrap(async (q, r) => {
    const d = z
      .object({
        buyerName: z.string().trim().min(3).max(150),
        sellerName: z.string().trim().min(3).max(150),
        finalPrice: z.number().int().positive().max(2000000000),
        paymentTerms: z.string().trim().min(10).max(5000),
      })
      .parse(q.body);
    const deal = await db.$transaction(async (tx) => {
      const l = await tx.listing.findUnique({ where: { id: q.params.id } });
      if (!l || l.status !== "PUBLISHED")
        throw fail(409, "O anúncio deve estar publicado.");
      const deal = await tx.deal.create({
        data: {
          ...d,
          listingId: l.id,
          commission: commission(d.finalPrice, l.commissionBps),
        },
      });
      await tx.listing.update({
        where: { id: l.id },
        data: { status: "CLOSED" },
      });
      await audit(
        tx,
        q.user.id,
        "DEAL_CLOSED",
        l.id,
        JSON.stringify({
          finalPrice: d.finalPrice,
          commission: deal.commission,
        }),
      );
      return deal;
    });
    r.status(201).json(deal);
  }),
);
app.patch(
  "/api/admin/deals/:id/commission",
  auth,
  admin,
  wrap(async (q, r) => {
    const { paid } = z.object({ paid: z.boolean() }).parse(q.body);
    await db.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: q.params.id },
        data: { commissionPaid: paid },
      });
      await audit(
        tx,
        q.user.id,
        "COMMISSION_RECONCILED",
        q.params.id,
        String(paid),
      );
    });
    r.json({ ok: true });
  }),
);
app.get(
  "/api/admin/audit",
  auth,
  admin,
  wrap(async (_q, r) =>
    r.json(
      await db.audit.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    ),
  ),
);
app.use((err, q, r, _next) => {
  if (err instanceof z.ZodError)
    return r.status(400).json({
      error: err.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join("; "),
    });
  if (err.code === "P2002")
    return r.status(409).json({ error: "Registro já existente." });
  if (err.code === "P2025")
    return r.status(404).json({ error: "Registro não encontrado." });
  if (err.status) return r.status(err.status).json({ error: err.message });
  console.error("Falha interna", err.code || err.name);
  r.status(500).json({ error: "Falha interna. Tente novamente." });
});
app.listen(integer("PORT", 3002), "0.0.0.0", () =>
  console.log("Portal API iniciada."),
);
