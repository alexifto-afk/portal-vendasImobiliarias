import Customers from "./Customers.jsx";
import { dashboardFor } from "./partner-access.js";
import Tabs from "./Tabs.jsx";
import Profile, { IdentityFields } from "./Profile.jsx";
import { CouponField, PartnerDashboard, AdminPartners } from "./Partners.jsx";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  House,
  Trees,
  LandPlot,
  Search,
  Menu,
  X,
  Check,
  MessageCircle,
  Plus,
  LogOut,
  Building2,
} from "lucide-react";
import "./style.css";
import { paymentReturnMessage } from "./payment-result.js";
import { MediaImage, PhotoPicker } from "./media.jsx";
import { uploadSelectedPhotos } from "./photo-uploads.js";
import CommercialSettings from "./CommercialSettings.jsx";
import PaymentFields, { readPaymentDetails } from "./PaymentFields.jsx";
import TestCheckout from "./TestCheckout.jsx";
import { createListingCheckout } from "./listing-checkout.js";
import { emptyFilters, findListings, areaLabel } from "./catalog.js";
const API = (
  import.meta.env.VITE_API_URL || "http://localhost:3002/api"
).replace(/\/$/, "");
const money = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const typeNames = { HOUSE: "Casa", LOT: "Lote", FARM: "Fazenda" },
  statusNames = {
    PENDING: "Aguardando pagamento e análise",
    PUBLISHED: "Publicado",
    REJECTED: "Reprovado — fale com o corretor",
    CLOSED: "Negociação concluída",
    CANCELLED: "Cancelado",
  };
