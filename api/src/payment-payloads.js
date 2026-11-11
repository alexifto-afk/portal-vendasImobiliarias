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
export const payerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(100),
  cpf: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine(validCpf, "CPF inválido."),
});
export function checkoutConfig(origin, descriptor = "LPIMOVEIS") {
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
      transaction_security: { liability_shift: "required" },
    },
  };
}
export function preferencePayload(
  listing,
  user,
  payer,
  origin,
  descriptor = "LPIMOVEIS",
) {
  const registration = new Date(user.createdAt).toISOString();
  return {
    statement_descriptor: checkoutConfig(origin, descriptor)
      .statement_descriptor,
    items: [
      {
        id: listing.id,
        title: `Anúncio por ${listing.durationDays} dias: ${listing.title}`,
        description: `Serviço de divulgação de um imóvel no plano ${listing.plan === "FEATURED" ? "Destaque" : "Divulgação"} por ${listing.durationDays} dias. Atendimento e intermediação contratados separadamente.`,
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
      first_name: "APRO",
      last_name: "Teste",
      identification: { type: "CPF", number: "12345678909" },
    },
    items: [
      {
        title: "Compra de teste do portal",
        description:
          "Simulação do serviço de divulgação de imóvel. Não publica anúncio nem registra receita real.",
        category_id: "services",
        unit_price: amount,
        quantity: 1,
      },
    ],
    // No schema Orders a chave documentada é literal, com ponto; não é objeto aninhado.
    additional_info: { "payer.registration_date": "2026-11-01T00:00:00.000Z" },
  };
}
