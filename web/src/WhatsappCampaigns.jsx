import React, { useEffect, useState } from "react";
import MaskedInput from "./MaskedInput.jsx";
import Tabs from "./Tabs.jsx";
const labels = {
  PENDING: "Aguardando confirmação",
  ACTIVE: "Confirmado",
  STOPPED: "Cancelado",
  DRAFT: "Rascunho",
  RUNNING: "Em processamento",
  COMPLETE: "Processamento concluído",
  CANCELLED: "Cancelada",
  SENDING: "Enviando",
  ACCEPTED: "Aceito pela Meta",
  DELIVERED: "Entregue",
  READ: "Lido",
  FAILED: "Falhou",
  SKIPPED: "Não enviado",
  UNCERTAIN: "Resultado incerto",
};
const date = (value) => (value ? new Date(value).toLocaleString("pt-BR") : "—");
export function WhatsappSignup({ request }) {
  const [config, setConfig] = useState(null),
    [phone, setPhone] = useState(""),
    [accepted, setAccepted] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    request("/whatsapp/config")
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  if (!config?.enabled) return null;
  return (
    <section className="form-panel whatsapp-signup">
      <h2>Receba novos anúncios pelo WhatsApp</h2>
      <p>
        Inscreva-se para receber novidades do Negocieê. A navegação no portal
        continua livre.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setResult(null);
          try {
            setResult(
              await request("/whatsapp/subscribe", {
                method: "POST",
                body: {
                  phone,
                  consent: accepted,
                  consentVersion: config.consentVersion,
                },
              }),
            );
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          WhatsApp com DDD
          <MaskedInput
            mask="phone"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          {config.consentText}
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Preparando…" : "Quero receber novidades"}
        </button>
      </form>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {result && (
        <div className="notice" role="status">
          <p>{result.message}</p>
          <a
            className="primary"
            href={result.url}
            target="_blank"
            rel="noreferrer"
          >
            Confirmar inscrição no WhatsApp
          </a>
          <p>
            Você só entrará na lista de envio após enviar a mensagem pelo número
            informado.
          </p>
        </div>
      )}
    </section>
  );
}
export default function WhatsappAdmin({ request }) {
  const [tab, setTab] = useState("contacts"),
    [data, setData] = useState(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState(""),
    [selected, setSelected] = useState([]),
    [confirming, setConfirming] = useState(null);
  const load = () =>
    request(
      `/admin/whatsapp?${new URLSearchParams({ search, status, page })}`,
    ).then(setData);
  useEffect(() => {
    let active = true;
    request(`/admin/whatsapp?${new URLSearchParams({ search, status, page })}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [search, status, page]);
  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const active = data?.eligibleCount || 0;
  return (
    <section>
      <h2>WhatsApp e campanhas</h2>
      <p>
        Envios somente para números confirmados pelo próprio titular. Contatos
        de clientes ou anunciantes não entram automaticamente nesta base.
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Carregando…</p>
      ) : (
        <>
          {!data.settings.enabled && (
            <div className="notice">
              Disparos e inscrições aguardam configuração da API oficial do
              WhatsApp Business e modelo de marketing aprovado no Render. Você
              já pode preparar campanhas.{" "}
              {data.settings.missing.length > 0 && (
                <p>Variáveis pendentes: {data.settings.missing.join(", ")}.</p>
              )}
            </div>
          )}
          <p>
            <strong>{active}</strong> contatos confirmados aptos a receber
            novidades.
          </p>
          <Tabs
            id="whatsapp"
            label="Contatos e campanhas"
            value={tab}
            onChange={setTab}
            tabs={[
              ["contacts", "Contatos"],
              ["campaigns", "Campanhas"],
            ]}
          />
          {tab === "contacts" ? (
            <section className="form-panel">
              <h3>Base de contatos</h3>
              <div className="form-grid">
                <label className="field">
                  Pesquisar telefone
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label className="field">
                  Situação
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">Todas</option>
                    <option value="ACTIVE">Confirmados</option>
                    <option value="PENDING">Aguardando confirmação</option>
                    <option value="STOPPED">Cancelados</option>
                  </select>
                </label>
              </div>
              <div className="records-table">
                <table>
                  <thead>
                    <tr>
                      <th>WhatsApp</th>
                      <th>Situação</th>
                      <th>Autorização confirmada</th>
                      <th>Cancelamento</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contacts.map((c) => (
                      <tr key={c.id}>
                        <td>+{c.phone}</td>
                        <td>{labels[c.status]}</td>
                        <td>
                          {date(c.consentAt)}
                          <small>{c.consentVersion}</small>
                        </td>
                        <td>{date(c.revokedAt)}</td>
                        <td>
                          {c.status !== "STOPPED" && (
                            <button
                              className="outline small"
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  request(
                                    `/admin/whatsapp/contacts/${c.id}/stop`,
                                    { method: "POST" },
                                  ),
                                )
                              }
                            >
                              Cancelar recebimento
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.contacts.length && <p>Nenhum contato encontrado.</p>}
              </div>
              <div className="wizard-actions">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {page} · {data.total} contatos
                </span>
                <button
                  type="button"
                  disabled={page * 50 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </div>
              <p className="form-help">
                A confirmação acontece pelo próprio WhatsApp. Para cancelar, o
                titular responde SAIR. A reativação também exige nova
                confirmação dele.
              </p>
            </section>
          ) : (
            <>
              <form
                className="form-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(async () => {
                    await request("/admin/whatsapp/campaigns", {
                      method: "POST",
                      body: { title, listingIds: selected },
                    });
                    setTitle("");
                    setSelected([]);
                  });
                }}
              >
                <h3>Nova campanha</h3>
                <label className="field">
                  Nome interno
                  <input
                    required
                    minLength={3}
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <p>
                  Escolha até 3 anúncios disponíveis. Mostramos os 100 mais
                  recentes.
                </p>
                <div className="whatsapp-ad-options">
                  {data.listings.map((l) => (
                    <label className="checkbox" key={l.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        disabled={
                          !selected.includes(l.id) && selected.length >= 3
                        }
                        onChange={(e) =>
                          setSelected((items) =>
                            e.target.checked
                              ? [...items, l.id]
                              : items.filter((id) => id !== l.id),
                          )
                        }
                      />
                      {l.title}
                    </label>
                  ))}
                </div>
                <button className="primary" disabled={busy || !selected.length}>
                  Salvar rascunho e ver prévia
                </button>
              </form>
              <h3>Campanhas recentes</h3>
              <button
                className="outline small"
                disabled={busy}
                onClick={() => run(async () => {})}
              >
                Atualizar resultados
              </button>
              {data.campaigns.map((c) => (
                <article
                  className="form-panel whatsapp-campaign-card"
                  key={c.id}
                >
                  <h4>{c.title}</h4>
                  <p>
                    {labels[c.status]} · {date(c.createdAt)}
                  </p>
                  <pre className="whatsapp-message-preview">
                    Confira os novos anúncios do Negocieê:{"\n\n"}
                    {c.messageText}
                    {"\n\n"}Para deixar de receber, responda SAIR.
                  </pre>
                  <p>
                    {c._count.deliveries} destinatários ·{" "}
                    {c.counts
                      .map(
                        (count) =>
                          `${labels[count.status] || count.status}: ${count._count}`,
                      )
                      .join(" · ")}
                  </p>
                  {["DRAFT", "RUNNING"].includes(c.status) && (
                    <button
                      className="outline small"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          request(`/admin/whatsapp/campaigns/${c.id}/cancel`, {
                            method: "POST",
                          }),
                        )
                      }
                    >
                      Cancelar campanha e parar a fila
                    </button>
                  )}
                  {c.status === "DRAFT" && (
                    <button
                      className="primary"
                      disabled={busy || !data.settings.enabled || !active}
                      onClick={() => setConfirming(c.id)}
                    >
                      Preparar disparo para {active}{" "}
                      {active === 1 ? "contato" : "contatos"}
                    </button>
                  )}
                  {confirming === c.id && (
                    <div className="notice">
                      <p>
                        Confirma o envio desta campanha para {active}{" "}
                        {active === 1
                          ? "contato confirmado"
                          : "contatos confirmados"}
                        ? A Meta pode cobrar pelas mensagens. Após iniciar, a
                        fila é processada gradualmente, mesmo que você feche o
                        painel.
                      </p>
                      <div className="wizard-actions">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await request(
                                `/admin/whatsapp/campaigns/${c.id}/dispatch`,
                                {
                                  method: "POST",
                                  body: {
                                    confirmed: true,
                                    recipientCount: active,
                                  },
                                },
                              );
                              setConfirming(null);
                            })
                          }
                        >
                          Confirmar envio em lote
                        </button>
                        <button
                          className="outline"
                          disabled={busy}
                          onClick={() => setConfirming(null)}
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
              <p className="form-help">
                “Aceito pela Meta” não confirma entrega. Resultados incertos não
                são reenviados automaticamente para evitar mensagens duplicadas.
                Conclusão do processamento pode incluir falhas ou destinatários
                que cancelaram.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
