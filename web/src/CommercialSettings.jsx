import React, { useEffect, useState } from "react";
export default function CommercialSettings({ request, onConfigChange }) {
  const [settings, setSettings] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    request("/admin/settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);
  if (!settings)
    return (
      <div className="form-panel" role="status">
        {error || "Carregando configurações…"}
      </div>
    );
  return (
    <form
      className="form-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        const f = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const updated = await request("/admin/settings", {
            method: "PUT",
            body: {
              enabled: f.enabled === "on",
            },
          });
          setSettings(updated);
          onConfigChange(updated);
          setMessage("Configurações de contratação salvas.");
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Divulgação e pagamentos</h2>
      <p>
        O Negocieê cobra somente pela divulgação. A negociação é direta com o
        anunciante, sem comissão nos novos anúncios.
      </p>
      <p>
        Divulgação:{" "}
        {(settings.adPrice / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}{" "}
        · Destaque:{" "}
        {(settings.featuredPrice / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}{" "}
        · {settings.durationDays} dias.
      </p>
      <div className="notice">
        <strong>
          Mercado Pago:{" "}
          {settings.paymentsConfigured
            ? "credenciais configuradas no servidor"
            : "aguardando configuração no Render"}
          .
        </strong>
        {!settings.paymentsConfigured && (
          <p>
            No Render, adicione MP_ACCESS_TOKEN e MP_COLLECTOR_ID de produção e
            faça novo deploy. Não coloque esses valores neste painel ou no
            GitHub.
          </p>
        )}
      </div>
      <label className="checkbox">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={settings.requestedEnabled}
          disabled={!settings.paymentsConfigured || busy}
        />
        Ativar contratação e pagamento de novos anúncios
      </label>
      <p>
        Para ativar, as credenciais do Mercado Pago e os preços dos planos
        precisam estar configurados.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "Salvando…" : "Salvar configurações"}
      </button>
    </form>
  );
}
