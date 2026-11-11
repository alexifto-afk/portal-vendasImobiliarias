import React, { useEffect, useState } from "react";
import { ArrowUpRight, Copy, RefreshCw } from "lucide-react";
// O payload mudou; não reutilizar a tentativa de uma configuração anterior.
const pendingKey = "portal-mp-test-attempt-buyer-metadata-v3";
export default function TestCheckout({ request }) {
  const [data, setData] = useState(null),
    [webhooks, setWebhooks] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    request("/admin/test-checkout")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    request("/admin/webhooks")
      .then(setWebhooks)
      .catch(() => {});
  }, []);
  const create = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    let key = sessionStorage.getItem(pendingKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(pendingKey, key);
    }
    try {
      const order = await request("/admin/test-checkout", {
        method: "POST",
        body: { idempotencyKey: key },
      });
      setData((previous) => ({
        ...previous,
        orders: [
          order,
          ...previous.orders.filter((o) => o.orderId !== order.orderId),
        ],
      }));
      sessionStorage.removeItem(pendingKey);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const refresh = async (id) => {
    setBusy(true);
    setError("");
    try {
      const order = await request("/admin/test-checkout/" + id);
      setData((previous) => ({
        ...previous,
        orders: previous.orders.map((o) => (o.orderId === id ? order : o)),
      }));
      if (order.readyForMeasurement)
        setMessage(
          "Pagamento de teste aprovado. Copie o Order ID e informe no Mercado Pago Developers.",
        );
      else
        setMessage(
          "Status consultado. Conclua o pagamento de teste no checkout e consulte novamente.",
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="form-panel">
      <div className="kicker">
        EXCLUSIVO DO ADMINISTRADOR · AMBIENTE DE TESTE
      </div>
      <h2>Compra de teste do Mercado Pago</h2>
      <p>
        Gere uma ordem de R$ 10,00 para simular o pagamento e obter o Order ID
        solicitado pelo Developers. Este fluxo não publica imóveis nem registra
        receita no portal.
      </p>
      {!data ? (
        <p role="status">{error || "Carregando…"}</p>
      ) : (
        <>
          <div className="notice">
            {data.configured
              ? "Credencial de teste preenchida. A conta vendedora será verificada antes de criar a ordem."
              : "No Render → Environment, adicione MP_TEST_ACCESS_TOKEN com o Access Token da aba Teste desta aplicação e faça novo deploy da API. Depois atualize esta página."}
          </div>
          <ol className="test-checkout-steps">
            <li>Crie a compra de teste pelo botão abaixo.</li>
            <li>Copie o link do checkout e abra em uma janela anônima.</li>
            <li>
              Continue no checkout sem fazer login no Mercado Pago. Use o cartão
              e os dados de teste exibidos no Developers.
            </li>
            <li>Volte aqui e clique em Consultar pagamento.</li>
            <li>
              Após a aprovação, copie o Order ID para a etapa Medir a qualidade
              da integração.
            </li>
          </ol>
          <button
            className="primary"
            disabled={busy || !data.configured}
            onClick={create}
          >
            {busy ? "Aguarde…" : "Criar compra de teste"}
          </button>
          {webhooks && (
            <details className="notice">
              <summary>
                Recebimento de webhooks ·{" "}
                {webhooks.testConfigured
                  ? "segredo de teste configurado"
                  : "aguardando configuração no Render"}
              </summary>
              <p>
                Para o teste, configure a URL /api/webhooks/mercadopago/test no
                Developers com o evento Order (Mercado Pago). A assinatura
                secreta fica em MP_TEST_WEBHOOK_SECRET no Render.
              </p>
              <button
                type="button"
                className="outline small"
                onClick={async () => {
                  try {
                    setWebhooks(await request("/admin/webhooks"));
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Atualizar notificações
              </button>
              {webhooks.events.map((event, index) => (
                <p key={index}>
                  {event.mode} · {event.resourceId} · {event.result} ·{" "}
                  {event.status || "sem status"} ·{" "}
                  {new Date(event.receivedAt).toLocaleString("pt-BR")}
                </p>
              ))}
            </details>
          )}
          {data.orders.map((order) => (
            <article className="test-order" key={order.orderId}>
              <h3>
                Ordem de teste ·{" "}
                {Number(order.amount || "1.00").toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </h3>
              <label className="field">
                <span>Order ID</span>
                <input
                  readOnly
                  value={order.orderId}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <p>
                Status: <strong>{order.status}</strong>
                {order.createdAt &&
                  ` · criada em ${new Date(order.createdAt).toLocaleString("pt-BR")}`}
              </p>
              {order.diagnostic && (
                <div className="notice">
                  <strong>Diagnóstico da última consulta</strong>
                  <p>
                    Detalhe da ordem:{" "}
                    {order.diagnostic.statusDetail || "não informado"}.
                    Aplicação:{" "}
                    {order.diagnostic.applicationId || "não informada"}.
                  </p>
                  {order.diagnostic.paymentAttempts.map((attempt, index) => (
                    <p key={index}>
                      Tentativa {index + 1}: {attempt.status || "sem status"} /{" "}
                      {attempt.statusDetail || "sem detalhe"}
                      {attempt.errorCodes.length
                        ? ` · códigos: ${attempt.errorCodes.join(", ")}`
                        : ""}
                    </p>
                  ))}
                  {!order.diagnostic.paymentAttempts.length && (
                    <p>
                      A API não retornou tentativas de pagamento nesta ordem. A
                      falha pode ter ocorrido antes do processamento; verifique
                      os logs do checkout no Developers.
                    </p>
                  )}
                  {order.diagnostic.errorCodes.length > 0 && (
                    <p>
                      Códigos da ordem: {order.diagnostic.errorCodes.join(", ")}
                    </p>
                  )}
                  <button
                    type="button"
                    className="outline small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          JSON.stringify(
                            {
                              orderId: order.orderId,
                              status: order.status,
                              createdAt: order.createdAt,
                              ...order.diagnostic,
                            },
                            null,
                            2,
                          ),
                        );
                        setMessage(
                          "Diagnóstico copiado. Pode compartilhar esses códigos para análise.",
                        );
                      } catch {
                        setError(
                          "Não foi possível copiar. Envie uma captura dos códigos mostrados no painel.",
                        );
                      }
                    }}
                  >
                    Copiar diagnóstico
                  </button>
                </div>
              )}
              <div className="test-order-actions">
                <a
                  className="outline small"
                  href={order.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir checkout de teste <ArrowUpRight size={15} />
                </a>
                <button
                  className="outline small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(order.checkoutUrl);
                      setMessage(
                        "Link copiado. Abra uma janela anônima com Ctrl + Shift + N e cole o link.",
                      );
                    } catch {
                      setError(
                        "Não foi possível copiar. Use o endereço do link Abrir checkout de teste.",
                      );
                    }
                  }}
                >
                  <Copy size={15} /> Copiar link
                </button>
                <button
                  className="outline small"
                  disabled={busy}
                  onClick={() => refresh(order.orderId)}
                >
                  <RefreshCw size={15} /> Consultar pagamento
                </button>
                <button
                  className="primary small"
                  disabled={!order.readyForMeasurement}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(order.orderId);
                      setMessage(
                        "Order ID copiado. Informe no Mercado Pago Developers.",
                      );
                    } catch {
                      setError("Selecione e copie o Order ID no campo acima.");
                    }
                  }}
                >
                  Copiar Order ID aprovado
                </button>
              </div>
              {!order.readyForMeasurement && (
                <p>
                  Consulte o status após concluir a compra de teste. Para a
                  medição, use uma compra aprovada nos últimos 7 dias.
                </p>
              )}
            </article>
          ))}
        </>
      )}
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
    </section>
  );
}
