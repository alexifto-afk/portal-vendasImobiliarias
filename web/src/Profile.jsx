import MaskedInput from "./MaskedInput.jsx";
import React, { useEffect, useState } from "react";
export function IdentityFields({ values = {}, requireComplete = true }) {
  return (
    <>
      <label className="field">
        <span>Nome completo</span>
        <input
          name="name"
          autoComplete="name"
          defaultValue={values.name || ""}
          minLength={3}
          maxLength={100}
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>CPF</span>
          <MaskedInput
            mask="cpf"
            name="cpf"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={values.cpf || ""}
            maxLength={14}
            placeholder="000.000.000-00"
            required={requireComplete}
          />
        </label>
        <label className="field">
          <span>Celular com DDD</span>
          <MaskedInput
            mask="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={values.phone || ""}
            maxLength={24}
            placeholder="(63) 99999-9999"
            required={requireComplete}
          />
        </label>
      </div>
      <label className="field">
        <span>Endereço completo</span>
        <textarea
          name="address"
          autoComplete="street-address"
          defaultValue={values.address || ""}
          minLength={10}
          maxLength={300}
          rows={3}
          placeholder="Rua, número, complemento, bairro, cidade, UF e CEP"
          required={requireComplete}
        />
      </label>
    </>
  );
}
export default function Profile({ request, onSaved }) {
  const [user, setUser] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    request("/me")
      .then(setUser)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="container dashboard profile-page">
      <div className="kicker">MINHA CONTA</div>
      <h1>Meu perfil</h1>
      <p>Mantenha seus dados de cadastro atualizados.</p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!user ? (
        <p>Carregando seus dados…</p>
      ) : (
        <form
          className="form-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const updated = await request("/me", { method: "PUT", body });
              setUser(updated);
              onSaved(updated);
              setMessage("Seu perfil foi atualizado.");
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!user.profileComplete && (
            <p className="notice">
              Complete CPF, celular e endereço para atualizar seu cadastro.
            </p>
          )}
          <label className="field">
            <span>E-mail da conta</span>
            <input type="email" value={user.email} readOnly />
          </label>
          <fieldset className="partner-fields" disabled={busy}>
            <IdentityFields values={user} />
            <p>
              Seu CPF, celular e endereço são privados e não aparecem nos
              anúncios ou no painel de outros parceiros.
            </p>
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar meu perfil"}
            </button>
          </fieldset>
        </form>
      )}
    </main>
  );
}
