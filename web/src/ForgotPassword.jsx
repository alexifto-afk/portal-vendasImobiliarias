import React, { useEffect, useState } from "react";
import { resetConfirmation, retrySeconds } from "./password-reset.js";
export default function ForgotPassword({
  request,
  initialEmail = "",
  onBack,
  onDone,
}) {
  const [email, setEmail] = useState(initialEmail),
    [challenge, setChallenge] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [cooldown, setCooldown] = useState(0),
    [code, setCode] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function send() {
    setBusy(true);
    setError("");
    try {
      const result = await request("/auth/password-reset/request", {
        method: "POST",
        body: { email },
      });
      setChallenge(result.requestId);
      setMessage(result.message);
      setCooldown(retrySeconds(result.retryAfter));
      setCode("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="kicker">RECUPERAR ACESSO</div>
      <h2>Esqueci minha senha</h2>
      {!challenge ? (
        <>
          <p>
            Informe o e-mail usado para entrar no portal. Enviaremos um código
            para você definir uma nova senha.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="field">
              <span>E-mail da conta</span>
              <input
                type="email"
                autoComplete="email"
                name="email"
                maxLength={254}
                required
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <button className="primary wide" disabled={busy}>
              {busy ? "Solicitando…" : "Enviar código por e-mail"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="notice" role="status">
            {message}
          </p>
          <p className="recovery-email">
            Código para <strong>{email}</strong>. Ele vale por 10 minutos;
            utilize o código mais recente.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              setError("");
              try {
                await request("/auth/password-reset/confirm", {
                  method: "POST",
                  body: resetConfirmation(email, challenge, fields),
                });
                onDone(email);
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset className="partner-fields" disabled={busy}>
              <label className="field">
                <span>Código recebido por e-mail</span>
                <input
                  name="code"
                  className="recovery-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  placeholder="000000"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </label>
              <label className="field">
                <span>Nova senha</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <label className="field">
                <span>Confirmar nova senha</span>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <p className="form-help">
                Use pelo menos 12 caracteres. Após a troca, entre novamente com
                a nova senha; as sessões antigas serão encerradas.
              </p>
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary wide" disabled={busy}>
                {busy ? "Alterando senha…" : "Alterar minha senha"}
              </button>
            </fieldset>
          </form>
          <button
            type="button"
            className="text-button wide"
            disabled={busy || cooldown > 0}
            onClick={send}
          >
            {cooldown
              ? `Reenviar código em ${cooldown > 60 ? Math.ceil(cooldown / 60) + " min" : cooldown + "s"}`
              : "Reenviar código"}
          </button>
          <button
            type="button"
            className="text-button wide"
            disabled={busy}
            onClick={() => {
              setChallenge(null);
              setError("");
              setMessage("");
              setCode("");
            }}
          >
            Usar outro e-mail
          </button>
        </>
      )}
      <button
        type="button"
        className="outline wide"
        disabled={busy}
        onClick={onBack}
      >
        Voltar para entrar
      </button>
    </>
  );
}
