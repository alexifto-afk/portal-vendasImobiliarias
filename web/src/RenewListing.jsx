import React, { useState } from "react";
import Dialog from "./Dialog.jsx";
import { CouponField } from "./Partners.jsx";
import PaymentFields, { readPaymentDetails } from "./PaymentFields.jsx";
import MaskedInput from "./MaskedInput.jsx";
import { createListingCheckout } from "./listing-checkout.js";
const money = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function RenewListing({
  listing,
  config,
  request,
  onCreated,
  onResult,
  onClose,
}) {
  const [plan, setPlan] = useState(listing.plan),
    [quote, setQuote] = useState(null),
    [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const promotion = quote?.plan === plan ? quote : null;
  const price =
    promotion?.finalPrice ??
    (plan === "FEATURED" ? config.featuredPrice : config.adPrice);
  return (
    <Dialog title="Renovar anúncio por 30 dias" onClose={onClose} busy={busy}>
      <p>
        <strong>{listing.title}</strong>
      </p>
      <p>
        As fotos e informações serão reaproveitadas. O anúncio permanece
        indisponível até o novo pagamento e a aprovação. O novo período será de
        30 dias a partir dessa aprovação.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || pending) return;
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const result = await createListingCheckout(
              request,
              {
                plan,
                ownerPhone: form.get("ownerPhone"),
                contactAccepted: form.get("contactAccepted") === "on",
                termsAccepted: form.get("termsAccepted") === "on",
                termsVersion: config.renewalTermsVersion,
                ...(promotion
                  ? {
                      couponCode: promotion.code,
                      couponVersion: promotion.version,
                    }
                  : {}),
              },
              onCreated,
              readPaymentDetails(form),
              `/owner/listings/${listing.id}/renew`,
            );
            onResult(result);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="partner-fields" disabled={busy}>
          <div className="plan-options">
            {[
              ["BASIC", "Divulgação", config.adPrice],
              ["FEATURED", "Destaque", config.featuredPrice],
            ].map(([id, name, value]) => (
              <label key={id} className={plan === id ? "chosen" : ""}>
                <input
                  type="radio"
                  checked={plan === id}
                  onChange={() => {
                    setPlan(id);
                    setQuote(null);
                    setPending(false);
                  }}
                />
                <strong>
                  {name} · {money(value)}
                </strong>
                <span>30 dias</span>
              </label>
            ))}
          </div>
          <CouponField
            key={plan}
            request={request}
            plan={plan}
            onChange={setQuote}
            onPendingChange={setPending}
          />
          <label className="field">
            <span>WhatsApp público do anúncio</span>
            <MaskedInput
              mask="phone"
              name="ownerPhone"
              defaultValue={listing.ownerPhone}
              required
            />
          </label>
          <label className="checkbox">
            <input name="contactAccepted" type="checkbox" required />
            Autorizo manter este WhatsApp para contato direto dos interessados.
          </label>
          <PaymentFields />
          <h3>Total da renovação: {money(price)}</h3>
          <div className="terms-text">
            {config.renewalTerms?.[listing.purpose]?.replace(
              (config.adPrice / 100).toFixed(2),
              (price / 100).toFixed(2),
            ) || "Atualize o painel para carregar as condições de renovação."}
          </div>
          <label className="checkbox">
            <input
              key={`${plan}-${price}-${promotion?.code || ""}-${promotion?.version || ""}-${config.renewalTermsVersion}`}
              name="termsAccepted"
              type="checkbox"
              required
            />
            Li e aceito as condições da nova contratação de divulgação por 30
            dias.
          </label>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary wide"
            disabled={
              busy ||
              pending ||
              !config.commercialEnabled ||
              !config.renewalTermsVersion
            }
          >
            {busy ? "Preparando renovação…" : "Renovar e seguir para pagamento"}
          </button>
        </fieldset>
      </form>
    </Dialog>
  );
}
