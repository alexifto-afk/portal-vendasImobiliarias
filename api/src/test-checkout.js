import { rateLimit } from "express-rate-limit";
const ACTION = "MP_TEST_ORDER_CREATED";
const orderPattern = /^ORDTST[A-Z0-9]{10,80}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => Object.assign(Error(message), { status });
// Lista explícita de códigos: não retornamos payer, cartão, tokens ou JSON bruto.
const technicalCode = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value)
    ? value
    : null;
export function testOrderDiagnostic(order) {
  return {
    statusDetail: technicalCode(order.status_detail),
    applicationId: /^[0-9]{1,30}$/.test(
      String(order.integration_data?.application_id || ""),
    )
      ? String(order.integration_data.application_id)
      : null,
    paymentAttempts: (Array.isArray(order.transactions?.payments)
      ? order.transactions.payments
      : []
    )
      .slice(0, 20)
      .map((payment) => ({
        status: technicalCode(payment.status),
        statusDetail: technicalCode(payment.status_detail),
        errorCodes: (Array.isArray(payment.errors) ? payment.errors : [])
          .slice(0, 10)
          .map((error) => technicalCode(error.code))
          .filter(Boolean),
      })),
    errorCodes: (Array.isArray(order.errors) ? order.errors : [])
      .slice(0, 10)
      .map((error) => technicalCode(error.code))
      .filter(Boolean),
  };
}
export function safeTestOrder(order, sellerId, reference, expectedId) {
  if (
    !orderPattern.test(order.id) ||
    (expectedId && order.id !== expectedId) ||
    String(order.user_id) !== String(sellerId) ||
    order.external_reference !== reference ||
    order.currency !== "BRL" ||
    order.total_amount !== "1.00" ||
    order.type !== "online" ||
    order.processing_mode !== "manual" ||
    order.live_mode === true
  )
    throw fail(
      502,
      "A resposta não corresponde à ordem de teste esperada. Nenhum anúncio foi alterado.",
    );
  let url;
  try {
    url = new URL(order.checkout_url);
  } catch {
    throw fail(502, "Link do checkout de teste indisponível.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.mercadopago.com.br" ||
    !url.pathname.startsWith("/checkout/") ||
    url.searchParams.get("order_id") !== order.id
  )
    throw fail(502, "Link do checkout de teste inválido.");
  const createdAt = new Date(order.created_date),
    age = Date.now() - createdAt.getTime();
  const approved =
    order.status === "processed" && Number(order.total_paid_amount) >= 1;
  return {
    orderId: order.id,
    diagnostic: testOrderDiagnostic(order),
    checkoutUrl: url.href,
    status: String(order.status || "unknown"),
    createdAt: Number.isNaN(createdAt.getTime())
      ? null
      : createdAt.toISOString(),
    approved,
    readyForMeasurement: approved && age >= -300000 && age < 7 * 86400000,
  };
}
export function registerTestCheckoutRoutes(
  app,
  { db, auth, admin, wrap, env, fetchImpl = fetch },
) {
  const client = async (path, options = {}) => {
    const token = env.MP_TEST_ACCESS_TOKEN;
    if (!token)
      throw fail(
        503,
        "Configure MP_TEST_ACCESS_TOKEN no Render com o Access Token da aba Teste.",
      );
    let response;
    try {
      response = await fetchImpl("https://api.mercadopago.com" + path, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw fail(
        502,
        "O Mercado Pago não respondeu. Tente novamente; a tentativa será reutilizada.",
      );
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw fail(
          502,
          "A credencial de teste foi recusada. Confira a aplicação e a conta vendedora de teste.",
        );
      throw fail(
        502,
        "Não foi possível consultar/criar a ordem no Mercado Pago. Confira a integração Checkout Pro via Orders e os logs no Developers.",
      );
    }
    return response.json();
  };
  const seller = async () => {
    const account = await client("/users/me");
    if (
      !account.id ||
      !Array.isArray(account.tags) ||
      !account.tags.includes("test_user")
    )
      throw fail(
        400,
        "A credencial não foi reconhecida como conta de teste. Copie o Access Token da aba Teste da aplicação; não use a credencial de produção.",
      );
    return account.id;
  };
  const limit = rateLimit({
    windowMs: 3600000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.get(
    "/api/admin/test-checkout",
    auth,
    admin,
    wrap(async (_q, r) => {
      const records = await db.audit.findMany({
        where: { action: ACTION },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      r.json({
        configured: Boolean(env.MP_TEST_ACCESS_TOKEN),
        orders: records.map((record) => {
          const d = JSON.parse(record.detail);
          return { ...d.order, approved: false, readyForMeasurement: false };
        }),
      });
    }),
  );
  app.post(
    "/api/admin/test-checkout",
    auth,
    admin,
    limit,
    wrap(async (q, r) => {
      const key = q.body?.idempotencyKey;
      if (!uuidPattern.test(key || ""))
        throw fail(
          400,
          "Identificador de tentativa inválido. Atualize a página.",
        );
      const auditId = "mp-test:" + key;
      const existing = await db.audit.findUnique({ where: { id: auditId } });
      if (existing) {
        if (existing.actorId !== q.user.id)
          throw fail(409, "A tentativa pertence a outro administrador.");
        return r.json(JSON.parse(existing.detail).order);
      }
      const sellerId = await seller(),
        reference = "portal-test-" + key;
      const raw = await client("/v1/orders", {
        method: "POST",
        headers: { "X-Idempotency-Key": key },
        body: JSON.stringify({
          type: "online",
          processing_mode: "manual",
          total_amount: "1.00",
          external_reference: reference,
          description: "Simulação de integração do portal — sem anúncio",
          items: [
            {
              title: "Compra de teste do portal",
              unit_price: "1.00",
              quantity: 1,
            },
          ],
          expiration_time: "P1D",
        }),
      });
      const order = safeTestOrder(raw, sellerId, reference);
      await db.audit.upsert({
        where: { id: auditId },
        update: {},
        create: {
          id: auditId,
          actorId: q.user.id,
          action: ACTION,
          entityId: order.orderId,
          detail: JSON.stringify({ order, sellerId, reference }),
        },
      });
      r.status(201).json(order);
    }),
  );
  app.get(
    "/api/admin/test-checkout/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      if (!orderPattern.test(q.params.id))
        throw fail(400, "Order ID de teste inválido.");
      const record = await db.audit.findFirst({
        where: { action: ACTION, entityId: q.params.id },
      });
      if (!record)
        throw fail(
          404,
          "Ordem não encontrada no histórico de testes deste portal.",
        );
      const saved = JSON.parse(record.detail),
        sellerId = await seller();
      if (String(saved.sellerId) !== String(sellerId))
        throw fail(
          409,
          "A credencial atual pertence a outro vendedor de teste.",
        );
      const order = safeTestOrder(
        await client("/v1/orders/" + encodeURIComponent(q.params.id)),
        sellerId,
        saved.reference,
        q.params.id,
      );
      r.json(order);
    }),
  );
}
