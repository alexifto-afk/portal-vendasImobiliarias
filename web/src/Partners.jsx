import React, { useEffect, useRef, useState } from "react";
import {
  money,
  date,
  Input,
  ActionForm,
  Metrics,
  PayoutInfo,
} from "./partner-ui.jsx";
export { default as AdminPartners } from "./AdminPartners.jsx";
export function CouponField({ request, plan, onChange, onPendingChange }) {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <section className="coupon-box" aria-label="Cupom de parceiro">
      <h3>Tem um cupom de desconto?</h3>
      <div className="coupon-actions">
        <Input
          label="Cupom do blogueiro"
          value={code}
          maxLength={32}
          disabled={busy}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setQuote(null);
            setError("");
            onChange(null);
            onPendingChange(Boolean(e.target.value.trim()));
          }}
        />
        <button
          type="button"
          className="outline"
          disabled={busy || !code.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await request("/coupons/quote", {
                method: "POST",
                body: { code, plan },
              });
              if (mounted.current) {
                setQuote(result);
                onChange(result);
                onPendingChange(false);
              }
            } catch (err) {
              if (mounted.current) {
                setError(err.message);
                setQuote(null);
                onChange(null);
              }
            } finally {
              if (mounted.current) setBusy(false);
            }
          }}
        >
          {busy ? "Conferindo…" : "Aplicar cupom"}
        </button>
        {code && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setCode("");
              setQuote(null);
              onChange(null);
              onPendingChange(false);
              setError("");
            }}
          >
            Remover
          </button>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {quote && (
        <p className="notice" role="status">
          Cupom {quote.code}: de <s>{money(quote.originalPrice)}</s> por{" "}
          <strong>{money(quote.finalPrice)}</strong>. Economia de{" "}
          {money(quote.discount)} neste anúncio.
        </p>
      )}
      <small>
        O desconto só vale após aplicar o cupom. Não altera a comissão de
        intermediação do imóvel.
      </small>
    </section>
  );
}
export function PartnerDashboard({ request }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const load = async () => {
    const result = await request("/partner/dashboard");
    setData(result);
    setError("");
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <main className="container dashboard">
      <div className="kicker">ÁREA DO PARCEIRO</div>
      <h1>Suas indicações e créditos</h1>
      <p>
        Compartilhe seu cupom. Cada anúncio pago com ele gera o crédito
        combinado, sem acesso aos dados pessoais de quem anunciou.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p>Carregando seu painel…</p>
      ) : (
        <>
          <Metrics balances={data.balances} />
          {!data.partner.active && (
            <p className="notice">
              Parceria desativada. Consulte o administrador para regularizar o
              acesso e os repasses.
            </p>
          )}
          <h2>Seus cupons</h2>
          {!data.coupons.length && (
            <p>O administrador ainda não cadastrou cupons para você.</p>
          )}
          {data.coupons.map((c) => (
            <article className="form-panel" key={c.code}>
              <h3>
                {c.code} ·{" "}
                {c.active &&
                data.partner.active &&
                new Date(c.expiresAt) > new Date()
                  ? "Ativo"
                  : "Indisponível"}
              </h3>
              <p>
                Desconto do cliente: {money(c.discountCents)} · seu crédito por
                anúncio pago: {money(c.rewardCents)}.
              </p>
              <p>
                {c.paidAds} anúncio(s) pago(s), sem estorno · liberação em{" "}
                {c.holdDays} dias após pagamento.
              </p>
              <p>
                Válido até {date(c.expiresAt)} · planos:{" "}
                {c.plans
                  .map((p) => (p === "BASIC" ? "Divulgação" : "Destaque"))
                  .join(", ")}
              </p>
            </article>
          ))}
          <ActionForm
            label="Solicitar saque via Pix"
            disabled={
              !data.partner.active ||
              data.balances.available < data.partner.minWithdrawal ||
              data.payouts.some((p) => p.status === "REQUESTED")
            }
            action={async (f) => {
              await request("/partner/payouts", {
                method: "POST",
                body: {
                  requestKey: key.current,
                  pixKey: f.pixKey,
                  recipientName: f.recipientName,
                  accepted: f.accepted === "on",
                },
              });
              key.current = crypto.randomUUID();
              await load();
            }}
          >
            <h2>Solicitar saque</h2>
            <p>
              Mínimo: {money(data.partner.minWithdrawal)}. Será solicitado todo
              o saldo disponível, já descontados os estornos. O Pix depende da
              análise e do envio pelo administrador.
            </p>
            <div className="form-grid">
              <Input
                label="Nome do titular da chave Pix"
                name="recipientName"
                minLength={3}
                maxLength={120}
                required
              />
              <Input
                label="Chave Pix"
                name="pixKey"
                minLength={3}
                maxLength={254}
                required
              />
            </div>
            <p>
              Créditos de anúncios estornados são cancelados. Se já tiverem sido
              pagos, o valor será compensado nos próximos créditos. O prazo de
              liberação não impede estornos posteriores.
            </p>
            <label className="checkbox">
              <input type="checkbox" name="accepted" required />
              Confirmo a titularidade da chave Pix, os dados de recebimento e as
              regras de compensação de estornos.
            </label>
            {(!data.partner.active ||
              data.balances.available < data.partner.minWithdrawal ||
              data.payouts.some((p) => p.status === "REQUESTED")) && (
              <p className="notice">
                Um novo pedido exige parceria ativa, saldo mínimo e nenhum saque
                em análise.
              </p>
            )}
          </ActionForm>
          <h2>Solicitações e comprovantes</h2>
          {!data.payouts.length && <p>Nenhum saque solicitado.</p>}
          {data.payouts.map((p) => (
            <article className="form-panel" key={p.id}>
              <PayoutInfo payout={p} />
            </article>
          ))}
          <h2>Extrato de créditos</h2>
          <div className="partner-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Anúncio / lançamento</th>
                  <th>Valor</th>
                  <th>Liberação</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{date(e.createdAt)}</td>
                    <td>
                      {e.listingId}
                      <br />
                      {e.kind === "CREDIT"
                        ? "Crédito por anúncio pago"
                        : "Estorno"}
                    </td>
                    <td>{money(e.amount)}</td>
                    <td>
                      {e.payoutId
                        ? "Vinculado a saque: " + e.payoutId
                        : date(e.availableAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="outline"
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Atualizar extrato
          </button>
        </>
      )}
    </main>
  );
}
