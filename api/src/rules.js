export const TERMS_VERSION = "2026-11-v1";
export function terms(config, purpose) {
  const rate =
    purpose === "RENT" ? config.rentCommissionBps : config.saleCommissionBps;
  return `Autorizo a divulgação do imóvel por ${config.durationDays} dias após a aprovação e confirmação do pagamento de R$ ${(config.adPrice / 100).toFixed(2)}. O anúncio não garante a negociação. Autorizo ${config.brokerName} (${config.brokerCreci}) a intermediar contatos, visitas e propostas. O contato público será exclusivamente o do intermediador. A comissão, de responsabilidade do proprietário, será de ${(rate / 100).toFixed(2)}% sobre ${purpose === "RENT" ? "o valor de um aluguel mensal" : "o preço final de venda"}, conforme contrato de intermediação a ser firmado. Este aceite registra as condições comerciais e não substitui a revisão e assinatura do contrato. Declaro ter autorização para anunciar e autorizar o uso das imagens. Os dados privados serão utilizados para atendimento e gestão da negociação. A contratação deve prever os efeitos de cancelamento, reembolso e os direitos legais aplicáveis.`;
}
export function commission(amount, bps) {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(bps) ||
    bps < 0 ||
    bps > 10000
  )
    throw new Error("Valores inválidos");
  return Math.round((amount * bps) / 10000);
}
export function paymentMatches(payment, listing, collectorId) {
  return (
    payment.status === "approved" &&
    payment.live_mode === true &&
    payment.currency_id === "BRL" &&
    String(payment.external_reference) === listing.id &&
    Math.round(Number(payment.transaction_amount) * 100) === listing.adPrice &&
    String(payment.collector_id) === String(collectorId) &&
    Boolean(payment.id)
  );
}
export function isPublic(listing, now = new Date()) {
  return (
    listing.status === "PUBLISHED" &&
    listing.reviewed &&
    Boolean(listing.paidAt) &&
    !listing.affiliateVoidedAt &&
    new Date(listing.expiresAt) > now
  );
}
export const publicFields = {
  id: true,
  title: true,
  description: true,
  type: true,
  purpose: true,
  city: true,
  neighborhood: true,
  price: true,
  area: true,
  bedrooms: true,
  images: true,
};
