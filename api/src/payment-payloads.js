import { brandName, brandDescriptor, statementDescriptor } from "./brand.js";
import { z } from "zod";
export function validCpf(value) {
  const cpf = String(value).replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let end = 9; end <= 10; end++) {
    let sum = 0;
    for (let i = 0; i < end; i++) sum += Number(cpf[i]) * (end + 1 - i);
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(cpf[end])) return false;
  }
  return true;
}
export function brazilianPhone(value) {
  let digits = String(value).replace(/\D/g, "");
  if ([12, 13].includes(digits.length) && digits.startsWith("55"))
    digits = digits.slice(2);
  if (!/^[1-9]{2}\d{8,9}$/.test(digits)) return null;
  return { area_code: digits.slice(0, 2), number: digits.slice(2) };
}
export function purchaseMetadata(history) {
  if (!history) return {};
  return {
    // Preferences usa enum próprio; não compartilhar o valor WEB de Orders.
    authentication_type: "Native web",
    is_first_purchase_online: !history.lastPaidAt,
    ...(history.lastPaidAt
      ? { last_purchase: new Date(history.lastPaidAt).toISOString() }
      : {}),
  };
}
export const payerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .transform(brazilianPhone)
    .refine(Boolean, "Informe o telefone do pagador com DDD.")
    .optional(),
  cpf: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine(validCpf, "CPF inválido."),
});
export function checkoutConfig(origin, descriptor = brandDescriptor) {
  descriptor = statementDescriptor(descriptor);
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Object.assign(
      Error("Configure WEB_ORIGIN com uma URL HTTPS pública."),
      { status: 503 },
    );
  if (
    typeof descriptor !== "string" ||
    !descriptor.trim() ||
    !/^[A-Z0-9 ]{1,13}$/.test(descriptor)
  )
    throw Object.assign(
      Error(
        "MP_STATEMENT_DESCRIPTOR deve ter de 1 a 13 letras maiúsculas, números ou espaços.",
      ),
      { status: 503 },
    );
  const base = url.origin;
  return {
    statement_descriptor: descriptor,
    online: {
      success_url: base + "/?payment=returned&flow=test",
      failure_url: base + "/?payment=failure&flow=test",
      pending_url: base + "/?payment=pending&flow=test",
      auto_return: "approved",
      transaction_security: {
        validation: "on_fraud_risk",
        liability_shift: "required",
      },
    },
  };
}
export function preferencePayload(
  listing,
  user,
  payer,
  origin,
  descriptor = brandDescriptor,
  history,
) {
  const registration = new Date(user.createdAt).toISOString();
  return {
    statement_descriptor: checkoutConfig(origin, descriptor)
      .statement_descriptor,
    items: [
      {
        id: listing.id,
        title: `${brandName} · Anúncio por ${listing.durationDays} dias: ${listing.title}`,
        description: `Serviço de divulgação de anúncio no plano ${listing.plan === "FEATURED" ? "Destaque" : "Divulgação"} por ${listing.durationDays} dias. Negociação direta com o anunciante, sem comissão nos novos anúncios.`,
        category_id: "services",
        quantity: 1,
        currency_id: "BRL",
        unit_price: listing.adPrice / 100,
      },
    ],
    payer: {
      name: payer.firstName,
      surname: payer.lastName,
      email: user.email,
      identification: { type: "CPF", number: payer.cpf },
      registration_date: registration,
      ...(payer.phone ? { phone: payer.phone } : {}),
      ...purchaseMetadata(history),
    },
    external_reference: listing.id,
    back_urls: {
      success: origin + "/?payment=returned",
      pending: origin + "/?payment=pending",
      failure: origin + "/?payment=failure",
    },
    auto_return: "approved",
  };
}
export function testOrderPayload(reference, amount, options = {}) {
  return {
    type: "online",
    config: checkoutConfig(
      options.origin || "https://portal-vendas-imobiliarias.vercel.app",
      options.descriptor,
    ),
    processing_mode: "manual",
    total_amount: amount,
    external_reference: reference,
    payer: {
      email: "buyer@email.com",
      phone: { area_code: "11", number: "999999999" },
      first_name: "APRO",
      last_name: "Teste",
      identification: { type: "CPF", number: "12345678909" },
    },
    items: [
      {
        external_code: "PORTAL-TEST-ADVERTISEMENT",
        title: `Compra de teste do ${brandName}`,
        description:
          "Simulação do serviço de divulgação de anúncio. Não publica anúncio nem registra receita real.",
        category_id: "services",
        unit_price: amount,
        quantity: 1,
      },
    ],
    // No schema Orders a chave documentada é literal, com ponto; não é objeto aninhado.
    additional_info: {
      "payer.registration_date": "2026-11-01T00:00:00.000Z",
      // Orders aceita WEB ou MOBILE, conforme industry-data. Portal é web.
      "payer.authentication_type": "WEB",
      "payer.is_first_purchase_online": false,
      "payer.last_purchase": "2026-11-05T00:00:00.000Z",
    },
  };
}
