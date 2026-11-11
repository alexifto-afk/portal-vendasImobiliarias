import RecordsTable from "./RecordsTable.jsx";
import PartnerAccessForm from "./PartnerAccessForm.jsx";
import React, { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Power, Eye } from "lucide-react";
import Tabs from "./Tabs.jsx";
import Dialog from "./Dialog.jsx";
import {
  money,
  date,
  status,
  amount,
  Input,
  MoneyInput,
  ActionForm,
  PayoutInfo,
} from "./partner-ui.jsx";
import { searchRecords } from "./record-search.js";
const localDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
function CouponForm({ initial, partners, onSave }) {
  const used =
    initial && (initial.reservations > 0 || initial._count?.listings > 0);
  return (
    <ActionForm
      label={initial ? "Salvar alterações do cupom" : "Criar cupom"}
      action={(f) =>
        onSave({
          code: f.code,
          ...(initial
            ? { expectedVersion: initial.termsUpdatedAt || initial.createdAt }
            : { partnerId: f.partnerId }),
          active: initial ? f.active === "on" : true,
          discountCents: amount(f.discount),
          rewardCents: amount(f.reward),
          holdDays: Number(f.holdDays),
          plans: [f.basic && "BASIC", f.featured && "FEATURED"].filter(Boolean),
          expiresAt: new Date(f.expiresAt).toISOString(),
          maxUses: f.maxUses ? Number(f.maxUses) : null,
        })
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Parceiro do cupom</span>
          <select
            name="partnerId"
            required
            disabled={Boolean(initial)}
            defaultValue={initial?.partnerId || ""}
          >
            <option value="">Selecione o parceiro</option>
            {partners
              .filter((p) => p.active || p.id === initial?.partnerId)
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
          defaultValue={initial?.code || ""}
          readOnly={Boolean(used)}
          placeholder="Ex.: MARIA"
        />
        <MoneyInput
          label="Desconto do cliente por anúncio (R$)"
          name="discount"
          defaultValue={initial ? initial.discountCents / 100 : ""}
        />
        <MoneyInput
          label="Crédito do parceiro por anúncio pago (R$)"
          name="reward"
          defaultValue={initial ? initial.rewardCents / 100 : ""}
        />
        <Input
          label="Liberação do crédito (dias)"
          name="holdDays"
          type="number"
          min="7"
          max="365"
          required
          defaultValue={initial?.holdDays || ""}
        />
        <Input
          label="Válido até (horário local)"
          name="expiresAt"
          type="datetime-local"
          required
          defaultValue={localDate(initial?.expiresAt)}
        />
        <Input
          label="Limite de anúncios (opcional)"
          name="maxUses"
          type="number"
          min={Math.max(1, initial?.reservations || 0)}
          max="1000000"
          defaultValue={initial?.maxUses || ""}
        />
      </div>
      <fieldset className="plan-checkboxes">
        <legend>Planos participantes</legend>
        <label className="checkbox">
          <input
            type="checkbox"
            name="basic"
            defaultChecked={initial ? initial.plans.includes("BASIC") : true}
          />
          Divulgação
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={initial?.plans.includes("FEATURED") || false}
          />
          Destaque
        </label>
      </fieldset>
      {initial && (
        <label className="checkbox">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial.active}
          />
          Cupom ativo
        </label>
      )}
      <p className="form-help">
        O limite reserva uma utilização no cadastro, mesmo antes do pagamento. O
        prazo de liberação pode ser de 7 a 365 dias.
      </p>
      {initial && (
        <p className="notice">
          As alterações valem para novas contratações. Anúncios já cadastrados
          mantêm desconto, crédito e prazo anteriores. O parceiro do cupom
          {used ? " e o código já utilizado são preservados" : " é preservado"}.
        </p>
      )}
    </ActionForm>
  );
}
export default function AdminPartners({ request }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("partners"),
    [partnerSearch, setPartnerSearch] = useState(""),
    [partnerStatus, setPartnerStatus] = useState("ALL"),
    [couponSearch, setCouponSearch] = useState(""),
    [payoutStatus, setPayoutStatus] = useState("ALL"),
    [dialog, setDialog] = useState(null);
  const load = async () => {
    setData(await request("/admin/partners"));
    setError("");
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function save(path, method, body, success) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, { method, ...(body ? { body } : {}) });
      await load();
      setDialog(null);
      setMessage(success || "Alterações salvas.");
    } finally {
      setBusy(false);
    }
  }
  const toggle = (kind, row) =>
    save(
      `/admin/${kind}/${row.id}`,
      "PUT",
      kind === "partners"
        ? { active: !row.active, minWithdrawal: row.minWithdrawal }
        : { active: !row.active },
      `${kind === "partners" ? "Parceiro" : "Cupom"} ${row.active ? "desativado" : "ativado"}.`,
    ).catch((e) => setError(e.message));
  const partnerBlocked = (p) =>
    data.coupons.some((c) => c.partnerId === p.id) ||
    p._count?.entries > 0 ||
    p._count?.payouts > 0;
  const couponBlocked = (c) => c.reservations > 0 || c._count?.listings > 0;
  const tabs = [
    ["partners", "Parceiros cadastrados", data?.partners.length],
    ["coupons", "Cupons cadastrados", data?.coupons.length],
    [
      "payouts",
      "Solicitações de saque",
      data?.payouts.filter((p) => p.status === "REQUESTED").length,
    ],
    ["new-partner", "Novo parceiro"],
    ["new-coupon", "Novo cupom"],
  ];
  const partners = searchRecords(
    data?.partners || [],
    partnerSearch,
    (p) => `${p.user.name} ${p.user.email}`,
  ).filter(
    (p) => partnerStatus === "ALL" || p.active === (partnerStatus === "ACTIVE"),
  );
  const coupons = searchRecords(
    data?.coupons || [],
    couponSearch,
    (c) =>
      `${c.code} ${data?.partners.find((p) => p.id === c.partnerId)?.user.name || ""}`,
  );
  const payouts = (data?.payouts || []).filter(
    (p) => payoutStatus === "ALL" || p.status === payoutStatus,
  );
  return (
    <section className="partners-workspace">
      <div className="workspace-heading">
        <div>
          <h2>Parceiros, cupons e repasses</h2>
          <p>Gerencie suas parcerias e acompanhe cada etapa em um só lugar.</p>
        </div>
        <button
          className="outline small"
          disabled={busy}
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Atualizar registros
        </button>
      </div>
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
      {!data ? (
        <p>Carregando registros…</p>
      ) : (
        <>
          <Tabs
            id="partners"
            label="Gestão de parceiros e cupons"
            tabs={tabs}
            value={tab}
            onChange={setTab}
          />
          <div
            role="tabpanel"
            id={`partners-panel-${tab}`}
            aria-labelledby={`partners-tab-${tab}`}
            tabIndex={0}
            className="workspace-panel"
          >
            {tab === "partners" && (
              <>
                <div className="workspace-heading">
                  <div>
                    <h3>Parceiros cadastrados</h3>
                    <p>
                      Pesquise por nome ou e-mail e use as ações no final de
                      cada linha.
                    </p>
                  </div>
                  <button
                    className="primary small"
                    onClick={() => setTab("new-partner")}
                  >
                    <Plus size={16} />
                    Novo parceiro
                  </button>
                </div>
                <div className="records-toolbar">
                  <label className="field search-field">
                    <span>Pesquisar parceiros por nome ou e-mail</span>
                    <div className="input-icon">
                      <Search size={17} />
                      <input
                        type="search"
                        value={partnerSearch}
                        onChange={(e) => setPartnerSearch(e.target.value)}
                        placeholder="Digite o nome do parceiro"
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>Situação da parceria</span>
                    <select
                      value={partnerStatus}
                      onChange={(e) => setPartnerStatus(e.target.value)}
                    >
                      <option value="ALL">Todos</option>
                      <option value="ACTIVE">Ativos</option>
                      <option value="INACTIVE">Desativados</option>
                    </select>
                  </label>
                </div>
                <RecordsTable
                  label="Tabela de parceiros"
                  headings={[
                    "Parceiro",
                    "Situação",
                    "Saldo disponível",
                    "Saque mínimo",
                    "Ações",
                  ]}
                  rows={partners}
                  empty="Nenhum parceiro encontrado. Cadastre um parceiro ou ajuste a pesquisa."
                  filterKey={partnerSearch + partnerStatus}
                  render={(p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.user.name}</strong>
                        <small>{p.user.email}</small>
                        <small>
                          Nível:{" "}
                          {p.user.role === "PARTNER"
                            ? "Parceiro"
                            : "Proprietário e parceiro"}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`record-badge ${p.active ? "positive" : ""}`}
                        >
                          {p.active ? "Ativo" : "Desativado"}
                        </span>
                      </td>
                      <td>
                        {money(p.balances.available)}
                        <small>A liberar: {money(p.balances.pending)}</small>
                      </td>
                      <td>{money(p.minWithdrawal)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            disabled={busy}
                            onClick={() =>
                              setDialog({ type: "partner", row: p })
                            }
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => toggle("partners", p)}
                          >
                            <Power size={14} />
                            {p.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            className="danger-text"
                            disabled={busy || partnerBlocked(p)}
                            title={
                              partnerBlocked(p)
                                ? "Parceiros com cupons ou histórico devem ser desativados."
                                : "Excluir apenas a parceria; mantém a conta do usuário."
                            }
                            onClick={() =>
                              setDialog({ type: "delete-partners", row: p })
                            }
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                />
                <p className="form-help">
                  A exclusão remove apenas a parceria sem cupons ou histórico
                  financeiro. A conta do usuário é mantida. Para parceiros com
                  vínculos, use Desativar.
                </p>
              </>
            )}
            {tab === "coupons" && (
              <>
                <div className="workspace-heading">
                  <div>
                    <h3>Cupons cadastrados</h3>
                    <p>Confira descontos, créditos e utilizações.</p>
                  </div>
                  <button
                    className="primary small"
                    onClick={() => setTab("new-coupon")}
                  >
                    <Plus size={16} />
                    Novo cupom
                  </button>
                </div>
                <Input
                  label="Pesquisar cupons por código ou parceiro"
                  type="search"
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                />
                <RecordsTable
                  label="Tabela de cupons"
                  headings={[
                    "Cupom / parceiro",
                    "Desconto / crédito",
                    "Validade",
                    "Utilizações",
                    "Situação",
                    "Ações",
                  ]}
                  rows={coupons}
                  filterKey={couponSearch}
                  empty="Nenhum cupom encontrado."
                  render={(c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.code}</strong>
                        <small>
                          {
                            data.partners.find((p) => p.id === c.partnerId)
                              ?.user.name
                          }
                        </small>
                      </td>
                      <td>
                        {money(c.discountCents)} de desconto
                        <small>
                          {money(c.rewardCents)} de crédito · {c.holdDays} dias
                        </small>
                      </td>
                      <td>{date(c.expiresAt)}</td>
                      <td>
                        {c.reservations} / {c.maxUses ?? "sem limite"}
                      </td>
                      <td>
                        <span
                          className={`record-badge ${c.active && new Date(c.expiresAt) > new Date() ? "positive" : ""}`}
                        >
                          {!c.active
                            ? "Desativado"
                            : new Date(c.expiresAt) <= new Date()
                              ? "Vencido"
                              : "Ativo"}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            disabled={busy}
                            onClick={() =>
                              setDialog({ type: "coupon", row: c })
                            }
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => toggle("coupons", c)}
                          >
                            <Power size={14} />
                            {c.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            className="danger-text"
                            disabled={busy || couponBlocked(c)}
                            title={
                              couponBlocked(c)
                                ? "Cupom utilizado: desative para preservar o histórico."
                                : "Excluir cupom sem utilizações"
                            }
                            onClick={() =>
                              setDialog({ type: "delete-coupons", row: c })
                            }
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                />
                <p className="form-help">
                  Cupons utilizados podem ser editados para novas contratações
                  ou desativados. A exclusão fica disponível para cupons sem
                  utilizações.
                </p>
              </>
            )}
            {tab === "new-partner" && (
              <>
                <h3>Novo parceiro</h3>
                <PartnerAccessForm
                  onSave={async (body) => {
                    await save(
                      "/admin/partners",
                      "POST",
                      body,
                      body.mode === "CREATE"
                        ? "Parceiro cadastrado com login e senha. Informe ao parceiro os dados de acesso definidos."
                        : "Conta existente vinculada à parceria.",
                    );
                    setTab("partners");
                  }}
                />
              </>
            )}
            {tab === "new-coupon" && (
              <>
                <h3>Novo cupom</h3>
                {!data.partners.some((p) => p.active) ? (
                  <div className="notice">
                    Cadastre ou ative um parceiro para criar cupons.{" "}
                    <button
                      className="text-button"
                      onClick={() => setTab("new-partner")}
                    >
                      Cadastrar parceiro
                    </button>
                  </div>
                ) : (
                  <CouponForm
                    partners={data.partners}
                    onSave={async (body) => {
                      await save(
                        "/admin/coupons",
                        "POST",
                        body,
                        "Cupom criado.",
                      );
                      setTab("coupons");
                    }}
                  />
                )}
              </>
            )}
            {tab === "payouts" && (
              <>
                <h3>Solicitações de saque</h3>
                <p>
                  Abra Analisar para conferir os dados e registrar um Pix já
                  realizado ou recusar o pedido.
                </p>
                <label className="field payout-filter">
                  <span>Situação do saque</span>
                  <select
                    value={payoutStatus}
                    onChange={(e) => setPayoutStatus(e.target.value)}
                  >
                    <option value="ALL">Todos</option>
                    {Object.entries(status).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <RecordsTable
                  label="Tabela de solicitações de saque"
                  headings={[
                    "Parceiro",
                    "Solicitado em",
                    "Valor",
                    "Situação",
                    "Ações",
                  ]}
                  rows={payouts}
                  filterKey={payoutStatus}
                  empty="Nenhuma solicitação nesta situação."
                  render={(p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.partner.user.name}</strong>
                        <small>{p.partner.user.email}</small>
                      </td>
                      <td>{date(p.createdAt)}</td>
                      <td>{money(p.amount)}</td>
                      <td>
                        <span
                          className={`record-badge ${p.status === "PAID" ? "positive" : ""}`}
                        >
                          {status[p.status]}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            onClick={() =>
                              setDialog({ type: "payout", row: p })
                            }
                          >
                            <Eye size={14} />
                            {p.status === "REQUESTED"
                              ? "Analisar"
                              : "Ver detalhes"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                />
              </>
            )}
          </div>
        </>
      )}
      {dialog && (
        <Dialog
          title={
            dialog.type === "partner"
              ? "Editar parceiro"
              : dialog.type === "coupon"
                ? "Editar cupom"
                : dialog.type === "payout"
                  ? "Detalhes do saque"
                  : "Confirmar exclusão"
          }
          onClose={() => setDialog(null)}
          busy={busy}
        >
          {dialog.type === "partner" && (
            <ActionForm
              label="Salvar parceiro"
              action={(f) =>
                save(`/admin/partners/${dialog.row.id}`, "PUT", {
                  name: f.name,
                  minWithdrawal: amount(f.minWithdrawal),
                  active: f.active === "on",
                })
              }
            >
              <Input
                label="Nome do parceiro"
                name="name"
                defaultValue={dialog.row.user.name}
                required
                minLength={3}
                maxLength={100}
              />
              <p>{dialog.row.user.email}</p>
              <MoneyInput
                label="Saque mínimo (R$)"
                name="minWithdrawal"
                defaultValue={dialog.row.minWithdrawal / 100}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={dialog.row.active}
                />
                Parceria ativa
              </label>
            </ActionForm>
          )}
          {dialog.type === "coupon" && (
            <CouponForm
              initial={dialog.row}
              partners={data.partners}
              onSave={(body) =>
                save(`/admin/coupons/${dialog.row.id}`, "PUT", body)
              }
            />
          )}
          {dialog.type.startsWith("delete-") && (
            <ActionForm
              label="Confirmar exclusão"
              action={() =>
                save(
                  `/admin/${dialog.type.slice(7)}/${dialog.row.id}`,
                  "DELETE",
                  null,
                  "Registro excluído.",
                )
              }
            >
              <p>
                Excluir{" "}
                <strong>{dialog.row.code || dialog.row.user.name}</strong>? Este
                registro sem vínculos será removido definitivamente.
              </p>
              <button
                type="button"
                className="outline"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
            </ActionForm>
          )}
          {dialog.type === "payout" && (
            <>
              <p>Parceiro: {dialog.row.partner.user.name}</p>
              <PayoutInfo payout={dialog.row} />
              {dialog.row.status === "REQUESTED" && (
                <>
                  <ActionForm
                    label="Registrar Pix como pago"
                    action={(f) =>
                      save(
                        `/admin/partner-payouts/${dialog.row.id}/resolve`,
                        "POST",
                        {
                          status: "PAID",
                          receiptReference: f.receiptReference,
                          confirmed: f.confirmed === "on",
                        },
                      )
                    }
                  >
                    <p>
                      Faça o Pix no seu banco e registre a referência do
                      comprovante após conferir o favorecido e o valor.
                    </p>
                    <Input
                      label="Referência do comprovante / identificador Pix"
                      name="receiptReference"
                      minLength={6}
                      maxLength={200}
                      required
                    />
                    <label className="checkbox">
                      <input type="checkbox" name="confirmed" required />
                      Conferi o favorecido e já fiz o Pix de{" "}
                      {money(dialog.row.amount)}.
                    </label>
                  </ActionForm>
                  <ActionForm
                    label="Recusar e devolver saldo"
                    action={(f) =>
                      save(
                        `/admin/partner-payouts/${dialog.row.id}/resolve`,
                        "POST",
                        { status: "REJECTED", note: f.note },
                      )
                    }
                  >
                    <Input
                      label="Motivo da recusa"
                      name="note"
                      minLength={5}
                      maxLength={500}
                      required
                    />
                  </ActionForm>
                </>
              )}
            </>
          )}
        </Dialog>
      )}
    </section>
  );
}
