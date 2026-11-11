import React, { useState } from "react";
export const money = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const date = (n) => new Date(n).toLocaleString("pt-BR");
export const status = {
  REQUESTED: "Em análise",
  PAID: "Pago",
  REJECTED: "Recusado/cancelado",
};
export const amount = (value) =>
  Math.round(Number(String(value).replace(",", ".")) * 100);
export function Input({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function MoneyInput(props) {
  return <Input type="number" min="0.01" step="0.01" required {...props} />;
}
export function ActionForm({
  action,
  children,
  label,
  disabled = false,
  className = "form-panel",
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          await action(Object.fromEntries(new FormData(form)));
          setMessage("Operação concluída.");
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || disabled} className="partner-fields">
        {children}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <button className="primary" disabled={busy || disabled}>
          {busy ? "Aguarde…" : label}
        </button>
      </fieldset>
    </form>
  );
}
export function Metrics({ balances }) {
  return (
    <div className="metrics partner-metrics">
      {[
        ["pending", "A liberar"],
        ["available", "Disponível (líquido de estornos)"],
        ["reserved", "Saques em análise"],
        ["paid", "Repasses pagos"],
      ].map(([k, text]) => (
        <div key={k}>
          <span>{text}</span>
          <strong>{money(balances[k])}</strong>
        </div>
      ))}
    </div>
  );
}
export function PayoutInfo({ payout: p }) {
  return (
    <>
      <h3>
        {money(p.amount)} · {status[p.status]}
      </h3>
      <p>
        Solicitado em {date(p.createdAt)} · protocolo {p.id}
      </p>
      <p>
        Favorecido: {p.recipientName} · Pix: {p.pixKey}
      </p>
      {p.receiptReference && (
        <p>Referência do comprovante Pix: {p.receiptReference}</p>
      )}
      {p.note && <p>{p.note}</p>}
      {p.resolvedAt && <small>Resolvido em {date(p.resolvedAt)}</small>}
    </>
  );
}
