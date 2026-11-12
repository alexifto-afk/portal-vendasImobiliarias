import Reports, { PdfButton } from "./Reports.jsx";
import ListingGallery from "./ListingGallery.jsx";
import StateCityFields from "./StateCityFields.jsx";
import RecordsTable from "./RecordsTable.jsx";
import RenewListing from "./RenewListing.jsx";
import { listingState } from "./listing-lifecycle.js";
import ApproximateRegionMap from "./ApproximateRegionMap.jsx";
import ListingRegionMap from "./ListingRegionMap.jsx";
import AdvertiserContact, { AuthorizeContact } from "./AdvertiserContact.jsx";
import ListingWizard from "./ListingWizard.jsx";
import {
  categories,
  categoryFor,
  typeNames,
  listingFeatures,
} from "./classified-catalog.js";
import Brand, { brandName, brandSlogan } from "./Brand.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import Customers from "./Customers.jsx";
import { dashboardFor } from "./partner-access.js";
import Tabs from "./Tabs.jsx";
import Profile, { IdentityFields } from "./Profile.jsx";
import { PartnerDashboard, AdminPartners } from "./Partners.jsx";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Map as MapIcon,
  House,
  Search,
  Menu,
  X,
  Check,
  MessageCircle,
  Plus,
  LogOut,
} from "lucide-react";
import "./style.css";
import { paymentReturnMessage } from "./payment-result.js";
import { MediaImage } from "./media.jsx";
import CommercialSettings from "./CommercialSettings.jsx";
import PaymentFields, { readPaymentDetails } from "./PaymentFields.jsx";
import TestCheckout from "./TestCheckout.jsx";
import { emptyFilters, findListings } from "./catalog.js";
const API = (
  import.meta.env.VITE_API_URL || "http://localhost:3002/api"
).replace(/\/$/, "");
const money = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusNames = {
  PENDING: "Aguardando pagamento e análise",
  PUBLISHED: "Publicado",
  REJECTED: "Reprovado — fale com o suporte",
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
  const { responseType, ...requestOptions } = options;
  let r;
  try {
    r = await fetch(API + path, {
      ...requestOptions,
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
  if (r.ok && responseType === "blob") return r.blob();
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
  useEffect(() => {
    if (view !== "home") return;
    let active = true;
    const refresh = () =>
      Promise.all([api("/config"), api("/listings")])
        .then(([configuration, rows]) => {
          setConfig(configuration);
          if (active) {
            setListings(rows);
            setOffline(false);
          }
        })
        .catch(() => {
          if (active) setOffline(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    refresh();
    const timer = setInterval(refresh, 60000);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [view]);
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
          <Brand />
        </a>
        <nav className={mobile ? "open" : ""}>
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => go("home")}
          >
            Encontrar anúncios
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
            Fale com o suporte <ArrowUpRight size={14} />
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
              Anunciar <Plus size={16} />
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
              <div className="kicker">IMÓVEIS e ITENS EM GERAL</div>
              <p className="catalog-brand-slogan">{brandSlogan}</p>
              <h1>O que você está procurando?</h1>
              <p>
                Encontre imóveis, veículos, eletrônicos e muito mais. Negocie
                diretamente com quem anuncia.
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
                  Fale com o suporte <ArrowUpRight size={14} />
                </strong>
              </span>
            </a>
          </section>
          <section
            className="catalog-search container"
            aria-label="Encontrar anúncios"
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
              <Field label="O que você procura?">
                <input
                  aria-label="Buscar anúncios"
                  placeholder="Ex.: carro, celular, casa"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                />
              </Field>
              <Field label="Categoria">
                <select
                  value={filters.category}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      category: e.target.value,
                      type: "",
                    })
                  }
                >
                  <option value="">Todas as categorias</option>
                  {Object.entries(categories).map(([id, c]) => (
                    <option key={id} value={id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <StateCityFields
                value={filters}
                onChange={(location) =>
                  setFilters((previous) => ({ ...previous, ...location }))
                }
                request={api}
                allowAll
              />
              <Field label="Tipo de anúncio">
                <select
                  value={filters.type}
                  onChange={(e) =>
                    setFilters({ ...filters, type: e.target.value })
                  }
                >
                  <option value="">Todos os tipos</option>
                  {Object.entries(
                    filters.category
                      ? categories[filters.category].types
                      : typeNames,
                  ).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
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
                    : [100, 500, 1000, 5000, 50000, 300000, 1000000]
                  ).map((n) => (
                    <option value={n} key={n}>
                      {money(n * 100)}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="primary" type="submit">
                <Search size={18} /> Ver anúncios
              </button>
            </form>
          </section>
          <main className="container catalog-main">
            <section id="imoveis" className="properties">
              <div
                className="category-row catalog-categories"
                role="group"
                aria-label="Escolher categoria"
              >
                {[
                  ["", "Todos"],
                  ...Object.entries(categories).map(([id, c]) => [id, c.name]),
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filters.category === value}
                    className={filters.category === value ? "selected" : ""}
                    onClick={() =>
                      setFilters({ ...filters, category: value, type: "" })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="section-heading catalog-results">
                <div>
                  <h2>
                    {filters.type
                      ? typeNames[filters.type]
                      : filters.category
                        ? categories[filters.category].name
                        : "Anúncios"}{" "}
                    {filters.purpose === "RENT"
                      ? "para alugar"
                      : filters.purpose === "SALE"
                        ? "à venda"
                        : "para você"}
                  </h2>
                  <p role="status" aria-live="polite">
                    {loading
                      ? "Buscando anúncios disponíveis…"
                      : `${visible.length} ${visible.length === 1 ? "anúncio encontrado" : "anúncios encontrados"}${offline ? " · exemplos ilustrativos" : ""}`}
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
                  Prévia visual: os anúncios abaixo são exemplos e não estão à
                  venda. Conecte a API para exibir anúncios reais.
                </div>
              )}
              <div className="property-grid">
                {visible.map((l) => (
                  <article className="property-card" key={l.id}>
                    <ListingGallery
                      images={l.images}
                      title={l.title}
                      Photo={Photo}
                      card
                      onOpen={() => {
                        setSelected(l);
                        setModal("property");
                      }}
                    >
                      <span className="image-tag">
                        {offline
                          ? "Exemplo"
                          : l.purpose === "RENT"
                            ? "Para alugar"
                            : "À venda"}
                      </span>
                      <span className="image-type">{typeNames[l.type]}</span>
                      {l.images.length < 2 && (
                        <span className="image-arrow">
                          <ArrowUpRight size={21} />
                        </span>
                      )}
                    </ListingGallery>
                    <div className="card-content">
                      <div className="card-location">
                        <MapPin size={13} />
                        {l.neighborhood} · {l.city}/{l.state || "TO"}
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
                        <span>{listingFeatures(l).join(" · ")}</span>
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
                          Ver anúncio <ArrowUpRight size={16} />
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
                      ? "Não encontramos anúncios com esses filtros."
                      : "Novos anúncios em breve."}
                  </h3>
                  <p>
                    {hasFilters
                      ? "Experimente outra cidade, categoria ou faixa de preço."
                      : "Fale com o suporte para consultar oportunidades na região."}
                  </p>
                  {hasFilters && (
                    <button
                      className="outline"
                      onClick={() => setFilters(emptyFilters)}
                    >
                      Ver todos os anúncios
                    </button>
                  )}
                  <a
                    className="primary"
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Falar com o suporte <ArrowUpRight size={18} />
                  </a>
                </div>
              )}
            </section>
            <section className="sell-banner">
              <div>
                <span className="eyebrow">PARA QUEM QUER ANUNCIAR</span>
                <h2>
                  Seu anúncio merece
                  <br />
                  ser <em>encontrado.</em>
                </h2>
                <p>
                  Você anuncia e recebe os contatos diretamente no seu WhatsApp.
                </p>
                <button className="cream" onClick={announce}>
                  Quero criar meu anúncio <ArrowUpRight size={19} />
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
                    Contato direto com o anunciante
                  </li>
                  <li>
                    <Check size={17} />
                    Categorias para encontrar o que procura
                  </li>
                </ul>
                <div className="plan-note">
                  Você paga somente pela divulgação. Sem comissão sobre a
                  negociação.
                </div>
              </div>
            </section>
            <section id="como-funciona" className="how">
              <div className="kicker">SIMPLES, DO INÍCIO AO FIM</div>
              <h2>Anuncie, apareça e negocie.</h2>
              <div className="steps">
                {[
                  [
                    "01",
                    "Cadastre seu anúncio",
                    "Escolha a categoria, informe os detalhes e envie suas fotos.",
                  ],
                  [
                    "02",
                    "Dê visibilidade ao seu anúncio",
                    "Escolha o plano e pague. Após a confirmação e a análise, seu anúncio fica disponível pelo período contratado.",
                  ],
                  [
                    "03",
                    "Converse diretamente",
                    "Os interessados entram em contato no seu WhatsApp. Combine a negociação diretamente, sem comissão do portal.",
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
        <Owner
          config={config}
          setError={setError}
          onListingChange={(id) =>
            setListings((previous) => previous.filter((item) => item.id !== id))
          }
        />
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
          <Brand />
        </a>
        <div>
          <strong>Atendimento Negocieê</strong>
          <p>Suporte ao portal e aos anúncios</p>
          <a href={wa} target="_blank" rel="noreferrer">
            (63) 99991-5770 <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="footer-end">
          <button onClick={() => setModal("privacy")}>
            Privacidade e condições
          </button>
          <p>
            © {new Date().getFullYear()} {brandName}
          </p>
        </div>
      </footer>
      {modal && (
        <div className="modal-shade" onClick={() => setModal(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "auth"
                ? "Acesso ao Negocieê"
                : modal === "property"
                  ? "Detalhes do anúncio"
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
                  Nome, CPF, endereço e e-mail do cadastro são utilizados para
                  administrar sua conta e a contratação. O WhatsApp informado e
                  autorizado no anúncio será disponibilizado para contato direto
                  com interessados. Cidade, bairro, fotos e detalhes do produto
                  são públicos; o endereço completo e o CPF não são publicados.
                </p>
                <p>
                  O preço do anúncio remunera somente a divulgação pelo prazo
                  contratado, sem garantia de venda ou aluguel. Nos novos
                  anúncios não há comissão de intermediação. A negociação ocorre
                  diretamente entre anunciante e interessado. Não há renovação
                  automática.
                </p>
                <p>
                  Para acesso, correção, exclusão de dados, cancelamento ou
                  reembolso, fale com o suporte do Negocieê. Condições e
                  registros de contratações anteriores são preservados no
                  histórico.
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
    [error, setError] = useState(""),
    [forgot, setForgot] = useState(false),
    [email, setEmail] = useState(""),
    [notice, setNotice] = useState("");
  if (forgot)
    return (
      <ForgotPassword
        request={api}
        initialEmail={email}
        onBack={() => setForgot(false)}
        onDone={(address) => {
          setEmail(address);
          setForgot(false);
          setNotice("Senha alterada. Entre com sua nova senha.");
        }}
      />
    );
  return (
    <>
      <div className="kicker">ACESSO AO PORTAL</div>
      <h2>
        {register
          ? "Seu anúncio, novas oportunidades."
          : "Que bom ter você aqui."}
      </h2>
      <p>
        {register
          ? "Crie sua conta para anunciar e acompanhar seus produtos."
          : "Entre para acessar seu painel e acompanhar suas atividades."}
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      {!register && (
        <button
          className="text-button wide"
          type="button"
          onClick={() => {
            setForgot(true);
            setError("");
            setNotice("");
          }}
        >
          Esqueci minha senha
        </button>
      )}
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
function Property({ listing: l, demo }) {
  const [mapOpen, setMapOpen] = useState(false);
  const realEstate = (l.category || categoryFor(l.type)) === "REAL_ESTATE";
  return (
    <>
      <ListingGallery images={l.images} title={l.title} Photo={Photo}>
        {!demo && realEstate && (
          <button
            type="button"
            className="property-map-button"
            aria-label="Abrir mapa da localização aproximada"
            onClick={() => setMapOpen(true)}
          >
            <MapIcon size={19} /> Mapa
          </button>
        )}
      </ListingGallery>
      {mapOpen && (
        <ApproximateRegionMap
          listing={l}
          request={api}
          onClose={() => setMapOpen(false)}
        />
      )}
      <div className="kicker">
        {typeNames[l.type]} · {l.purpose === "RENT" ? "PARA ALUGAR" : "À VENDA"}
      </div>
      <h2>{l.title}</h2>
      <p>
        <MapPin size={15} /> {l.neighborhood} · {l.city}/{l.state || "TO"}
      </p>
      <h3>
        {money(l.price)} {l.purpose === "RENT" ? "/mês" : ""}
      </h3>
      <p>{listingFeatures(l).join(" · ")}</p>
      <p className="description">
        {l.description || "Anúncio ilustrativo. Não se trata de oferta real."}
      </p>
      {!demo && !realEstate && <ListingRegionMap key={l.id} listing={l} />}
      {demo ? (
        <div className="notice">
          Este é um exemplo visual. O contato está disponível somente nos
          anúncios reais.
        </div>
      ) : (
        <AdvertiserContact key={l.id} listing={l} request={api} />
      )}
    </>
  );
}
function Owner({ config, setError, onListingChange }) {
  const [items, setItems] = useState([]),
    [paymentListing, setPaymentListing] = useState(null),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState(null),
    [renewing, setRenewing] = useState(null),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
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
            "O pagamento deste anúncio foi estornado. Fale com o suporte.",
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
  const managementReady = Boolean(config.renewalTermsVersion);
  const previousPeriods = items.filter((item) =>
    items.some((child) => child.renewalOfId === item.id),
  );
  const currentItems = items.filter((item) => !previousPeriods.includes(item));
  return (
    <main className="container dashboard">
      <div className="section-heading">
        <div>
          <div className="kicker">ÁREA DO ANUNCIANTE</div>
          <h1>Seus anúncios, novos negócios.</h1>
          <p>Acompanhe a divulgação e o pagamento dos seus anúncios.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setShow(!show);
            setEditing(null);
            setNotice("");
            setFeedback("");
          }}
        >
          <Plus size={17} /> Novo anúncio
        </button>
      </div>
      {!config.commercialEnabled && (
        <div className="notice">
          O Negocieê está em preparação. Novas contratações e cobranças estão
          desativadas até a configuração comercial.
        </div>
      )}
      {feedback && !show && (
        <div className="notice error" role="alert">
          {feedback}
        </div>
      )}
      {!managementReady && (
        <div className="notice" role="status">
          Edição e renovação temporariamente indisponíveis. Tente novamente em
          instantes.
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {renewing && (
        <RenewListing
          listing={renewing}
          config={config}
          request={api}
          onClose={() => setRenewing(null)}
          onCreated={(listing) => {
            setItems((previous) => [
              listing,
              ...previous.filter((item) => item.id !== listing.id),
            ]);
            setRenewing(null);
          }}
          onResult={(result) => {
            if (result.url) window.location.assign(result.url);
            else if (result.paid)
              setNotice(
                "Essa renovação já está paga. Acompanhe o anúncio no painel.",
              );
            else setFeedback(result.error);
          }}
        />
      )}
      {editing && (
        <ListingWizard
          key={editing.id}
          initialListing={editing}
          config={config}
          request={api}
          onCancel={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((previous) =>
              previous.map((item) => (item.id === updated.id ? updated : item)),
            );
            setEditing(null);
            setNotice(
              "Alterações salvas e enviadas para análise. O vencimento original foi mantido.",
            );
            onListingChange(updated.id);
          }}
        />
      )}
      {show && (
        <ListingWizard
          config={config}
          request={api}
          onCancel={() => setShow(false)}
          onCreated={(listing) => {
            setItems((previous) => [listing, ...previous]);
            setShow(false);
          }}
          onResult={(result) => {
            if (result.url) window.location.assign(result.url);
            else setFeedback(result.error);
          }}
        />
      )}
      <div className="owner-list">
        {currentItems.map((l) => {
          const lifecycle = listingState(l, items, new Date(clock));
          return (
            <article className="manage-card" key={l.id}>
              <Photo src={l.images[0]} alt="" />
              <div>
                <h3>{l.title}</h3>
                {!["CLOSED", "CANCELLED"].includes(l.status) &&
                  !lifecycle.expired && (
                    <details>
                      <summary>Contato do anúncio</summary>
                      <AuthorizeContact
                        listing={l}
                        request={api}
                        onSaved={load}
                      />
                    </details>
                  )}
                {l.status === "PUBLISHED" && !lifecycle.expired && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Encerrar a divulgação deste anúncio? Ele deixará de aparecer na busca.",
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await api(`/owner/listings/${l.id}/close`, {
                          method: "POST",
                        });
                        await load();
                        onListingChange(l.id);
                      } catch (e) {
                        setFeedback(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Já negociei / encerrar anúncio
                  </button>
                )}

                <p>
                  {lifecycle.label || statusNames[l.status]}
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
                  {!l.termsVersion.startsWith("2026-11-classifieds") &&
                    `· Comissão histórica: ${l.commissionBps / 100}%`}
                  {l.couponCode && ` · cupom ${l.couponCode}`}
                </p>
              </div>
              <div className="action-stack listing-manage-actions">
                {l.paidAt && !l.affiliateVoidedAt && (
                  <PdfButton
                    request={api}
                    path={`/receipts/listings/${l.id}`}
                    filename={`recibo-anuncio-${l.id}.pdf`}
                  />
                )}
                {lifecycle.editable && managementReady && (
                  <button
                    className="outline small"
                    disabled={busy}
                    onClick={() => {
                      setEditing(l);
                      setShow(false);
                      setFeedback("");
                      setNotice("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Editar anúncio
                  </button>
                )}
                {lifecycle.expired && (
                  <span className="expired-label">
                    Prazo encerrado · fora da busca
                  </span>
                )}
                {lifecycle.renewable && managementReady && (
                  <button
                    className="primary small"
                    disabled={busy || !config.commercialEnabled}
                    onClick={() => {
                      setRenewing(l);
                      setFeedback("");
                      setNotice("");
                    }}
                  >
                    Comprar mais 30 dias
                  </button>
                )}
                {lifecycle.renewal && (
                  <small>
                    {lifecycle.renewal.paidAt
                      ? "Nova divulgação já contratada. Acompanhe o anúncio renovado."
                      : "Há uma renovação pendente. Use Pagar anúncio no novo período acima."}
                  </small>
                )}
                {!l.paidAt &&
                  !l.affiliateVoidedAt &&
                  !["CLOSED", "CANCELLED"].includes(l.status) && (
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
                <button
                  className="text-button danger-text"
                  disabled={busy || !managementReady}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Excluir este anúncio do seu painel e da divulgação? Essa ação não solicita estorno e preserva o histórico financeiro.",
                      )
                    )
                      return;
                    setBusy(true);
                    setFeedback("");
                    setNotice("");
                    try {
                      await api(`/owner/listings/${l.id}`, {
                        method: "DELETE",
                      });
                      setItems((previous) =>
                        previous.filter((item) => item.id !== l.id),
                      );
                      onListingChange(l.id);
                      setNotice(
                        "Anúncio excluído da divulgação e do seu painel.",
                      );
                    } catch (e) {
                      setFeedback(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Excluir anúncio
                </button>
              </div>
            </article>
          );
        })}
        {!items.length && !show && (
          <div className="empty">
            <House size={34} />
            <h3>Seu primeiro anúncio começa aqui.</h3>
            <p>Cadastre um produto ou imóvel para iniciar.</p>
          </div>
        )}
      </div>
      {previousPeriods.length > 0 && (
        <details className="form-panel previous-periods">
          <summary>Divulgações anteriores ({previousPeriods.length})</summary>
          <p>
            Histórico dos períodos já contratados. Acompanhe a renovação atual
            na lista acima.
          </p>
          <RecordsTable
            label="Divulgações anteriores"
            headings={["Anúncio", "Vencimento", "Divulgação", "Recibo"]}
            rows={previousPeriods}
            empty="Nenhuma divulgação anterior."
            render={(item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>
                  {item.expiresAt
                    ? new Date(item.expiresAt).toLocaleDateString("pt-BR")
                    : "Sem publicação"}
                </td>
                <td>{money(item.adPrice)}</td>
                <td>
                  {item.paidAt && !item.affiliateVoidedAt && (
                    <PdfButton
                      request={api}
                      path={`/receipts/listings/${item.id}`}
                      filename={`recibo-anuncio-${item.id}.pdf`}
                    />
                  )}
                </td>
              </tr>
            )}
          />
        </details>
      )}
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
      <div className="kicker">PAINEL DO ADMINISTRADOR</div>
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
          <span>Comissões históricas</span>
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
          ["leads", "Contatos antigos"],
          ["audit", "Histórico"],
          ["reports", "Relatórios PDF"],
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
        {tab === "reports" ? (
          <Reports request={api} />
        ) : tab === "customers" ? (
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
                    {l.deletedAt
                      ? "Excluído pelo anunciante"
                      : statusNames[l.status]}{" "}
                    ·{" "}
                    {l.affiliateVoidedAt
                      ? "Pagamento estornado"
                      : l.paidAt
                        ? "Pagamento confirmado"
                        : "Pagamento pendente"}{" "}
                    · {money(l.adPrice)}
                  </p>
                </div>
                <div className="action-stack">
                  {l.paidAt && !l.affiliateVoidedAt && (
                    <PdfButton
                      request={api}
                      path={`/receipts/listings/${l.id}`}
                      filename={`recibo-anuncio-${l.id}.pdf`}
                    />
                  )}
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
                              body: {
                                approve: true,
                                revision: l.revision ?? 0,
                              },
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
                              body: {
                                approve: false,
                                revision: l.revision ?? 0,
                              },
                            }),
                          )
                        }
                      >
                        Retirar / reprovar
                      </button>
                    </>
                  )}
                  {l.status === "PUBLISHED" &&
                    !l.termsVersion.startsWith("2026-11-classifieds") && (
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
                  Confira as informações e remova dados privados da descrição e
                  das fotos: reprove o cadastro e peça novo envio quando
                  necessário.
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
