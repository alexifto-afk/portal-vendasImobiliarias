import React, { useEffect, useRef, useState } from "react";
const money = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (n) => new Date(n).toLocaleString("pt-BR");
const status = {
  REQUESTED: "Em análise",
  PAID: "Pago",
  REJECTED: "Recusado/cancelado",
};
const amount = (value) =>
  Math.round(Number(String(value).replace(",", ".")) * 100);
function Input({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
function MoneyInput(props) {
  return <Input type="number" min="0.01" step="0.01" required {...props} />;
}
function ActionForm({
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
function Metrics({ balances }) {
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
function PayoutInfo({ payout: p }) {
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
export function AdminPartners({ request }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const load = async () => {
    setData(await request("/admin/partners"));
    setError("");
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const send = async (path, method, body) => {
    await request(path, { method, body });
    await load();
  };
  return (
    <section>
      <h2>Parceiros, cupons e repasses</h2>
      <p>
        O desconto do anúncio e o crédito do parceiro são independentes da
        comissão de venda ou aluguel do imóvel.
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!data ? (
        <p>Carregando parceiros…</p>
      ) : (
        <>
          <ActionForm
            label="Cadastrar parceiro"
            action={(f) =>
              send("/admin/partners", "POST", {
                email: f.email,
                minWithdrawal: amount(f.minWithdrawal),
              })
            }
          >
            <h3>Novo parceiro</h3>
            <p>
              Peça ao blogueiro que crie primeiro uma conta comum pelo botão
              Entrar. Depois, cadastre o mesmo e-mail aqui. Ele acessará a Área
              do parceiro com a própria senha.
            </p>
            <div className="form-grid">
              <Input
                label="E-mail da conta do parceiro"
                name="email"
                type="email"
                required
              />
              <MoneyInput label="Saque mínimo (R$)" name="minWithdrawal" />
            </div>
          </ActionForm>
          <ActionForm
            label="Criar cupom"
            action={(f) =>
              send("/admin/coupons", "POST", {
                code: f.code,
                partnerId: f.partnerId,
                active: true,
                discountCents: amount(f.discount),
                rewardCents: amount(f.reward),
                holdDays: Number(f.holdDays),
                plans: [f.basic && "BASIC", f.featured && "FEATURED"].filter(
                  Boolean,
                ),
                expiresAt: new Date(f.expiresAt).toISOString(),
                maxUses: f.maxUses ? Number(f.maxUses) : null,
              })
            }
          >
            <h3>Novo cupom</h3>
            <div className="form-grid">
              <label className="field">
                <span>Parceiro</span>
                <select name="partnerId" required>
                  <option value="">Selecione</option>
                  {data.partners
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.user.name} · {p.user.email}
                      </option>
                    ))}
                </select>
              </label>
              <Input
                label="Código exclusivo"
                name="code"
                required
                pattern="[A-Za-z0-9_-]{3,32}"
                maxLength={32}
                placeholder="Ex.: MARIA"
              />
              <MoneyInput
                label="Desconto do cliente por anúncio (R$)"
                name="discount"
              />
              <MoneyInput
                label="Crédito do parceiro por anúncio pago (R$)"
                name="reward"
              />
              <Input
                label="Liberação do crédito após pagamento (dias, mínimo 7)"
                name="holdDays"
                type="number"
                min="7"
                max="365"
                required
              />
              <Input
                label="Validade do cupom (horário local)"
                name="expiresAt"
                type="datetime-local"
                required
              />
              <Input
                label="Limite de anúncios com cupom (opcional)"
                name="maxUses"
                type="number"
                min="1"
                max="1000000"
              />
            </div>
            <div className="coupon-actions">
              <label className="checkbox">
                <input type="checkbox" name="basic" defaultChecked />
                Divulgação
              </label>
              <label className="checkbox">
                <input type="checkbox" name="featured" />
                Destaque
              </label>
            </div>
            <p>
              O limite reserva uma utilização no cadastro do anúncio, mesmo que
              ainda não tenha sido pago. Desconto e crédito juntos não podem
              superar o preço do plano. As condições do cupom são fixas: para
              mudar valores, desative-o e crie outro código.
            </p>
          </ActionForm>
          <h3>Parceiros cadastrados</h3>
          {data.partners.map((p) => (
            <ActionForm
              key={p.id}
              label="Salvar parceiro"
              action={(f) =>
                send(`/admin/partners/${p.id}`, "PUT", {
                  active: f.active === "on",
                  minWithdrawal: amount(f.minWithdrawal),
                })
              }
            >
              <h3>{p.user.name}</h3>
              <p>{p.user.email}</p>
              <Metrics balances={p.balances} />
              <MoneyInput
                label="Saque mínimo (R$)"
                name="minWithdrawal"
                defaultValue={(p.minWithdrawal / 100).toFixed(2)}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={p.active}
                />
                Parceria ativa
              </label>
              <small>
                Desativar impede novas indicações e saques; os créditos e o
                histórico anteriores são preservados.
              </small>
            </ActionForm>
          ))}
          <h3>Cupons cadastrados</h3>
          {data.coupons.map((c) => (
            <ActionForm
              key={c.id + c.active}
              label={c.active ? "Desativar cupom" : "Ativar cupom"}
              action={() =>
                send(`/admin/coupons/${c.id}`, "PUT", { active: !c.active })
              }
            >
              <h3>
                {c.code} · {c.active ? "Ativo" : "Desativado"}
              </h3>
              <p>
                {data.partners.find((p) => p.id === c.partnerId)?.user.name} ·
                cliente economiza {money(c.discountCents)} · parceiro recebe{" "}
                {money(c.rewardCents)}
              </p>
              <p>
                Liberação: {c.holdDays} dias · validade: {date(c.expiresAt)} ·{" "}
                {c.reservations} anúncio(s) reservado(s) /{" "}
                {c.maxUses ?? "sem limite"}
              </p>
            </ActionForm>
          ))}
          <h3>Solicitações de saque</h3>
          <p>
            Confira o saldo reservado e o titular. Faça o Pix no seu banco e só
            então registre a referência do comprovante. Este painel não
            transfere dinheiro automaticamente.
          </p>
          {!data.payouts.length && <p>Nenhuma solicitação.</p>}
          {data.payouts.map((p) => (
            <article className="form-panel" key={p.id}>
              <p>
                Parceiro: {p.partner.user.name} · {p.partner.user.email}
              </p>
              <PayoutInfo payout={p} />
              {p.status === "REQUESTED" && (
                <>
                  <ActionForm
                    label="Registrar Pix como pago"
                    action={(f) =>
                      send(`/admin/partner-payouts/${p.id}/resolve`, "POST", {
                        status: "PAID",
                        receiptReference: f.receiptReference,
                        confirmed: f.confirmed === "on",
                      })
                    }
                  >
                    <Input
                      label="Referência do comprovante / identificador Pix"
                      name="receiptReference"
                      minLength={6}
                      maxLength={200}
                      required
                    />
                    <label className="checkbox">
                      <input type="checkbox" name="confirmed" required />
                      Conferi o favorecido e já efetuei este Pix de{" "}
                      {money(p.amount)}.
                    </label>
                  </ActionForm>
                  <ActionForm
                    label="Recusar e devolver saldo"
                    action={(f) =>
                      send(`/admin/partner-payouts/${p.id}/resolve`, "POST", {
                        status: "REJECTED",
                        note: f.note,
                      })
                    }
                  >
                    <Input
                      label="Motivo da recusa"
                      name="note"
                      required
                      minLength={5}
                      maxLength={500}
                    />
                  </ActionForm>
                </>
              )}
            </article>
          ))}
          <button
            className="outline"
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Atualizar parceiros e saques
          </button>
        </>
      )}
    </section>
  );
}
