import MaskedInput from "./MaskedInput.jsx";
import React from "react";
export function readPaymentDetails(form) {
  return {
    firstName: String(form.get("billingFirstName") || "").trim(),
    lastName: String(form.get("billingLastName") || "").trim(),
    phone: String(form.get("billingPhone") || "").trim(),
    cpf: String(form.get("billingCpf") || "").replace(/\D/g, ""),
  };
}
export default function PaymentFields() {
  return (
    <fieldset className="form-panel payment-fields">
      <legend>Dados do anunciante para pagamento</legend>
      <p>
        Informe os dados reais do titular da conta anunciante. Eles serão
        enviados ao Mercado Pago para o pagamento e não aparecerão no anúncio
        público.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>Nome</span>
          <input
            name="billingFirstName"
            autoComplete="billing given-name"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label className="field">
          <span>Sobrenome</span>
          <input
            name="billingLastName"
            autoComplete="billing family-name"
            minLength={2}
            maxLength={100}
            required
          />
        </label>
      </div>
      <label className="field">
        <span>Telefone do pagador com DDD</span>
        <MaskedInput
          mask="phone"
          name="billingPhone"
          type="tel"
          autoComplete="billing tel"
          maxLength={20}
          placeholder="(63) 99999-9999"
          required
        />
      </label>
      <label className="field">
        <span>CPF do pagador</span>
        <MaskedInput
          mask="cpf"
          name="billingCpf"
          inputMode="numeric"
          maxLength={14}
          placeholder="000.000.000-00"
          required
        />
      </label>
    </fieldset>
  );
}
