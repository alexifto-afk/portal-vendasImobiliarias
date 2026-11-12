import React, { useEffect, useState } from "react";
import { Search, Pencil, Eye, Trash2, UserPlus } from "lucide-react";
import Dialog from "./Dialog.jsx";
import RecordsTable from "./RecordsTable.jsx";
import { IdentityFields } from "./Profile.jsx";
import {
  date,
  money,
  Input,
  MoneyInput,
  ActionForm,
  amount,
} from "./partner-ui.jsx";
import {
  customerLevel,
  filterCustomers,
  customerEditPayload,
} from "./customer-records.js";
function CustomerEdit({ user, onSave }) {
  const [email, setEmail] = useState(user.email);
  const changesEmail = email.trim().toLowerCase() !== user.email;
  return (
    <ActionForm
      label="Salvar cliente"
      action={(fields) => onSave(customerEditPayload(fields))}
    >
      <IdentityFields values={user} requireComplete={false} />
      <Input
        label="E-mail de acesso do cliente"
        name="email"
        type="email"
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <p className="form-help">
        Os campos ainda não informados de contas antigas podem permanecer
        vazios. O e-mail é o login do cliente; a edição não muda sua senha.
      </p>
      {changesEmail && (
        <label className="checkbox">
          <input type="checkbox" name="confirmEmailChange" required />
          Confirmo que o cliente passará a entrar com este novo e-mail.
        </label>
      )}
    </ActionForm>
  );
}
function CustomerDetails({ user }) {
  const details = [
    ["Nome completo", user.name],
    ["E-mail de acesso", user.email],
    ["CPF", user.cpf],
    ["Celular", user.phone],
    ["Endereço", user.address],
    ["Nível de acesso", customerLevel(user)],
    ["Cadastro", date(user.createdAt)],
    ["Anúncios", user._count.listings],
    ["Fotos em rascunho", user._count.uploads],
  ];
  return (
    <>
      <dl className="customer-details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "Não informado"}</dd>
          </div>
        ))}
      </dl>
      {user.partner && (
        <p className="notice">
          Parceria {user.partner.active ? "ativa" : "desativada"}. Os cupons e
          repasses são gerenciados em Parceiros e cupons.
        </p>
      )}
      {user.listings.length > 0 && (
        <>
          <h3>Anúncios recentes (até 10)</h3>
          <RecordsTable
            label="Anúncios recentes do cliente"
            headings={["Anúncio", "Situação", "Divulgação"]}
            rows={user.listings}
            empty="Nenhum anúncio."
            render={(l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.title}</strong>
                  <small>{l.id}</small>
                </td>
                <td>
                  {l.affiliateVoidedAt
                    ? "Pagamento estornado"
                    : l.paidAt
                      ? "Pago"
                      : "Pagamento pendente"}
                  <small>
                    {{
                      PENDING: "Aguardando análise",
                      PUBLISHED: "Publicado",
                      REJECTED: "Reprovado",
                      CLOSED: "Encerrado",
                      CANCELLED: "Cancelado",
                    }[l.status] || l.status}
                  </small>
                </td>
                <td>{money(l.adPrice)}</td>
              </tr>
            )}
          />
        </>
      )}
    </>
  );
}
function ConvertCustomer({ user, onSave }) {
  const hasContent = user._count.listings > 0 || user._count.uploads > 0;
  const [keep, setKeep] = useState(hasContent && user.role === "OWNER");
  return (
    <ActionForm
      label="Confirmar transformação em parceiro"
      action={(f) =>
        onSave({
          minWithdrawal: amount(f.minWithdrawal),
          keepOwnerAccess: keep,
        })
      }
    >
      <p>
        <strong>{user.name}</strong> terá acesso a cupons, créditos e
        solicitações de saque. O e-mail e a senha atuais serão preservados.
      </p>
      <MoneyInput label="Saque mínimo do parceiro (R$)" name="minWithdrawal" />
      {user.role === "OWNER" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={keep}
            disabled={hasContent}
            onChange={(e) => setKeep(e.target.checked)}
          />
          Manter também o acesso de cliente para criar anúncios
        </label>
      )}
      <div className="notice">
        {keep
          ? "Nível após a conversão: Cliente e parceiro."
          : "Nível após a conversão: Parceiro. O acesso será à área de indicações e ao próprio perfil."}
        {hasContent &&
          " O acesso aos anúncios e fotos existentes será mantido."}
      </div>
      <p className="form-help">
        Depois, cadastre o cupom em Parceiros e cupons. O cliente deve atualizar
        a página ou entrar novamente para ver seu novo acesso.
      </p>
    </ActionForm>
  );
}
export default function Customers({ request, onOpenPartners }) {
  const [users, setUsers] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [level, setLevel] = useState("ALL"),
    [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [converted, setConverted] = useState(false);
  const load = async () => {
    setUsers(await request("/admin/customers"));
    setError("");
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function open(type, row) {
    setDialog({ type, row, loading: true });
    try {
      const user = await request(`/admin/customers/${row.id}`);
      setDialog((current) =>
        current?.type === type && current.row.id === row.id
          ? { type, row: user, loading: false }
          : current,
      );
    } catch (e) {
      setDialog((current) =>
        current?.type === type && current.row.id === row.id
          ? { ...current, error: e.message, loading: false }
          : current,
      );
    }
  }
  async function save(path, method, body, text) {
    setBusy(true);
    setError("");
    setMessage("");
    setConverted(false);
    try {
      await request(path, { method, ...(body ? { body } : {}) });
      await load();
      setDialog(null);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }
  const rows = filterCustomers(users || [], query, level);
  return (
    <section>
      <div className="workspace-heading">
        <div>
          <h2>Clientes cadastrados</h2>
          <p>
            Consulte os usuários, mantenha os dados atualizados e transforme
            clientes em parceiros.
          </p>
        </div>
        <button
          className="outline small"
          disabled={busy}
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Atualizar clientes
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
          {converted && (
            <button className="text-button" onClick={onOpenPartners}>
              Gerenciar parceiros e cupons
            </button>
          )}
        </p>
      )}
      {!users ? (
        <p>Carregando clientes…</p>
      ) : (
        <>
          <div className="records-toolbar">
            <label className="field search-field">
              <span>Pesquisar cliente por nome, e-mail ou celular</span>
              <div className="input-icon">
                <Search size={17} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Digite o nome do cliente"
                />
              </div>
            </label>
            <label className="field">
              <span>Nível de acesso do cliente</span>
              <select
                aria-label="Nível de acesso do cliente"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="CLIENT">Clientes</option>
                <option value="BOTH">Clientes e parceiros</option>
                <option value="PARTNER">Parceiros</option>
              </select>
            </label>
          </div>
          <RecordsTable
            label="Tabela de clientes cadastrados"
            headings={[
              "Cliente",
              "Celular",
              "Nível",
              "Anúncios",
              "Cadastro",
              "Ações",
            ]}
            rows={rows}
            filterKey={query + level}
            empty="Nenhum cliente encontrado. Ajuste a pesquisa ou aguarde novos cadastros."
            render={(u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </td>
                <td>{u.phone || "Não informado"}</td>
                <td>
                  <span className="record-badge">{customerLevel(u)}</span>
                  {u.partner && !u.partner.active && (
                    <small>Parceria desativada</small>
                  )}
                </td>
                <td>{u._count.listings}</td>
                <td>{date(u.createdAt)}</td>
                <td>
                  <div className="row-actions customer-row-actions">
                    <button disabled={busy} onClick={() => open("edit", u)}>
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button disabled={busy} onClick={() => open("details", u)}>
                      <Eye size={14} />
                      Detalhar
                    </button>
                    <button
                      className="danger-text"
                      disabled={busy || Boolean(u.deletionBlock)}
                      title={u.deletionBlock || "Excluir conta sem histórico"}
                      onClick={() => open("delete", u)}
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                    <button
                      disabled={busy || Boolean(u.partner)}
                      title={
                        u.partner
                          ? "Este cliente já possui parceria."
                          : "Preserva o e-mail e a senha da conta."
                      }
                      onClick={() => open("convert", u)}
                    >
                      <UserPlus size={14} />
                      {u.partner ? "Já é parceiro" : "Transformar em parceiro"}
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />
          <p className="form-help">
            Contas administrativas não aparecem nesta lista. A exclusão está
            disponível para contas sem anúncios e sem vínculo de parceiro; fotos
            em rascunho dessas contas também serão removidas.
          </p>
        </>
      )}
      {dialog && (
        <Dialog
          title={
            {
              edit: "Editar cliente",
              details: "Detalhes do cliente",
              delete: "Excluir cliente",
              convert: "Transformar cliente em parceiro",
            }[dialog.type]
          }
          busy={busy}
          onClose={() => setDialog(null)}
        >
          {dialog.loading ? (
            <p role="status">Carregando dados do cliente…</p>
          ) : dialog.error ? (
            <p role="alert" className="notice error">
              {dialog.error}
            </p>
          ) : (
            <>
              {dialog.type === "details" && (
                <CustomerDetails user={dialog.row} />
              )}
              {dialog.type === "edit" && (
                <CustomerEdit
                  user={dialog.row}
                  onSave={(body) =>
                    save(
                      `/admin/customers/${dialog.row.id}`,
                      "PUT",
                      body,
                      "Dados do cliente atualizados.",
                    )
                  }
                />
              )}
              {dialog.type === "convert" && (
                <ConvertCustomer
                  user={dialog.row}
                  onSave={async (body) => {
                    await save(
                      `/admin/customers/${dialog.row.id}/partner`,
                      "POST",
                      body,
                      "Cliente transformado em parceiro. O login e a senha foram preservados.",
                    );
                    setConverted(true);
                  }}
                />
              )}
              {dialog.type === "delete" &&
                (dialog.row.deletionBlock ? (
                  <p className="notice">{dialog.row.deletionBlock}</p>
                ) : (
                  <ActionForm
                    label="Confirmar exclusão do cliente"
                    action={() =>
                      save(
                        `/admin/customers/${dialog.row.id}`,
                        "DELETE",
                        null,
                        "Conta do cliente excluída.",
                      )
                    }
                  >
                    <p>
                      Excluir definitivamente a conta de{" "}
                      <strong>{dialog.row.name}</strong> ({dialog.row.email})?
                      Esta conta não possui anúncios ou vínculo de parceiro.
                    </p>
                    <p>
                      O acesso será removido e {dialog.row._count.uploads}{" "}
                      foto(s) em rascunho serão apagadas.
                    </p>
                    <button
                      className="outline"
                      type="button"
                      onClick={() => setDialog(null)}
                    >
                      Cancelar
                    </button>
                  </ActionForm>
                ))}
            </>
          )}
        </Dialog>
      )}
    </section>
  );
}
