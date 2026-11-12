// Se o checkout falhar depois do cadastro, preserve o anúncio para tentar pagar
// pelo painel, sem repetir o cadastro e criar anúncios duplicados.
export async function createListingCheckout(
  request,
  payload,
  onCreated,
  payer,
  createPath = "/owner/listings",
) {
  const listing = await request(createPath, {
    method: "POST",
    body: payload,
  });
  onCreated(listing);
  if (listing.paidAt) return { listing, paid: true };
  try {
    const checkout = await request(`/owner/listings/${listing.id}/checkout`, {
      method: "POST",
      ...(payer ? { body: { payer } } : {}),
    });
    return { listing, url: checkout.url };
  } catch (error) {
    return {
      listing,
      error: `Seu anúncio foi cadastrado, mas não foi possível abrir o pagamento. Use “Pagar anúncio” abaixo para tentar novamente. ${error.message}`,
    };
  }
}
