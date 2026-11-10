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
              saleCommissionBps: Math.round(Number(f.sale) * 100),
              rentCommissionBps: Math.round(Number(f.rent) * 100),
              enabled: f.enabled === "on",
            },
          });
          setSettings(updated);
          onConfigChange(updated);
          setMessage(
            "Configurações salvas. Os novos percentuais valem somente para novos anúncios.",
          );
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Comissões e pagamentos</h2>
      <p>
        Defina as comissões conforme o contrato de intermediação. Anúncios já
        cadastrados mantêm os percentuais aceitos no cadastro.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>Comissão de venda (%)</span>
          <input
            name="sale"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={settings.saleCommissionBps / 100}
            required
          />
          <small>Percentual sobre o preço final de venda.</small>
        </label>
        <label className="field">
          <span>Comissão de aluguel (%)</span>
          <input
            name="rent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={settings.rentCommissionBps / 100}
            required
          />
          <small>Percentual sobre um aluguel mensal.</small>
        </label>
      </div>
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
        Para ativar, as duas comissões devem ser maiores que zero e as
        credenciais do Mercado Pago precisam estar configuradas.
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
