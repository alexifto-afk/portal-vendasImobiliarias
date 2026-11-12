export const TERMS_VERSION = "2026-11-classifieds-v2";
export function terms(config) {
  return `Contrato a divulgação do anúncio no Negocieê por ${config.durationDays} dias após a aprovação e confirmação do pagamento de R$ ${(config.adPrice / 100).toFixed(2)}. O valor remunera somente a divulgação e não garante venda ou aluguel. Não há comissão de intermediação para este anúncio. A negociação, entrega, visita e pagamento do produto são combinados diretamente entre anunciante e interessado. Autorizo o uso das imagens e a disponibilização do WhatsApp informado no anúncio para contato direto. Declaro ter autorização para anunciar e ser responsável pela veracidade das informações. O endereço completo, CPF e e-mail da conta não serão publicados. Não há renovação automática. Cancelamento, reembolso e direitos legais aplicáveis devem ser respeitados.`;
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
  category: true,
  state: true,
  details: true,
  contactMode: true,
  purpose: true,
  city: true,
  neighborhood: true,
  price: true,
  area: true,
  bedrooms: true,
  images: true,
};
