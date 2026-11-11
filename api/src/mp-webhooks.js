import { createHash } from "node:crypto";
import { WebhookSignatureValidator } from "mercadopago";
import { requestMercadoPago } from "./mp-sdk.js";
import { safeTestOrder } from "./test-checkout.js";
import { paymentMatches } from "./rules.js";
const fail = (status, message) => Object.assign(Error(message), { status });
export function verifyNotification(q, secret) {
  const dataId = q.query["data.id"],
    requestId = q.headers["x-request-id"],
    signature = q.headers["x-signature"];
  if (
    typeof dataId !== "string" ||
    !dataId ||
    typeof requestId !== "string" ||
    !requestId ||
    typeof signature !== "string"
  )
    throw fail(401, "Notificação sem assinatura válida.");
  if (
    q.body?.data?.id !== undefined &&
    String(q.body.data.id).toLowerCase() !== dataId.toLowerCase()
  )
    throw fail(400, "Recurso divergente da assinatura.");
  try {
    WebhookSignatureValidator.validate({
      xSignature: signature,
      xRequestId: requestId,
      dataId: dataId.toLowerCase(),
      secret,
    });
    // O SDK 3.6.1 interpreta a tolerância apenas em segundos; o provedor também
    // documenta ts em milissegundos. Preserve o ts assinado e valide ambas as unidades.
    const timestamps = signature
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.startsWith("ts="));
    if (timestamps.length !== 1) throw Error("timestamp");
    const ts = timestamps[0].slice(3).trim();
    if (!/^(?:\d{10}|\d{13})$/.test(ts)) throw Error("timestamp");
    const timestamp = Number(ts) * (ts.length === 10 ? 1000 : 1);
    if (Math.abs(Date.now() - timestamp) > 600000) throw Error("expired");
  } catch {
    throw fail(401, "Assinatura inválida ou expirada.");
  }
  return createHash("sha256")
    .update([dataId.toLowerCase(), requestId, signature].join("|"))
    .digest("hex");
}
export function registerWebhookRoutes(
  app,
  { db, wrap, env, auth, admin, requestMp = requestMercadoPago },
) {
  app.post(
    "/api/webhooks/mercadopago/:mode",
    wrap(async (q, r) => {
      const mode = q.params.mode;
      if (!["test", "production"].includes(mode))
        throw fail(404, "Endpoint não encontrado.");
      const secret =
        mode === "test" ? env.MP_TEST_WEBHOOK_SECRET : env.MP_WEBHOOK_SECRET;
      const token =
        mode === "test" ? env.MP_TEST_ACCESS_TOKEN : env.MP_ACCESS_TOKEN;
      if (!secret || !token)
        throw fail(503, "Webhook ainda não configurado neste ambiente.");
      const signatureId = verifyNotification(q, secret),
        eventId = "mp-wh:" + mode + ":" + signatureId;
      if (
        q.body.live_mode !== undefined &&
        q.body.live_mode !== (mode === "production")
      )
        throw fail(400, "Ambiente da notificação divergente.");
      const topic = q.body.type || q.query.type;
      if (q.query.type && q.query.type !== topic)
        throw fail(400, "Tipo da notificação divergente.");
      const resourceId = String(q.body.data?.id ?? q.query["data.id"]);
      if (await db.audit.findUnique({ where: { id: eventId } }))
        return r.json({ received: true, duplicate: true });
      let orderRecord,
        order,
        payment,
        listing,
        result = "ignored";
      if (topic === "order" && mode === "test") {
        if (!/^ORDTST[A-Z0-9]{10,80}$/.test(resourceId))
          throw fail(400, "ID de ordem de teste inválido.");
        orderRecord = await db.audit.findFirst({
          where: { action: "MP_TEST_ORDER_CREATED", entityId: resourceId },
        });
        if (orderRecord) {
          const saved = JSON.parse(orderRecord.detail);
          let raw;
          try {
            raw = await requestMp(token, "/v1/orders/" + resourceId);
          } catch {
            throw fail(503, "Consulta da ordem indisponível.");
          }
          order = safeTestOrder(
            raw,
            saved.sellerId,
            saved.reference,
            resourceId,
            saved.order.amount || "1.00",
          );
          result = order.approved
            ? "test_payment_verified"
            : "test_status_verified";
        }
      } else if (topic === "payment" && mode === "production") {
        if (!/^\d{1,30}$/.test(resourceId))
          throw fail(400, "ID de pagamento inválido.");
        try {
          payment = await requestMp(token, "/v1/payments/" + resourceId);
        } catch {
          throw fail(503, "Consulta do pagamento indisponível.");
        }
        if (String(payment.id) !== resourceId || payment.live_mode !== true)
          throw fail(400, "Pagamento de outro ambiente ou recurso.");
        listing =
          typeof payment.external_reference === "string"
            ? await db.listing.findUnique({
                where: { id: payment.external_reference },
              })
            : null;
        if (listing) {
          const identity = paymentMatches(
            { ...payment, status: "approved" },
            listing,
            env.MP_COLLECTOR_ID,
          );
          if (!identity)
            throw fail(
              400,
              "Pagamento não corresponde ao anúncio ou recebedor.",
            );
          result =
            payment.status === "approved"
              ? "payment_verified"
              : ["refunded", "charged_back"].includes(payment.status)
                ? "payment_reversed"
                : "payment_status_verified";
        }
      }
      try {
        await db.$transaction(async (tx) => {
          if (await tx.audit.findUnique({ where: { id: eventId } })) return;
          if (listing && result === "payment_verified")
            await tx.listing.updateMany({
              where: { id: listing.id, paidAt: null },
              data: { paidAt: new Date(), paymentId: resourceId },
            });
          // Estorno não apaga o histórico: retira da vitrine se era este o pagamento.
          if (
            listing &&
            result === "payment_reversed" &&
            listing.paymentId === resourceId
          )
            await tx.listing.updateMany({
              where: {
                id: listing.id,
                paymentId: resourceId,
                status: { notIn: ["CLOSED", "CANCELLED"] },
              },
              data: { status: "REJECTED", reviewed: false },
            });
          await tx.audit.create({
            data: {
              id: eventId,
              actorId: "mercadopago-webhook",
              action:
                mode === "test" ? "MP_WEBHOOK_TEST" : "MP_WEBHOOK_PRODUCTION",
              entityId: resourceId,
              detail: JSON.stringify({
                mode,
                topic,
                result,
                status: order?.status || payment?.status || null,
              }),
            },
          });
        });
      } catch (error) {
        if (
          error.code !== "P2002" ||
          !(await db.audit.findUnique({ where: { id: eventId } }))
        )
          throw error;
      }
      r.json({ received: true, result });
    }),
  );
  app.get(
    "/api/admin/webhooks",
    auth,
    admin,
    wrap(async (_q, r) => {
      const events = await db.audit.findMany({
        where: { action: { in: ["MP_WEBHOOK_TEST", "MP_WEBHOOK_PRODUCTION"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      r.json({
        testConfigured: Boolean(
          env.MP_TEST_ACCESS_TOKEN && env.MP_TEST_WEBHOOK_SECRET,
        ),
        productionConfigured: Boolean(
          env.MP_ACCESS_TOKEN && env.MP_WEBHOOK_SECRET,
        ),
        events: events.map((e) => ({
          resourceId: e.entityId,
          receivedAt: e.createdAt,
          ...JSON.parse(e.detail),
        })),
      });
    }),
  );
}
