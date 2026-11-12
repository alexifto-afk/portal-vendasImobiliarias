import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { normalizeMobile } from "./user-profile.js";
import { publicListingWhere } from "./rules.js";
export const consentVersion = "2026-11-whatsapp-news-v1";
export const consentText =
  "Quero receber novidades e anúncios do Negocieê pelo WhatsApp. Posso cancelar a qualquer momento respondendo SAIR.";
const fail = (status, message) => Object.assign(Error(message), { status });
const hash = (token) =>
  createHash("sha256")
    .update(consentVersion + ":" + token)
    .digest("hex");
const contactFields = {
  id: true,
  phone: true,
  status: true,
  consentVersion: true,
  consentAt: true,
  revokedAt: true,
  createdAt: true,
};
export function whatsappSettings(env) {
  const required = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_NUMBER",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_MARKETING_TEMPLATE",
  ];
  const missing = required.filter((key) => !env[key]?.trim());
  const valid =
    /^55[1-9]{2}9\d{8}$/.test(env.WHATSAPP_NUMBER || "") &&
    /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID || "") &&
    /^[a-z0-9_]+$/.test(env.WHATSAPP_MARKETING_TEMPLATE || "");
  return {
    enabled: env.WHATSAPP_ENABLED === "true" && !missing.length && valid,
    missing,
    configured: !missing.length && valid,
  };
}
export function validMetaSignature(raw, signature, secret) {
  if (!raw || !secret || !/^sha256=[a-f0-9]{64}$/.test(signature || ""))
    return false;
  return timingSafeEqual(
    Buffer.from(signature.slice(7), "hex"),
    createHmac("sha256", secret).update(raw).digest(),
  );
}
export function campaignMessage(listings, origin) {
  const money = (value) =>
    (value / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  return listings
    .map(
      (l) =>
        `${l.title.replace(/\s+/g, " ").slice(0, 70)} — ${money(l.price)}${l.purpose === "RENT" ? "/mês" : ""}. Veja: ${origin}/?anuncio=${encodeURIComponent(l.id)}`,
    )
    .join(" • ");
}
export async function sendMarketingTemplate(
  contact,
  campaign,
  env,
  fetcher = fetch,
) {
  const response = await fetcher(
    `https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "template",
        template: {
          name: env.WHATSAPP_MARKETING_TEMPLATE,
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: campaign.messageText }],
            },
          ],
        },
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(Error("provider"), {
      providerCode: String(data.error?.code || response.status),
    });
  const id = data.messages?.[0]?.id;
  if (!id) throw Error("unknown-provider-response");
  return id;
}
export function registerWhatsappCampaigns(
  app,
  {
    db,
    auth,
    admin,
    wrap,
    env,
    webOrigin,
    audit,
    send = sendMarketingTemplate,
    startWorker = true,
  },
) {
  const settings = () => whatsappSettings(env);
  app.get("/api/whatsapp/config", (_q, r) =>
    r.json({ enabled: settings().enabled, consentVersion, consentText }),
  );
  app.post(
    "/api/whatsapp/subscribe",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    wrap(async (q, r) => {
      if (!settings().enabled)
        throw fail(503, "Os alertas de WhatsApp ainda estão em preparação.");
      const input = z
        .object({
          phone: z
            .string()
            .max(24)
            .transform(normalizeMobile)
            .refine(
              (phone) => /^[1-9]{2}9\d{8}$/.test(phone),
              "Informe um WhatsApp com DDD.",
            ),
          consent: z.literal(true),
          consentVersion: z.literal(consentVersion),
        })
        .parse(q.body);
      const token = randomBytes(20).toString("hex"),
        phone = "55" + input.phone;
      await db.whatsappContact.upsert({
        where: { phone },
        create: {
          phone,
          pendingTokenHash: hash(token),
          tokenExpiresAt: new Date(Date.now() + 30 * 60000),
        },
        update: {
          pendingTokenHash: hash(token),
          tokenExpiresAt: new Date(Date.now() + 30 * 60000),
        },
      });
      r.set("Cache-Control", "no-store").json({
        url: `https://wa.me/${env.WHATSAPP_NUMBER}?text=${encodeURIComponent("QUERO NOVIDADES " + token)}`,
        message:
          "Envie a mensagem pronta no WhatsApp para confirmar a inscrição. O link vale por 30 minutos.",
      });
    }),
  );
  app.get("/api/whatsapp/webhook", (q, r) => {
    if (
      !env.WHATSAPP_VERIFY_TOKEN ||
      q.query["hub.mode"] !== "subscribe" ||
      q.query["hub.verify_token"] !== env.WHATSAPP_VERIFY_TOKEN
    )
      return r.sendStatus(403);
    r.status(200)
      .type("text/plain")
      .send(String(q.query["hub.challenge"] || ""));
  });
  app.post(
    "/api/whatsapp/webhook",
    wrap(async (q, r) => {
      if (
        !validMetaSignature(
          q.rawBody,
          q.get("x-hub-signature-256"),
          env.WHATSAPP_APP_SECRET,
        )
      )
        return r.sendStatus(401);
      if (q.body.object !== "whatsapp_business_account")
        return r.sendStatus(400);
      for (const entry of q.body.entry || [])
        for (const change of entry.changes || []) {
          const value = change.value || {};
          if (value.metadata?.phone_number_id !== env.WHATSAPP_PHONE_NUMBER_ID)
            continue;
          for (const message of value.messages || []) {
            if (
              !/^55[1-9]{2}9\d{8}$/.test(message.from || "") ||
              message.type !== "text"
            )
              continue;
            const text = String(message.text?.body || "").trim();
            const match = /^QUERO NOVIDADES ([a-f0-9]{40})$/i.exec(text);
            if (match)
              await db.whatsappContact.updateMany({
                where: {
                  phone: message.from,
                  pendingTokenHash: hash(match[1].toLowerCase()),
                  tokenExpiresAt: { gt: new Date() },
                },
                data: {
                  status: "ACTIVE",
                  consentAt: new Date(),
                  consentVersion,
                  revokedAt: null,
                  pendingTokenHash: null,
                  tokenExpiresAt: null,
                },
              });
            if (/^(sair|parar|cancelar|stop)$/i.test(text))
              await db.whatsappContact.updateMany({
                where: { phone: message.from },
                data: {
                  status: "STOPPED",
                  revokedAt: new Date(),
                  pendingTokenHash: null,
                  tokenExpiresAt: null,
                },
              });
          }
          for (const status of value.statuses || []) {
            const mapped = {
              delivered: "DELIVERED",
              read: "READ",
              failed: "FAILED",
            }[status.status];
            if (!mapped) continue;
            const previous =
              mapped === "READ" ? ["ACCEPTED", "DELIVERED"] : ["ACCEPTED"];
            await db.whatsappDelivery.updateMany({
              where: { providerMessageId: status.id, status: { in: previous } },
              data: {
                status: mapped,
                errorCode:
                  mapped === "FAILED"
                    ? String(status.errors?.[0]?.code || "DELIVERY_FAILED")
                    : null,
              },
            });
          }
        }
      r.sendStatus(200);
    }),
  );
  app.get(
    "/api/admin/whatsapp",
    auth,
    admin,
    wrap(async (q, r) => {
      const input = z
        .object({
          search: z.string().trim().max(40).default(""),
          page: z.coerce.number().int().min(1).max(100000).default(1),
          status: z
            .enum(["ALL", "ACTIVE", "PENDING", "STOPPED"])
            .default("ALL"),
        })
        .parse(q.query);
      const where = {
        ...(input.search
          ? { phone: { contains: input.search.replace(/\D/g, "") } }
          : {}),
        ...(input.status !== "ALL" ? { status: input.status } : {}),
      };
      const [contacts, total, counts, campaigns, listings, eligibleCount] =
        await Promise.all([
          db.whatsappContact.findMany({
            where,
            select: contactFields,
            orderBy: { createdAt: "desc" },
            skip: (input.page - 1) * 50,
            take: 50,
          }),
          db.whatsappContact.count({ where }),
          db.whatsappContact.groupBy({
            by: ["status"],
            _count: { _all: true },
          }),
          db.whatsappCampaign.findMany({
            orderBy: { createdAt: "desc" },
            take: 30,
            include: { _count: { select: { deliveries: true } } },
          }),
          db.listing.findMany({
            where: publicListingWhere(),
            select: {
              id: true,
              title: true,
              price: true,
              purpose: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
          db.whatsappContact.count({
            where: {
              status: "ACTIVE",
              consentAt: { not: null },
              consentVersion,
            },
          }),
        ]);
      const deliveryCounts = await db.whatsappDelivery.groupBy({
        by: ["campaignId", "status"],
        where: { campaignId: { in: campaigns.map((c) => c.id) } },
        _count: { _all: true },
      });
      r.set("Cache-Control", "no-store").json({
        contacts,
        total,
        eligibleCount,
        page: input.page,
        counts: counts.map((item) => ({
          status: item.status,
          _count: item._count._all,
        })),
        campaigns: campaigns.map((c) => ({
          ...c,
          counts: deliveryCounts
            .filter((d) => d.campaignId === c.id)
            .map((d) => ({ status: d.status, _count: d._count._all })),
        })),
        listings,
        settings: settings(),
        consentText,
      });
    }),
  );
  app.post(
    "/api/admin/whatsapp/contacts/:id/stop",
    auth,
    admin,
    wrap(async (q, r) => {
      const result = await db.whatsappContact.updateMany({
        where: { id: q.params.id },
        data: {
          status: "STOPPED",
          revokedAt: new Date(),
          pendingTokenHash: null,
          tokenExpiresAt: null,
        },
      });
      if (!result.count) throw fail(404, "Contato não encontrado.");
      await audit(db, q.user.id, "WHATSAPP_CONTACT_STOPPED", q.params.id, "");
      r.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/whatsapp/campaigns",
    auth,
    admin,
    wrap(async (q, r) => {
      const input = z
        .object({
          title: z.string().trim().min(3).max(80),
          listingIds: z.array(z.string().min(1).max(100)).min(1).max(3),
        })
        .parse(q.body);
      if (new Set(input.listingIds).size !== input.listingIds.length)
        throw fail(400, "Remova anúncios repetidos.");
      const listings = await db.listing.findMany({
        where: { ...publicListingWhere(), id: { in: input.listingIds } },
        select: { id: true, title: true, price: true, purpose: true },
      });
      if (listings.length !== input.listingIds.length)
        throw fail(
          409,
          "Um anúncio não está mais disponível. Atualize a lista.",
        );
      const messageText = campaignMessage(
        input.listingIds.map((id) => listings.find((l) => l.id === id)),
        webOrigin,
      );
      if (messageText.length > 900)
        throw fail(
          400,
          "Selecione menos anúncios para manter a mensagem curta.",
        );
      const campaign = await db.whatsappCampaign.create({
        data: { ...input, messageText, createdById: q.user.id },
      });
      await audit(db, q.user.id, "WHATSAPP_CAMPAIGN_DRAFT", campaign.id, "");
      r.status(201).json(campaign);
    }),
  );
  app.post(
    "/api/admin/whatsapp/campaigns/:id/dispatch",
    auth,
    admin,
    wrap(async (q, r) => {
      if (!settings().enabled)
        throw fail(
          503,
          "Configure e habilite a API oficial e o modelo aprovado no Render antes de disparar.",
        );
      const input = z
        .object({
          confirmed: z.literal(true),
          recipientCount: z.number().int().positive(),
        })
        .parse(q.body);
      const campaign = await db.$transaction(async (tx) => {
        const c = await tx.whatsappCampaign.findUnique({
          where: { id: q.params.id },
        });
        if (!c) throw fail(404, "Campanha não encontrada.");
        if (c.status !== "DRAFT")
          throw fail(
            409,
            "Esta campanha já foi iniciada. Não será enviada novamente.",
          );
        const currentListings = await tx.listing.findMany({
          where: { ...publicListingWhere(), id: { in: c.listingIds } },
          select: { id: true, title: true, price: true, purpose: true },
        });
        if (
          currentListings.length !== c.listingIds.length ||
          campaignMessage(
            c.listingIds.map((id) => currentListings.find((l) => l.id === id)),
            webOrigin,
          ) !== c.messageText
        )
          throw fail(
            409,
            "Um anúncio mudou ou não está mais disponível. Crie uma campanha atualizada.",
          );
        const contacts = await tx.whatsappContact.findMany({
          where: { status: "ACTIVE", consentAt: { not: null }, consentVersion },
          select: { id: true },
          take: 10001,
        });
        if (contacts.length > 10000)
          throw fail(
            422,
            "O limite atual é de 10.000 destinatários por campanha.",
          );
        if (contacts.length !== input.recipientCount)
          throw fail(
            409,
            "A quantidade de contatos mudou. Atualize e confirme novamente.",
          );
        const changed = await tx.whatsappCampaign.updateMany({
          where: { id: c.id, status: "DRAFT" },
          data: { status: "RUNNING", startedAt: new Date() },
        });
        if (!changed.count) throw fail(409, "Campanha já iniciada.");
        await tx.whatsappDelivery.createMany({
          data: contacts.map((contact) => ({
            campaignId: c.id,
            contactId: contact.id,
          })),
        });
        await audit(
          tx,
          q.user.id,
          "WHATSAPP_CAMPAIGN_STARTED",
          c.id,
          JSON.stringify({ recipients: contacts.length }),
        );
        return { id: c.id, recipients: contacts.length };
      });
      r.json(campaign);
    }),
  );
  app.post(
    "/api/admin/whatsapp/campaigns/:id/cancel",
    auth,
    admin,
    wrap(async (q, r) => {
      const result = await db.$transaction(async (tx) => {
        const changed = await tx.whatsappCampaign.updateMany({
          where: { id: q.params.id, status: { in: ["DRAFT", "RUNNING"] } },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        if (!changed.count)
          throw fail(409, "Campanha não está disponível para cancelamento.");
        await tx.whatsappDelivery.updateMany({
          where: { campaignId: q.params.id, status: "PENDING" },
          data: { status: "SKIPPED", errorCode: "CAMPAIGN_CANCELLED" },
        });
        await audit(
          tx,
          q.user.id,
          "WHATSAPP_CAMPAIGN_CANCELLED",
          q.params.id,
          "",
        );
        return { ok: true };
      });
      r.json(result);
    }),
  );
  let busy = false;
  async function tick() {
    if (busy || !settings().enabled) return;
    busy = true;
    try {
      await db.whatsappDelivery.updateMany({
        where: {
          status: "SENDING",
          updatedAt: { lt: new Date(Date.now() - 5 * 60000) },
        },
        data: { status: "UNCERTAIN", errorCode: "PROCESS_INTERRUPTED" },
      });
      const item = await db.whatsappDelivery.findFirst({
        where: { status: "PENDING", campaign: { status: "RUNNING" } },
        orderBy: { createdAt: "asc" },
        include: { campaign: true, contact: true },
      });
      if (item) {
        const claimed = await db.whatsappDelivery.updateMany({
          where: { id: item.id, status: "PENDING" },
          data: { status: "SENDING" },
        });
        if (claimed.count) {
          const currentCampaign = await db.whatsappCampaign.findUnique({
            where: { id: item.campaignId },
            select: { status: true },
          });
          const contact = await db.whatsappContact.findUnique({
            where: { id: item.contactId },
          });
          const current = await db.listing.findMany({
            where: {
              ...publicListingWhere(),
              id: { in: item.campaign.listingIds },
            },
            select: { id: true, title: true, price: true, purpose: true },
          });
          const live =
            current.length === item.campaign.listingIds.length &&
            campaignMessage(
              item.campaign.listingIds.map((id) =>
                current.find((l) => l.id === id),
              ),
              webOrigin,
            ) === item.campaign.messageText;
          if (
            currentCampaign?.status !== "RUNNING" ||
            contact?.status !== "ACTIVE" ||
            !contact.consentAt ||
            contact.consentVersion !== consentVersion ||
            !live
          )
            await db.whatsappDelivery.update({
              where: { id: item.id },
              data: {
                status: "SKIPPED",
                errorCode: !live ? "AD_CHANGED_OR_UNAVAILABLE" : "OPTED_OUT",
              },
            });
          else
            try {
              const id = await send(contact, item.campaign, env);
              await db.whatsappDelivery.update({
                where: { id: item.id },
                data: { status: "ACCEPTED", providerMessageId: id },
              });
            } catch (error) {
              await db.whatsappDelivery.update({
                where: { id: item.id },
                data: {
                  status: error.providerCode ? "FAILED" : "UNCERTAIN",
                  errorCode: error.providerCode || "SEND_RESULT_UNKNOWN",
                },
              });
            }
        }
      }
      await db.whatsappCampaign.updateMany({
        where: {
          status: "RUNNING",
          deliveries: { none: { status: { in: ["PENDING", "SENDING"] } } },
        },
        data: { status: "COMPLETE", completedAt: new Date() },
      });
    } catch (error) {
      console.error("WHATSAPP_WORKER_ERROR", {
        code: error.code || "INTERNAL",
      });
    } finally {
      busy = false;
    }
  }
  const timer = startWorker ? setInterval(tick, 2000) : null;
  timer?.unref();
  return { tick, stop: () => clearInterval(timer) };
}
