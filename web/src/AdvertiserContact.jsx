import MaskedInput from "./MaskedInput.jsx";
import React, { useState } from "react";
export default function AdvertiserContact({ listing, request }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  if (listing.contactMode !== "DIRECT")
    return (
      <p className="notice">
        O anunciante ainda precisa autorizar o contato direto neste anúncio.
      </p>
    );
  return (
    <div className="advertiser-contact">
      <h3>Gostou? Fale com quem anunciou.</h3>
      <p>Combine os detalhes diretamente com o anunciante pelo WhatsApp.</p>
      {url ? (
        <a className="primary wide" href={url} target="_blank" rel="noreferrer">
          Abrir WhatsApp do anunciante
        </a>
      ) : (
        <button
          className="primary wide"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const d = await request(`/listings/${listing.id}/contact`);
              setUrl(d.whatsapp);
              window.open(d.whatsapp, "_blank", "noopener,noreferrer");
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Preparando contato…" : "Conversar com o anunciante"}
        </button>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function AuthorizeContact({ listing, request, onSaved }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="legacy-contact"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await request(`/owner/listings/${listing.id}/contact`, {
            method: "POST",
            body: {
              ownerPhone: data.get("ownerPhone"),
              contactAccepted: data.get("contactAccepted") === "on",
            },
          });
          await onSaved();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <strong>
        {listing.contactMode === "DIRECT"
          ? "Atualizar WhatsApp do anúncio"
          : "Habilitar contato direto neste anúncio antigo"}
      </strong>
      <p>
        O contato agora é direto com o anunciante. Confirme o número que poderá
        ser acessado pelos interessados.
      </p>
      <label className="field">
        <span>WhatsApp público com DDD</span>
        <MaskedInput
          mask="phone"
          name="ownerPhone"
          type="tel"
          defaultValue={listing.ownerPhone}
          required
          maxLength={24}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="contactAccepted" required />
        Autorizo disponibilizar este WhatsApp aos interessados no anúncio.
      </label>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="outline small" disabled={busy}>
        {busy ? "Salvando…" : "Salvar contato direto"}
      </button>
    </form>
  );
}
