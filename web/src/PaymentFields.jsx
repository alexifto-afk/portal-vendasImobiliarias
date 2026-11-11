import React from "react";
export function readPaymentDetails(form) {
  return {
    firstName: String(form.get("billingFirstName") || "").trim(),
    lastName: String(form.get("billingLastName") || "").trim(),
    cpf: String(form.get("billingCpf") || "").replace(/\D/g, ""),
  };
}
export default function PaymentFields() {
  return (
    <fieldset className="form-panel payment-fields">
      <legend>Dados de quem vai pagar o anúncio</legend>
      <p>
        Informe os dados reais do pagador. Eles serão enviados ao Mercado Pago
        para o pagamento e não aparecerão no anúncio público.
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
        <span>CPF do pagador</span>
        <input
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