const initialConfig = {
  brokerName: "Lourival Missias Pereira",
  brokerPhone: "5563999915770",
  brokerCreci: "778D-22",
  adPrice: 2990,
  featuredPrice: 5990,
  durationDays: 30,
  commercialEnabled: false,
  saleCommissionBps: 0,
  rentCommissionBps: 0,
};
const demo = [
  {
    id: "demo-casa",
    title: "Uma casa para viver novos capítulos",
    type: "HOUSE",
    purpose: "SALE",
    city: "Palmas",
    neighborhood: "Plano Diretor Sul",
    price: 68000000,
    area: 180,
    bedrooms: 3,
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1100&q=85",
    ],
  },
  {
    id: "demo-fazenda",
    title: "Espaço para crescer. Natureza para ficar.",
    type: "FARM",
    purpose: "SALE",
    city: "Porto Nacional",
    neighborhood: "Zona rural",
    price: 245000000,
    area: 960000,
    bedrooms: 4,
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1100&q=85",
    ],
  },
  {
    id: "demo-lote",
    title: "Seu próximo projeto começa aqui",
    type: "LOT",
    purpose: "SALE",
    city: "Palmas",
    neighborhood: "Região sul",
    price: 14500000,
    area: 360,
    bedrooms: 0,
    images: [
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85",
    ],
  },
];
let accessToken = sessionStorage.getItem("portal-token") || "";
async function api(path, options = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(options.body
        ? {
            body:
              options.body instanceof FormData
                ? options.body
                : JSON.stringify(options.body),
          }
        : {}),
    });
  } catch {
    throw Error(
      "Não foi possível conectar ao servidor. Tente novamente em instantes.",
    );
  }
  const d = await r
    .json()
    .catch(() => ({ error: "Resposta inválida do servidor." }));
  if (!r.ok) throw Error(d.error || "Não foi possível concluir.");
  return d;
}
function Photo(props) {
  return <MediaImage {...props} apiBase={API} token={accessToken} />;
}
function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
function App() {
  const [config, setConfig] = useState(initialConfig),
    [view, setView] = useState("home"),
    [user, setUser] = useState(null),
    [listings, setListings] = useState([]),
    [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false),
    [error, setError] = useState(""),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [filters, setFilters] = useState(emptyFilters),
    [sort, setSort] = useState("recommended"),
    [mobile, setMobile] = useState(false);
  useEffect(() => {
    Promise.all([
      api("/config").then(setConfig),
      api("/listings").then(setListings),
    ])
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
    if (accessToken) {
      const restoredToken = accessToken;
      api("/me")
        .then((u) => {
          if (accessToken !== restoredToken) return;
          setUser(u);
          if (u.role === "PARTNER") setView("partner");
        })
        .catch(() => {
          if (accessToken !== restoredToken) return;
          sessionStorage.removeItem("portal-token");
          accessToken = "";
        });
    }
  }, []);
  const go = (v) => {
    setView(v);
    setMobile(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const announce = () =>
    user ? go(user.role === "PARTNER" ? "partner" : "owner") : setModal("auth");
  const logout = () => {
    sessionStorage.removeItem("portal-token");
    accessToken = "";
    setUser(null);
    setModal(null);
    setSelected(null);
    go("home");
  };
  const source = offline ? demo : listings,
    visible = findListings(source, filters, sort);
  const hasFilters = Object.values(filters).some(Boolean);
  const wa = `https://wa.me/${config.brokerPhone}`;
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brand-icon">
            <House size={25} />
          </span>
          <span>
            LP<span className="brand-light"> imóveis</span>
            <small>TOCANTINS · BRASIL</small>
          </span>
        </a>
        <nav className={mobile ? "open" : ""}>
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => go("home")}
          >
            Encontrar imóvel
          </button>
          <button
            onClick={() => {
              go("home");
              setTimeout(
                () =>
                  document
                    .getElementById("como-funciona")
                    ?.scrollIntoView({ behavior: "smooth" }),
                50,
              );
            }}
          >
            Como funciona
          </button>
          <a href={wa} target="_blank" rel="noreferrer">
            Fale com Lourival <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="header-actions">
          {!user && (
            <button
              className="text-button login-button"
              onClick={() => setModal("auth")}
            >
              Entrar
            </button>
          )}
          {user?.role !== "PARTNER" && (
            <button className="primary small" onClick={announce}>
              Anunciar imóvel <Plus size={16} />
            </button>
          )}
          <button
            className="mobile-toggle"
            aria-label="Abrir menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
        </div>
      </header>
      {user && (
        <section className="account-bar" aria-label="Sua sessão">
          <div className="account-identity">
            <span className="account-avatar" aria-hidden="true">
              {user.name?.trim().charAt(0).toUpperCase()}
            </span>
            <div>
              <small>
                Você está conectado
                {user.role === "PARTNER" ? " · Nível Parceiro" : ""}
              </small>
              <strong title={user.name}>{user.name}</strong>
            </div>
          </div>
          <div className="account-links">
            <button
              className={view === dashboardFor(user) ? "selected" : ""}
              onClick={() => go(dashboardFor(user))}
            >
              Meu painel
            </button>
            {user.partner && user.role !== "PARTNER" && (
              <button
                className={view === "partner" ? "selected" : ""}
                onClick={() => go("partner")}
              >
                Área do parceiro
              </button>
            )}
            <button
              className={view === "profile" ? "selected" : ""}
              onClick={() => go("profile")}
            >
              Meu perfil
            </button>
            <button className="logout-button" onClick={logout}>
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </section>
      )}
      {paymentReturnMessage(new URLSearchParams(window.location.search)) && (
        <div className="notice" role="status">
          {paymentReturnMessage(new URLSearchParams(window.location.search))}
        </div>
      )}
      {error && (
        <div role="alert" className="notice error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {view === "home" ? (
        <>
          <section className="catalog-intro container">
            <div>
              <div className="kicker">IMÓVEIS NO TOCANTINS</div>
              <h1>Qual imóvel você procura?</h1>
              <p>
                Compare casas, lotes e fazendas. Escolha seu imóvel e agende uma
                visita com Lourival.
              </p>
            </div>
            <a
              className="catalog-help"
              href={wa}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={19} />
              <span>
                Precisa de ajuda?
                <strong>
                  Fale com Lourival <ArrowUpRight size={14} />
                </strong>
              </span>
            </a>
          </section>
          <section
            className="catalog-search container"
            aria-label="Encontrar imóvel"
          >
            <div
              className="purpose-options"
              role="group"
              aria-label="Finalidade"
            >
              {[
                ["", "Todos"],
                ["SALE", "Comprar"],
                ["RENT", "Alugar"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filters.purpose === value}
                  className={filters.purpose === value ? "selected" : ""}
                  onClick={() =>
                    setFilters({ ...filters, purpose: value, maxPrice: "" })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <form
              className="catalog-fields"
              onSubmit={(e) => {
                e.preventDefault();
                document
                  .getElementById("imoveis")
                  .scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Field label="Cidade">
                <div className="input-icon">
                  <MapPin size={18} />
                  <input
                    aria-label="Cidade"
                    placeholder="Ex.: Palmas"
                    value={filters.city}
                    onChange={(e) =>
                      setFilters({ ...filters, city: e.target.value })
                    }
                  />
                </div>
              </Field>
              <Field label="Tipo de imóvel">
                <select
                  value={filters.type}
                  onChange={(e) =>
                    setFilters({ ...filters, type: e.target.value })
                  }
                >
                  <option value="">Todos os tipos</option>
                  <option value="HOUSE">Casa</option>
                  <option value="LOT">Lote</option>
                  <option value="FARM">Fazenda</option>
                </select>
              </Field>
              <Field
                label={
                  filters.purpose === "RENT"
                    ? "Aluguel mensal até"
                    : "Preço até"
                }
              >
                <select
                  value={filters.maxPrice}
                  onChange={(e) =>
                    setFilters({ ...filters, maxPrice: e.target.value })
                  }
                >
                  <option value="">Qualquer valor</option>
                  {(filters.purpose === "RENT"
                    ? [1000, 2000, 3000, 5000, 10000]
                    : [150000, 300000, 600000, 1000000, 3000000]
                  ).map((n) => (
                    <option value={n} key={n}>
                      {money(n * 100)}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="primary" type="submit">
                <Search size={18} /> Ver imóveis
              </button>
            </form>
          </section>
          <main className="container catalog-main">
            <section id="imoveis" className="properties">
              <div
                className="category-row catalog-categories"
                role="group"
                aria-label="Escolher tipo de imóvel"
              >
                {[
                  ["", "Todos", Building2],
                  ["HOUSE", "Casas", House],
                  ["LOT", "Lotes", LandPlot],
                  ["FARM", "Fazendas", Trees],
                ].map(([value, label, Icon]) => (
                  <button
                    key={value}
                    aria-pressed={filters.type === value}
                    className={filters.type === value ? "selected" : ""}
                    onClick={() => setFilters({ ...filters, type: value })}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="section-heading catalog-results">
                <div>
                  <h2>
                    {filters.type
                      ? { HOUSE: "Casas", LOT: "Lotes", FARM: "Fazendas" }[
                          filters.type
                        ]
                      : "Imóveis"}{" "}
                    {filters.purpose === "RENT"
                      ? "para alugar"
                      : filters.purpose === "SALE"
                        ? "à venda"
                        : "para você"}
                  </h2>
                  <p role="status" aria-live="polite">
                    {loading
                      ? "Buscando imóveis disponíveis…"
                      : `${visible.length} ${visible.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}${offline ? " · exemplos ilustrativos" : ""}`}
                    {filters.city && ` em ${filters.city}`}
                  </p>
                </div>
                <div className="results-actions">
                  {hasFilters && (
                    <button
                      className="text-button"
                      onClick={() => setFilters(emptyFilters)}
                    >
                      <X size={14} /> Limpar filtros
                    </button>
                  )}
                  <label className="sort-label">
                    Ordenar por
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recommended">Recomendados</option>
                      <option value="price-asc">Menor preço</option>
                      <option value="price-desc">Maior preço</option>
                    </select>
                  </label>
                </div>
              </div>
              {offline && (
                <div className="notice">
                  Prévia visual: os imóveis abaixo são exemplos e não estão à
                  venda. Conecte a API para exibir anúncios reais.
                </div>
              )}
              <div className="property-grid">
                {visible.map((l) => (
                  <article className="property-card" key={l.id}>
                    <button
                      className="card-image"
                      onClick={() => {
                        setSelected(l);
                        setModal("property");
                      }}
                    >
                      <Photo
                        src={l.images[0]}
                        alt={l.title}
                        loading={visible.indexOf(l) < 3 ? "eager" : "lazy"}
                      />
                      <span className="image-tag">
                        {offline
                          ? "Exemplo"
                          : l.purpose === "RENT"
                            ? "Para alugar"
                            : "À venda"}
                      </span>
                      <span className="image-type">{typeNames[l.type]}</span>
                      <span className="image-arrow">
                        <ArrowUpRight size={21} />
                      </span>
                    </button>
                    <div className="card-content">
                      <div className="card-location">
                        <MapPin size={13} />
                        {l.neighborhood} · {l.city}, TO
                      </div>
                      <h3>
                        <button
                          onClick={() => {
                            setSelected(l);
                            setModal("property");
                          }}
                        >
                          {l.title}
                        </button>
                      </h3>
                      <div className="card-features">
                        <span>
                          <LandPlot size={15} />
                          {areaLabel(l)}
                        </span>
                        {l.bedrooms > 0 && (
                          <span>
                            <House size={15} />
                            {l.bedrooms} quartos
                          </span>
                        )}
                      </div>
                      <div className="card-bottom">
                        <strong>
                          {money(l.price)}
                          {l.purpose === "RENT" && <small>/mês</small>}
                        </strong>
                        <button
                          aria-label={`Ver ${l.title}`}
                          onClick={() => {
                            setSelected(l);
                            setModal("property");
                          }}
                        >
                          Ver imóvel <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {loading && (
                <div className="catalog-loading" role="status">
                  Carregando anúncios disponíveis…
                </div>
              )}
              {!loading && !visible.length && (
                <div className="empty">
                  <House size={35} />
                  <h3>
                    {hasFilters
                      ? "Não encontramos imóveis com esses filtros."
                      : "Novos imóveis em breve."}
                  </h3>
                  <p>
                    {hasFilters
                      ? "Experimente outra cidade, tipo de imóvel ou faixa de preço."
                      : "Fale com Lourival para consultar oportunidades na região."}
                  </p>
                  {hasFilters && (
                    <button
                      className="outline"
                      onClick={() => setFilters(emptyFilters)}
                    >
                      Ver todos os imóveis
                    </button>
                  )}
                  <a
                    className="primary"
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Falar com Lourival <ArrowUpRight size={18} />
                  </a>
                </div>
              )}
            </section>
            <section className="sell-banner">
              <div>
                <span className="eyebrow">PARA QUEM QUER ANUNCIAR</span>
                <h2>
                  Seu imóvel merece
                  <br />
                  ser <em>encontrado.</em>
                </h2>
                <p>
                  Você anuncia. Lourival cuida dos contatos,
                  <br />
                  das visitas e da negociação.
                </p>
                <button className="cream" onClick={announce}>
                  Quero anunciar meu imóvel <ArrowUpRight size={19} />
                </button>
              </div>
              <div className="plan-card">
                <span>PLANO DIVULGAÇÃO</span>
                <h3>
                  {money(config.adPrice)}
                  <small> / {config.durationDays} dias</small>
                </h3>
                <p>Seu próximo negócio começa com visibilidade.</p>
                <ul>
                  <li>
                    <Check size={17} />
                    Anúncio com até 12 fotos
                  </li>
                  <li>
                    <Check size={17} />
                    Atendimento centralizado com Lourival
                  </li>
                  <li>
                    <Check size={17} />
                    Acompanhamento das oportunidades
                  </li>
                </ul>
                <div className="plan-note">
                  Comissão de intermediação cobrada separadamente, conforme
                  contrato.
                </div>
              </div>
            </section>
            <section id="como-funciona" className="how">
              <div className="kicker">SIMPLES, DO INÍCIO AO FIM</div>
              <h2>O próximo passo é mais fácil com alguém ao lado.</h2>
              <div className="steps">
                {[
                  [
                    "01",
                    "Cadastre seu imóvel",
                    "Escolha seu plano, informe os detalhes e aceite as condições de divulgação e intermediação.",
                  ],
                  [
                    "02",
                    "Dê visibilidade ao seu anúncio",
                    "Após o pagamento confirmado e a análise, seu imóvel fica disponível pelo período contratado.",
                  ],
                  [
                    "03",
                    "Negocie com acompanhamento",
                    "Lourival atende os interessados, organiza visitas e acompanha a negociação com você.",
                  ],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </>
      ) : view === "profile" ? (
        <Profile
          request={api}
          onSaved={(updated) =>
            setUser((current) =>
              accessToken && current?.id === updated.id ? updated : current,
            )
          }
        />
      ) : view === "partner" ? (
        <PartnerDashboard request={api} />
      ) : view === "owner" ? (
        <Owner config={config} setError={setError} />
      ) : (
        <Admin
          config={config}
          setError={setError}
          onConfigChange={setConfig}
          userName={user?.name}
        />
      )}
      <footer>
        <a className="brand" href="#" onClick={() => go("home")}>
          <span className="brand-icon">
            <House size={22} />
          </span>
          <span>
            LP imóveis<small>TOCANTINS · BRASIL</small>
          </span>
        </a>
        <div>
          <strong>{config.brokerName}</strong>
          <p>CRECI informado: {config.brokerCreci} · Tocantins</p>
          <a href={wa} target="_blank" rel="noreferrer">
            (63) 99991-5770 <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="footer-end">
          <button onClick={() => setModal("privacy")}>
            Privacidade e condições
          </button>
          <p>© {new Date().getFullYear()} LP Imóveis</p>
        </div>
      </footer>
      {modal && (
        <div className="modal-shade" onClick={() => setModal(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "auth"
                ? "Acesso ao portal"
                : modal === "property"
                  ? "Detalhes do imóvel"
                  : "Privacidade e condições"
            }
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Fechar"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            {modal === "auth" ? (
              <Auth
                onSuccess={(d) => {
                  accessToken = d.token;
                  sessionStorage.setItem("portal-token", d.token);
                  setUser(d.user);
                  setModal(null);
                  go(dashboardFor(d.user));
                }}
              />
            ) : modal === "property" ? (
              <Property listing={selected} demo={offline} config={config} />
            ) : (
              <>
                <div className="kicker">TRANSPARÊNCIA</div>
                <h2>Privacidade e condições</h2>
                <p>
                  Nome, CPF, celular e endereço do cadastro são utilizados para
                  administrar sua conta, a contratação e o atendimento. Os dados
                  do imóvel são utilizados na divulgação. Nome e telefone de
                  interessados são utilizados por Lourival para atender à
                  solicitação de contato e registrar visitas e propostas. Dados
                  do proprietário e endereço completo não aparecem na consulta
                  pública da API.
                </p>
                <p>
                  O preço do anúncio remunera a divulgação pelo prazo contratado
                  e não garante venda ou aluguel. A comissão de intermediação é
                  separada e será definida e formalizada em contrato. Não há
                  renovação automática neste sistema.
                </p>
                <p>
                  Para acesso, correção, exclusão de dados, cancelamento ou
                  reembolso, fale com Lourival pelo WhatsApp. Prazos de
                  retenção, identificação do controlador e condições finais de
                  contratação devem ser revisados e publicados antes de ativar a
                  operação comercial.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function Auth({ onSuccess }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <div className="kicker">ACESSO AO PORTAL</div>
      <h2>
        {register ? "Seu imóvel, novos caminhos." : "Que bom ter você aqui."}
      </h2>
      <p>
        {register
          ? "Crie sua conta para anunciar e acompanhar seu imóvel."
          : "Entre para acessar seu painel e acompanhar suas atividades."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            onSuccess(
              await api(`/auth/${register ? "register" : "login"}`, {
                method: "POST",
                body: Object.fromEntries(new FormData(e.currentTarget)),
              }),
            );
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <>
            <IdentityFields />
            <p className="form-help">
              Esses dados compõem seu cadastro e não serão exibidos nos anúncios
              públicos.
            </p>
          </>
        )}
        <Field
          label="E-mail"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          required
          minLength={register ? 12 : 1}
          maxLength={128}
          autoComplete={register ? "new-password" : "current-password"}
        />
        {register && <small>Use pelo menos 12 caracteres.</small>}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary wide">
          {busy ? "Aguarde…" : register ? "Criar minha conta" : "Entrar"}
          <ArrowRight size={17} />
        </button>
      </form>
      <button
        className="text-button wide"
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register ? "Já tenho uma conta" : "Quero criar uma conta"}
      </button>
    </>
  );
}
function Property({ listing: l, demo, config }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  return (
    <>
      <Photo className="detail-cover" src={l.images[0]} alt={l.title} />
      <div className="kicker">
        {typeNames[l.type]} · {l.purpose === "RENT" ? "PARA ALUGAR" : "À VENDA"}
      </div>
      <h2>{l.title}</h2>
      <p>
        <MapPin size={15} /> {l.neighborhood} · {l.city}, TO
      </p>
      <h3>
        {money(l.price)} {l.purpose === "RENT" ? "/mês" : ""}
      </h3>
      <p>
        {l.area.toLocaleString("pt-BR")} m²{" "}
        {l.bedrooms > 0 ? `· ${l.bedrooms} quartos` : ""}
      </p>
      <p className="description">
        {l.description ||
          "Imóvel ilustrativo para apresentar o portal. Não se trata de oferta real."}
      </p>
      {l.images.length > 1 && (
        <div className="gallery">
          {l.images.slice(1).map((src) => (
            <Photo key={src} src={src} alt="Outro ângulo do imóvel" />
          ))}
        </div>
      )}
      {demo ? (
        <div className="notice">
          Este é um exemplo visual. O agendamento será habilitado nos anúncios
          reais.
        </div>
      ) : (
        <>
          <h3>Vamos conhecer esse imóvel?</h3>
          <p>O contato e as visitas são organizados por {config.brokerName}.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              try {
                const f = Object.fromEntries(new FormData(e.currentTarget));
                const d = await api(`/listings/${l.id}/leads`, {
                  method: "POST",
                  body: {
                    ...f,
                    phone: f.phone.replace(/\D/g, ""),
                    consent: f.consent === "on",
                  },
                });
                setUrl(d.whatsapp);
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Seu nome" name="name" required minLength={3} />
            <Field label="WhatsApp com DDD" name="phone" type="tel" required />
            <Field label="Mensagem" name="message" maxLength={1000} />
            <label className="checkbox">
              <input name="consent" type="checkbox" required />
              Autorizo o uso dos meus dados para este atendimento e contato pelo
              corretor.
            </label>
            {error && <p className="notice error">{error}</p>}
            <button disabled={busy} className="primary wide">
              {busy ? "Registrando…" : "Registrar interesse"}
              <MessageCircle size={17} />
            </button>
          </form>
          {url && (
            <a
              className="cream wide"
              target="_blank"
              rel="noreferrer"
              href={url}
            >
              Continuar no WhatsApp de Lourival <ArrowUpRight size={17} />
            </a>
          )}
        </>
      )}
    </>
  );
}
function Owner({ config, setError }) {
  const [items, setItems] = useState([]),
    [photos, setPhotos] = useState([]),
    [paymentListing, setPaymentListing] = useState(null),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [purpose, setPurpose] = useState("SALE"),
    [plan, setPlan] = useState("BASIC"),
    [couponQuote, setCouponQuote] = useState(null),
    [couponPending, setCouponPending] = useState(false);
  useEffect(() => {
    if (!show) {
      setCouponQuote(null);
      setCouponPending(false);
    }
  }, [show]);
  const promotion = couponQuote?.plan === plan ? couponQuote : null;
  const finalAdPrice =
    promotion?.finalPrice ??
    (plan === "BASIC" ? config.adPrice : config.featuredPrice);
  const photoRef = useRef(photos);
  photoRef.current = photos;
  useEffect(
    () => () => {
      for (const photo of photoRef.current) URL.revokeObjectURL(photo.preview);
    },
    [],
  );
  const load = () =>
    api("/owner/listings")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function action(l, checkout) {
    if (checkout) {
      setPaymentListing(l);
      setFeedback("");
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      const d = await api(
        `/owner/listings/${l.id}/${checkout ? "checkout" : "sync-payment"}`,
        { method: "POST" },
      );
      if (checkout) window.location.assign(d.url);
      else {
        await load();
        if (d.reversed)
          setError(
            "O pagamento deste anúncio foi estornado. Fale com o corretor.",
          );
        else if (!d.paid)
          setError(
            "Pagamento ainda não confirmado pelo provedor. Tente novamente após a compensação.",
          );
      }
    } catch (e) {
      setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container dashboard">
      <div className="section-heading">
        <div>
          <div className="kicker">ÁREA DO PROPRIETÁRIO</div>
          <h1>Seus imóveis, novos negócios.</h1>
          <p>Acompanhe a divulgação e o pagamento dos seus anúncios.</p>
        </div>
        <button className="primary" onClick={() => setShow(!show)}>
          <Plus size={17} /> Novo anúncio
        </button>
      </div>
      {!config.commercialEnabled && (
        <div className="notice">
          O portal está em preparação. Novas contratações e cobranças estão
          desativadas até a configuração comercial.
        </div>
      )}
      {feedback && !show && (
        <div className="notice error" role="alert">
          {feedback}
        </div>
      )}
      {show && (
        <form
          className="form-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setFeedback("");
            if (couponPending) {
              setFeedback("Aplique o cupom ou remova-o antes de continuar.");
              setBusy(false);
              return;
            }
            if (!config.commercialEnabled) {
              setFeedback(
                "A contratação está temporariamente indisponível. Fale com Lourival para anunciar.",
              );
              setBusy(false);
              return;
            }
            try {
              const formData = new FormData(e.currentTarget);
              const {
                billingFirstName,
                billingLastName,
                billingCpf,
                billingPhone,
                ...f
              } = Object.fromEntries(formData);
              const payer = readPaymentDetails(formData);
              const images = await uploadSelectedPhotos(
                photos,
                api,
                (key, uploaded) =>
                  setPhotos((previous) =>
                    previous.map((photo) =>
                      photo.key === key ? { ...photo, ...uploaded } : photo,
                    ),
                  ),
              );
              const result = await createListingCheckout(
                api,
                {
                  ...f,
                  purpose,
                  plan,
                  price: Math.round(Number(f.price) * 100),
                  area: Number(f.area),
                  bedrooms: Number(f.bedrooms),
                  ownerPhone: f.ownerPhone.replace(/\D/g, ""),
                  images,
                  termsAccepted: f.termsAccepted === "on",
                  termsVersion: config.termsVersion,
                  ...(promotion
                    ? {
                        couponCode: promotion.code,
                        couponVersion: promotion.version,
                      }
                    : {}),
                },
                (listing) => {
                  setItems((previous) => [listing, ...previous]);
                  setShow(false);
                  photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
                  setPhotos([]);
                },
                payer,
              );
              if (result.url) window.location.assign(result.url);
              else setFeedback(result.error);
            } catch (err) {
              setFeedback(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Conte a história do seu imóvel.</h2>
          <div className="form-grid">
            <Field
              label="Título"
              name="title"
              minLength={8}
              maxLength={100}
              required
            />
            <Field label="Tipo">
              <select name="type">
                <option value="HOUSE">Casa</option>
                <option value="LOT">Lote</option>
                <option value="FARM">Fazenda</option>
              </select>
            </Field>
            <Field label="Finalidade">
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              >
                <option value="SALE">Venda</option>
                <option value="RENT">Aluguel</option>
              </select>
            </Field>
            <Field
              label="Valor em reais (no aluguel, valor mensal)"
              name="price"
              type="number"
              min="0.01"
              max="20000000"
              step="0.01"
              required
            />
            <Field label="Cidade — Tocantins" name="city" required />
            <Field
              label="Bairro ou região pública"
              name="neighborhood"
              required
            />
            <Field
              label="Endereço completo (privado)"
              name="privateAddress"
              required
              minLength={8}
            />
            <Field
              label="Seu telefone (privado)"
              name="ownerPhone"
              type="tel"
              required
            />
            <Field
              label="Área em m²"
              name="area"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
            <Field
              label="Quartos"
              name="bedrooms"
              type="number"
              min="0"
              max="100"
              defaultValue="0"
              required
            />
          </div>
          <Field label="Descrição pública — não inclua telefone, e-mail ou endereço completo">
            <textarea
              name="description"
              required
              minLength={30}
              maxLength={5000}
              rows={4}
            />
          </Field>
          <PhotoPicker
            photos={photos}
            setPhotos={setPhotos}
            disabled={busy}
            request={api}
          />
          <div className="plan-options">
            {[
              ["BASIC", "Divulgação", config.adPrice],
              ["FEATURED", "Destaque", config.featuredPrice],
            ].map(([v, t, p]) => (
              <label className={plan === v ? "chosen" : ""} key={v}>
                <input
                  type="radio"
                  name="plan"
                  checked={plan === v}
                  onChange={() => {
                    setPlan(v);
                    setCouponQuote(null);
                    setCouponPending(false);
                  }}
                />
                <strong>
                  {t} · {money(p)}
                </strong>
                <span>
                  {config.durationDays} dias
                  {v === "FEATURED" ? " · prioridade na listagem" : ""}
                </span>
              </label>
            ))}
          </div>
          <CouponField
            key={plan}
            request={api}
            plan={plan}
            onChange={setCouponQuote}
            onPendingChange={setCouponPending}
          />
          <PaymentFields />
          <h3>Condições comerciais</h3>
          <p>
            Anúncio: {money(finalAdPrice)}
            {promotion && ` com o cupom ${promotion.code}`}. Comissão:{" "}
            {(
              (purpose === "SALE"
                ? config.saleCommissionBps
                : config.rentCommissionBps) / 100
            ).toLocaleString("pt-BR")}
            %{" "}
            {purpose === "SALE"
              ? "do preço final de venda"
              : "de um aluguel mensal"}
            , cobrada separadamente do proprietário conforme contrato de
            intermediação.
          </p>
          <div className="terms-text">
            {config.terms?.[purpose]?.replace(
              (config.adPrice / 100).toFixed(2),
              (finalAdPrice / 100).toFixed(2),
            ) || "Condições ainda não configuradas."}
          </div>
          <label className="checkbox">
            <input
              key={`${plan}-${purpose}-${promotion?.code || ""}-${promotion?.version || ""}-${finalAdPrice}`}
              name="termsAccepted"
              type="checkbox"
              required
            />
            Li e aceito as condições e autorizo a intermediação e o uso das
            imagens.
          </label>
          {!config.commercialEnabled && (
            <div className="notice" id="checkout-unavailable" role="status">
              O pagamento de anúncios ainda não foi habilitado. O cadastro
              ficará disponível após a configuração comercial.{" "}
              <a
                className="text-button"
                href={`https://wa.me/${config.brokerPhone}`}
                target="_blank"
                rel="noreferrer"
              >
                Falar com Lourival <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          {couponPending && (
            <p className="notice" role="status">
              Aplique o cupom ou remova-o para continuar com o cadastro.
            </p>
          )}
          {feedback && (
            <div className="notice error" role="alert">
              {feedback}
            </div>
          )}
          <button
            className="primary"
            aria-describedby={
              !config.commercialEnabled ? "checkout-unavailable" : undefined
            }
            disabled={busy || couponPending || !config.commercialEnabled}
          >
            {busy
              ? "Preparando pagamento…"
              : !config.commercialEnabled
                ? "Contratação temporariamente indisponível"
                : "Cadastrar e seguir para pagamento"}
            <ArrowRight size={17} />
          </button>
        </form>
      )}
      <div className="owner-list">
        {items.map((l) => (
          <article className="manage-card" key={l.id}>
            <Photo src={l.images[0]} alt="" />
            <div>
              <h3>{l.title}</h3>
              <p>
                {statusNames[l.status]}
                {l.expiresAt
                  ? ` · até ${new Date(l.expiresAt).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
              <p>
                {money(l.adPrice)} ·{" "}
                {l.affiliateVoidedAt
                  ? "Pagamento estornado"
                  : l.paidAt
                    ? "Pagamento confirmado"
                    : "Pagamento pendente"}{" "}
                · Comissão contratada: {l.commissionBps / 100}%
                {l.couponCode && ` · cupom ${l.couponCode}`}
              </p>
            </div>
            {!l.paidAt && !l.affiliateVoidedAt && (
              <div className="action-stack">
                <button
                  className="primary small"
                  disabled={busy || !config.commercialEnabled}
                  onClick={() => action(l, true)}
                >
                  Pagar anúncio
                </button>
                <button
                  className="outline small"
                  disabled={busy}
                  onClick={() => action(l, false)}
                >
                  Já paguei: verificar
                </button>
              </div>
            )}
          </article>
        ))}
        {!items.length && !show && (
          <div className="empty">
            <House size={34} />
            <h3>Seu primeiro anúncio começa aqui.</h3>
            <p>Cadastre um imóvel para iniciar.</p>
          </div>
        )}
      </div>
      {paymentListing && (
        <div className="modal-shade">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Pagar anúncio"
          >
            <button
              type="button"
              className="close"
              aria-label="Fechar"
              onClick={() => setPaymentListing(null)}
              disabled={busy}
            >
              <X />
            </button>
            <h2>Pagar anúncio</h2>
            <p>
              {paymentListing.title} · {money(paymentListing.adPrice)}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const payer = readPaymentDetails(new FormData(e.currentTarget));
                setBusy(true);
                setFeedback("");
                try {
                  const d = await api(
                    `/owner/listings/${paymentListing.id}/checkout`,
                    { method: "POST", body: { payer } },
                  );
                  window.location.assign(d.url);
                } catch (e) {
                  setFeedback(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={busy} className="payment-form-fields">
                <PaymentFields />
              </fieldset>
              {feedback && (
                <p className="notice error" role="alert">
                  {feedback}
                </p>
              )}
              <button className="primary wide" disabled={busy}>
                {busy ? "Preparando pagamento…" : "Continuar no Mercado Pago"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
function Admin({ config, setError, onConfigChange, userName }) {
  const [items, setItems] = useState([]),
    [leads, setLeads] = useState([]),
    [logs, setLogs] = useState([]),
    [tab, setTab] = useState("listings"),
    [deal, setDeal] = useState(null),
    [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([
      api("/admin/listings").then(setItems),
      api("/admin/leads").then(setLeads),
      api("/admin/audit").then(setLogs),
    ]).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const received = items
      .filter((l) => l.paidAt)
      .reduce((a, l) => a + l.adPrice, 0),
    commissions = items.reduce((a, l) => a + (l.deal?.commission || 0), 0);
  return (
    <main className="container dashboard">
      <div className="kicker">PAINEL DO CORRETOR</div>
      <h1>Olá, {userName?.trim().split(/\s+/)[0] || "Lourival"}.</h1>
      <p>Da primeira conversa ao próximo negócio.</p>
      <div className="metrics">
        <div>
          <span>Anúncios pagos</span>
          <strong>{money(received)}</strong>
        </div>
        <div>
          <span>Interessados registrados</span>
          <strong>{leads.length}</strong>
        </div>
        <div>
          <span>Comissões negociadas</span>
          <strong>{money(commissions)}</strong>
        </div>
      </div>
      <Tabs
        id="admin"
        label="Menu do administrador"
        value={tab}
        onChange={setTab}
        tabs={[
          ["listings", "Anúncios"],
          ["customers", "Clientes cadastrados"],
          ["leads", "Contatos e visitas"],
          ["audit", "Histórico"],
          ["settings", "Configurações"],
          ["partners", "Parceiros e cupons"],
          ["test-checkout", "Teste Mercado Pago"],
        ]}
      />
      <section
        role="tabpanel"
        id={`admin-panel-${tab}`}
        aria-labelledby={`admin-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "customers" ? (
          <Customers request={api} onOpenPartners={() => setTab("partners")} />
        ) : tab === "partners" ? (
          <AdminPartners request={api} />
        ) : tab === "test-checkout" ? (
          <TestCheckout request={api} />
        ) : tab === "settings" ? (
          <CommercialSettings request={api} onConfigChange={onConfigChange} />
        ) : tab === "listings" ? (
          items.map((l) => (
            <article className="form-panel" key={l.id}>
              <div className="section-heading">
                <div>
                  <h3>{l.title}</h3>
                  <p>
                    {l.owner.name} · {l.owner.email} · {l.ownerPhone}
                  </p>
                  <p>Endereço privado: {l.privateAddress}</p>
                  <p>
                    {statusNames[l.status]} ·{" "}
                    {l.affiliateVoidedAt
                      ? "Pagamento estornado"
                      : l.paidAt
                        ? "Pagamento confirmado"
                        : "Pagamento pendente"}{" "}
                    · {money(l.adPrice)}
                  </p>
                </div>
                <div className="action-stack">
                  {l.status === "PENDING" && (
                    <button
                      className="outline small"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const d = await api(
                            `/owner/listings/${l.id}/sync-payment`,
                            { method: "POST" },
                          );
                          if (!d.paid)
                            throw Error(
                              "Nenhum pagamento aprovado encontrado.",
                            );
                        })
                      }
                    >
                      Consultar pagamento
                    </button>
                  )}
                  {["PENDING", "REJECTED", "PUBLISHED"].includes(l.status) && (
                    <>
                      <button
                        disabled={busy || !l.paidAt}
                        className="primary small"
                        onClick={() =>
                          run(() =>
                            api(`/admin/listings/${l.id}/review`, {
                              method: "POST",
                              body: { approve: true },
                            }),
                          )
                        }
                      >
                        Aprovar publicação
                      </button>
                      <button
                        disabled={busy}
                        className="outline small"
                        onClick={() =>
                          run(() =>
                            api(`/admin/listings/${l.id}/review`, {
                              method: "POST",
                              body: { approve: false },
                            }),
                          )
                        }
                      >
                        Retirar / reprovar
                      </button>
                    </>
                  )}
                  {l.status === "PUBLISHED" && (
                    <button
                      className="primary small"
                      onClick={() => setDeal(l)}
                    >
                      Registrar fechamento
                    </button>
                  )}
                </div>
              </div>
              <details>
                <summary>Descrição, fotos e aceite para revisão</summary>
                <p className="description">{l.description}</p>
                <div className="gallery">
                  {l.images.map((src) => (
                    <div key={src}>
                      <Photo src={src} alt="Imagem para revisão" />
                    </div>
                  ))}
                </div>
                <p>
                  Aceite: {new Date(l.acceptedAt).toLocaleString("pt-BR")} ·{" "}
                  {l.termsVersion}
                </p>
                <p>{l.termsText}</p>
                <p>
                  Confira e remova contatos ou dados privados da publicação:
                  reprove o cadastro e peça novo envio quando necessário.
                </p>
              </details>
              {l.deal && (
                <div className="deal-box">
                  <p>
                    Fechamento: {money(l.deal.finalPrice)} · Comissão:{" "}
                    {money(l.deal.commission)} ·{" "}
                    {l.deal.commissionPaid ? "Recebida" : "A receber"}
                  </p>
                  <button
                    disabled={busy}
                    className="outline small"
                    onClick={() =>
                      run(() =>
                        api(`/admin/deals/${l.deal.id}/commission`, {
                          method: "PATCH",
                          body: { paid: !l.deal.commissionPaid },
                        }),
                      )
                    }
                  >
                    {l.deal.commissionPaid
                      ? "Desmarcar recebimento"
                      : "Confirmar recebimento após conferir o crédito"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDeal({ ...l, preview: true })}
                  >
                    Ver minuta para impressão
                  </button>
                </div>
              )}
            </article>
          ))
        ) : tab === "leads" ? (
          leads.map((l) => (
            <LeadEditor key={l.id} lead={l} busy={busy} run={run} />
          ))
        ) : (
          <div className="form-panel">
            {logs.map((l) => (
              <p key={l.id}>
                <small>{new Date(l.createdAt).toLocaleString("pt-BR")}</small> ·{" "}
                {l.action} · {l.entityId} · {l.detail}
              </p>
            ))}
          </div>
        )}
        {!items.length && tab === "listings" && (
          <div className="empty">Os anúncios recebidos aparecerão aqui.</div>
        )}
      </section>
      {deal && (
        <div className="modal-shade">
          <section className="modal">
            <button
              className="close"
              aria-label="Fechar"
              onClick={() => setDeal(null)}
            >
              <X />
            </button>
            {deal.preview ? (
              <Contract listing={deal} config={config} />
            ) : (
              <>
                <h2>Registrar negociação</h2>
                <p>
                  O registro calcula a comissão, encerra a divulgação e prepara
                  uma minuta. Não cobra a comissão automaticamente.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = Object.fromEntries(new FormData(e.currentTarget));
                    run(async () => {
                      await api(`/admin/listings/${deal.id}/deal`, {
                        method: "POST",
                        body: {
                          ...f,
                          finalPrice: Math.round(Number(f.finalPrice) * 100),
                        },
                      });
                      setDeal(null);
                    });
                  }}
                >
                  <Field
                    label="Nome completo do comprador / locatário"
                    name="buyerName"
                    required
                    minLength={3}
                  />
                  <Field
                    label="Nome completo do proprietário"
                    name="sellerName"
                    defaultValue={deal.owner.name}
                    required
                    minLength={3}
                  />
                  <Field
                    label={
                      deal.purpose === "RENT"
                        ? "Aluguel mensal fechado (R$)"
                        : "Preço de venda fechado (R$)"
                    }
                    name="finalPrice"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="20000000"
                    required
                  />
                  <Field label="Condições de pagamento e observações">
                    <textarea
                      name="paymentTerms"
                      required
                      minLength={10}
                      rows={4}
                    />
                  </Field>
                  <p>
                    Comissão contratada: {deal.commissionBps / 100}%{" "}
                    {deal.purpose === "RENT"
                      ? "de um aluguel mensal"
                      : "do valor final"}
                    .
                  </p>
                  <button disabled={busy} className="primary">
                    Registrar fechamento
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
function LeadEditor({ lead: l, busy, run }) {
  return (
    <form
      className="form-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        run(() =>
          api(`/admin/leads/${l.id}`, {
            method: "PATCH",
            body: {
              ...f,
              visitAt: f.visitAt ? new Date(f.visitAt).toISOString() : null,
            },
          }),
        );
      }}
    >
      <h3>
        {l.name} · {l.listing.title}
      </h3>
      <a
        href={`https://wa.me/${l.phone.startsWith("55") ? l.phone : "55" + l.phone}`}
        target="_blank"
        rel="noreferrer"
      >
        {l.phone} <ArrowUpRight size={14} />
      </a>
      <p>{l.message}</p>
      <div className="form-grid">
        <Field label="Etapa">
          <select name="stage" defaultValue={l.stage}>
            {[
              ["NEW", "Novo"],
              ["CONTACTED", "Em atendimento"],
              ["VISIT", "Visita"],
              ["PROPOSAL", "Proposta"],
              ["CLOSED", "Fechado"],
              ["LOST", "Sem negócio"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Visita (horário local)"
          type="datetime-local"
          name="visitAt"
          defaultValue={
            l.visitAt
              ? new Date(
                  new Date(l.visitAt).getTime() -
                    new Date(l.visitAt).getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : ""
          }
        />
      </div>
      <Field label="Propostas e observações">
        <textarea name="notes" defaultValue={l.notes} maxLength={5000} />
      </Field>
      <button disabled={busy} className="outline small">
        Salvar atendimento
      </button>
    </form>
  );
}
function Contract({ listing: l, config }) {
  const d = l.deal;
  return (
    <>
      <article className="contract">
        <div className="kicker">MINUTA · REVISÃO OBRIGATÓRIA</div>
        <h2>
          Resumo da negociação de{" "}
          {l.purpose === "RENT" ? "locação" : "compra e venda"}
        </h2>
        <p>
          Documento de apoio. Não constitui contrato completo, assinatura,
          escritura ou transferência de propriedade. Complete a qualificação das
          partes, documentos do imóvel e cláusulas aplicáveis com profissional
          habilitado antes de assinar.
        </p>
        <h3>Partes e imóvel</h3>
        <p>Proprietário: {d.sellerName}</p>
        <p>
          {l.purpose === "RENT" ? "Locatário" : "Comprador"}: {d.buyerName}
        </p>
        <p>
          Imóvel: {l.title} · {l.privateAddress} · {l.city}/TO · referência{" "}
          {l.id}
        </p>
        <p>
          Qualificação das partes, matrícula, cartório e titularidade:
          __________________________
        </p>
        <h3>Valores e condições</h3>
        <p>
          {l.purpose === "RENT" ? "Aluguel mensal" : "Preço negociado"}:{" "}
          {money(d.finalPrice)}
        </p>
        <p className="description">{d.paymentTerms}</p>
        <p>
          Intermediador: {config.brokerName} · CRECI informado{" "}
          {config.brokerCreci}
        </p>
        <p>
          Comissão de responsabilidade do proprietário: {l.commissionBps / 100}%
          = {money(d.commission)}. Prazo e forma de pagamento:
          __________________________
        </p>
        <p>
          Posse, tributos, garantias, obrigações, rescisão, prazos e demais
          cláusulas: a completar e revisar.
        </p>
        <p>Local e data: __________________________</p>
        <br />
        <p>Proprietário: __________________________</p>
        <p>
          {l.purpose === "RENT" ? "Locatário" : "Comprador"}:
          __________________________
        </p>
        <p>Intermediador: __________________________</p>
        <p>Testemunhas e documentos: __________________________</p>
      </article>
      <button className="primary no-print" onClick={() => window.print()}>
        Imprimir / salvar PDF
      </button>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
