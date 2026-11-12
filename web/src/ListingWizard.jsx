import { listingFormValues, retainedPhotos } from "./listing-lifecycle.js";
import VehicleFields from "./VehicleFields.jsx";
import MaskedInput from "./MaskedInput.jsx";
import React, { useEffect, useRef, useState } from "react";
import {
  categories,
  categoryFor,
  typeNames,
  states,
  listingFeatures,
} from "./classified-catalog.js";
import { PhotoPicker } from "./media.jsx";
import { uploadSelectedPhotos } from "./photo-uploads.js";
import { CouponField } from "./Partners.jsx";
import PaymentFields, { readPaymentDetails } from "./PaymentFields.jsx";
import { createListingCheckout } from "./listing-checkout.js";
const money = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const steps = [
  "Categoria",
  "Detalhes",
  "Fotos",
  "Localização e contato",
  "Revisão e pagamento",
];
const fresh = {
  type: "HOUSE",
  purpose: "SALE",
  title: "",
  description: "",
  price: "",
  area: "",
  bedrooms: "0",
  brand: "",
  model: "",
  year: "",
  mileage: "",
  condition: "USED",
  city: "",
  state: "TO",
  neighborhood: "",
  ownerPhone: "",
};
export default function ListingWizard({
  config,
  request,
  onCreated,
  onResult,
  onCancel,
  initialListing = null,
  onSaved,
}) {
  const editing = Boolean(initialListing);
  const [step, setStep] = useState(editing ? 1 : 0),
    [values, setValues] = useState(() =>
      editing ? listingFormValues(initialListing) : fresh,
    ),
    [photos, setPhotos] = useState([]),
    [plan, setPlan] = useState(initialListing?.plan || "BASIC"),
    [quote, setQuote] = useState(null),
    [couponPending, setCouponPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [photoReady, setPhotoReady] = useState(!editing),
    [photoRetry, setPhotoRetry] = useState(0);
  const formRef = useRef(),
    photoRef = useRef(photos);
  photoRef.current = photos;
  const category = categoryFor(values.type),
    realEstate = category === "REAL_ESTATE",
    vehicle = category === "VEHICLES";
  const promotion = quote?.plan === plan ? quote : null;
  const price =
    promotion?.finalPrice ??
    (plan === "BASIC" ? config.adPrice : config.featuredPrice);
  useEffect(() => {
    if (!editing) return;
    let active = true;
    setPhotoReady(false);
    setError("");
    retainedPhotos(initialListing.images, request)
      .then((loaded) => {
        if (active) {
          setPhotos(loaded);
          setPhotoReady(true);
        } else loaded.forEach((photo) => URL.revokeObjectURL(photo.preview));
      })
      .catch((e) => {
        if (active)
          setError(
            "Não foi possível carregar as fotos para edição. " + e.message,
          );
      });
    return () => {
      active = false;
    };
  }, [photoRetry]);
  useEffect(() => {
    let active = true;
    request("/me")
      .then((u) => {
        if (active)
          setValues((v) => ({
            ...v,
            ownerPhone: v.ownerPhone || u.phone || "",
          }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => () => photoRef.current.forEach((p) => URL.revokeObjectURL(p.preview)),
    [],
  );
  useEffect(() => {
    formRef.current?.querySelector(`[data-step="${step}"] h3`)?.focus();
  }, [step]);
  function input(name, label, props = {}) {
    const Component = name === "ownerPhone" ? MaskedInput : "input";
    return (
      <label className="field">
        <span>{label}</span>
        <Component
          {...(name === "ownerPhone" ? { mask: "phone" } : {})}
          name={name}
          value={values[name]}
          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
          {...props}
        />
      </label>
    );
  }
  function validSection(index) {
    const invalid = [
      ...formRef.current
        .querySelector(`[data-step="${index}"]`)
        .querySelectorAll("input,select,textarea"),
    ].find((el) => !el.checkValidity());
    if (invalid) {
      setStep(index);
      requestAnimationFrame(() => invalid.reportValidity());
      return false;
    }
    if (
      index === 1 &&
      vehicle &&
      (!values.brand.trim() || !values.model.trim() || !values.year)
    ) {
      setStep(1);
      setError("Selecione marca, modelo e ano do veículo antes de continuar.");
      return false;
    }
    if (index === 2 && !photos.length) {
      setStep(2);
      setError("Selecione pelo menos uma foto.");
      return false;
    }
    return true;
  }
  function details() {
    if (realEstate) return {};
    return {
      condition: values.condition,
      ...(values.brand.trim() ? { brand: values.brand.trim() } : {}),
      ...(values.model.trim() ? { model: values.model.trim() } : {}),
      ...(vehicle
        ? { year: Number(values.year), mileage: Number(values.mileage) }
        : {}),
    };
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (busy) return;
    if (step < 4) {
      if (validSection(step)) setStep(step + 1);
      return;
    }
    for (let i = 0; i < steps.length; i++) if (!validSection(i)) return;
    if (couponPending) {
      setError("Aplique o cupom ou remova-o antes de continuar.");
      return;
    }
    if (!editing && !config.commercialEnabled) {
      setError("A contratação está temporariamente indisponível.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget),
        payer = editing ? null : readPaymentDetails(form);
      const images = await uploadSelectedPhotos(
        photos,
        request,
        (key, uploaded) =>
          setPhotos((prev) =>
            prev.map((p) => (p.key === key ? { ...p, ...uploaded } : p)),
          ),
      );
      const payload = {
        type: values.type,
        purpose: values.purpose,
        title: values.title,
        description: values.description,
        price: Math.round(Number(values.price) * 100),
        area: realEstate ? Number(values.area) : 0,
        bedrooms: realEstate ? Number(values.bedrooms) : 0,
        details: details(),
        city: values.city,
        state: values.state,
        neighborhood: values.neighborhood,
        ownerPhone: values.ownerPhone,
        contactAccepted: form.get("contactAccepted") === "on",
        images,
        plan,
        termsAccepted: form.get("termsAccepted") === "on",
        termsVersion: config.termsVersion,
        ...(promotion
          ? { couponCode: promotion.code, couponVersion: promotion.version }
          : {}),
      };
      if (editing) {
        const updated = await request(`/owner/listings/${initialListing.id}`, {
          method: "PUT",
          body: { ...payload, revision: initialListing.revision ?? 0 },
        });
        onSaved(updated);
      } else {
        const result = await createListingCheckout(
          request,
          payload,
          onCreated,
          payer,
        );
        onResult(result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      ref={formRef}
      className="form-panel listing-wizard"
      noValidate
      onSubmit={submit}
    >
      <div className="section-heading">
        <div>
          <div className="kicker">
            {editing ? "EDITAR ANÚNCIO" : "NOVO ANÚNCIO"}
          </div>
          <h2>
            {editing ? "Atualize seu anúncio" : "O que você quer anunciar?"}
          </h2>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
      <ol className="wizard-progress" aria-label="Etapas do anúncio">
        {steps.map((name, i) =>
          editing && i === 0 ? null : (
            <li
              key={name}
              aria-current={step === i ? "step" : undefined}
              className={step === i ? "current" : i < step ? "complete" : ""}
            >
              <span>{editing ? i : i + 1}</span>
              {name}
            </li>
          ),
        )}
      </ol>
      <p className="form-help">
        Etapa {editing ? step : step + 1} de {editing ? 4 : steps.length} ·{" "}
        {editing && step === 4 ? "Revisão da edição" : steps[step]}
      </p>
      <fieldset disabled={busy || !photoReady} className="wizard-fields">
        <section data-step="0" hidden={step !== 0}>
          <h3 tabIndex={-1}>Escolha a categoria</h3>
          <div className="classified-category-grid">
            {Object.entries(categories).map(([id, c]) => (
              <button
                type="button"
                aria-pressed={category === id}
                className={category === id ? "chosen" : ""}
                key={id}
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    type: Object.keys(c.types)[0],
                    area: "",
                    bedrooms: "0",
                    brand: "",
                    model: "",
                    year: "",
                    mileage: "",
                  }))
                }
              >
                <strong>{c.name}</strong>
                <small>{Object.values(c.types).join(" · ")}</small>
              </button>
            ))}
          </div>
          <label className="field">
            <span>Tipo de anúncio</span>
            <select
              value={values.type}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  type: e.target.value,
                  brand: "",
                  model: "",
                  year: "",
                  mileage: "",
                }))
              }
            >
              {Object.entries(categories[category].types).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Finalidade</span>
            <select
              value={values.purpose}
              onChange={(e) =>
                setValues((v) => ({ ...v, purpose: e.target.value }))
              }
            >
              <option value="SALE">Venda</option>
              <option value="RENT">Aluguel</option>
            </select>
          </label>
        </section>
        <section data-step="1" hidden={step !== 1}>
          <h3 tabIndex={-1}>Conte os detalhes</h3>
          <p>
            {categories[category].name} · {typeNames[values.type]}
          </p>
          {editing && (
            <p className="form-help">
              Categoria, tipo, finalidade e plano permanecem os mesmos da
              contratação.
            </p>
          )}
          <div className="form-grid">
            {input("title", "Título do anúncio", {
              required: true,
              minLength: 8,
              maxLength: 100,
            })}
            {input(
              "price",
              values.purpose === "RENT" ? "Aluguel mensal (R$)" : "Preço (R$)",
              {
                required: true,
                type: "number",
                min: "0.01",
                max: "20000000",
                step: "0.01",
              },
            )}
            {realEstate ? (
              <>
                {input("area", "Área em m²", {
                  type: "number",
                  required: true,
                  min: "0.01",
                  max: "10000000000",
                  step: "0.01",
                })}
                {input("bedrooms", "Quartos", {
                  type: "number",
                  required: true,
                  min: "0",
                  max: "100",
                  step: "1",
                })}
              </>
            ) : (
              <>
                {vehicle ? (
                  <VehicleFields
                    key={values.type}
                    type={values.type}
                    values={values}
                    setValues={setValues}
                    request={request}
                    startManual={editing}
                  />
                ) : (
                  <>
                    {input("brand", "Marca (opcional)", { maxLength: 60 })}
                    {input("model", "Modelo (opcional)", { maxLength: 100 })}
                  </>
                )}
                <label className="field">
                  <span>Condição</span>
                  <select
                    value={values.condition}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, condition: e.target.value }))
                    }
                  >
                    <option value="NEW">Novo</option>
                    <option value="USED">Usado</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <label className="field">
            <span>
              Descrição — informe características, estado e o que está incluído.
              Não inclua dados pessoais.
            </span>
            <textarea
              name="description"
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              required
              minLength={30}
              maxLength={5000}
              rows={5}
            />
          </label>
        </section>
        <section data-step="2" hidden={step !== 2}>
          <h3 tabIndex={-1}>Mostre seu anúncio</h3>
          <PhotoPicker
            photos={photos}
            setPhotos={setPhotos}
            disabled={busy || !photoReady}
            request={request}
          />
        </section>
        <section data-step="3" hidden={step !== 3}>
          <h3 tabIndex={-1}>Onde está e como falar com você?</h3>
          <div className="form-grid">
            <label className="field">
              <span>Estado</span>
              <select
                value={values.state}
                onChange={(e) =>
                  setValues((v) => ({ ...v, state: e.target.value }))
                }
              >
                {states.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {input("city", "Cidade", {
              required: true,
              minLength: 2,
              maxLength: 100,
            })}
            {input("neighborhood", "Bairro ou região", {
              required: true,
              minLength: 2,
              maxLength: 100,
            })}
            {input("ownerPhone", "WhatsApp público do anúncio (com DDD)", {
              required: true,
              type: "tel",
              maxLength: 24,
            })}
          </div>
          <p className="notice">
            Mostraremos somente cidade e bairro. O interessado abrirá uma
            conversa diretamente no WhatsApp informado.
          </p>
          <label className="checkbox">
            <input name="contactAccepted" type="checkbox" required />
            Autorizo disponibilizar este WhatsApp para contato direto dos
            interessados neste anúncio.
          </label>
        </section>
        <section data-step="4" hidden={step !== 4}>
          <h3 tabIndex={-1}>
            {editing ? "Revise as alterações" : "Revise e escolha seu plano"}
          </h3>
          <div className="listing-review">
            {photos[0] && <img src={photos[0].preview} alt="Capa escolhida" />}
            <div>
              <strong>{values.title || "Seu anúncio"}</strong>
              <p>
                {categories[category].name} · {typeNames[values.type]} ·{" "}
                {values.purpose === "RENT" ? "Aluguel" : "Venda"}
              </p>
              <p>
                {money(Math.round(Number(values.price) * 100))}
                {values.purpose === "RENT" ? "/mês" : ""}
              </p>
              <p>
                {listingFeatures({
                  ...values,
                  category,
                  area: Number(values.area),
                  bedrooms: Number(values.bedrooms),
                  details: details(),
                }).join(" · ")}
              </p>
              <p>
                {values.neighborhood} · {values.city}/{values.state}
              </p>
              <p>WhatsApp: {values.ownerPhone}</p>
              <p>{photos.length} fotos · contato direto com você</p>
            </div>
          </div>
          <p className="description">{values.description}</p>
          {editing ? (
            <>
              <p className="notice">
                A edição não gera nova cobrança nem aumenta o prazo. Vencimento:{" "}
                {initialListing.expiresAt
                  ? new Date(initialListing.expiresAt).toLocaleString("pt-BR")
                  : "o prazo começa na primeira aprovação"}
                . O anúncio volta para análise e fica fora da busca até ser
                aprovado.
              </p>
              <label className="checkbox">
                <input name="editAccepted" type="checkbox" required />
                Confirmo as alterações e autorizo a divulgação das informações e
                imagens revisadas.
              </label>
            </>
          ) : (
            <>
              <div className="plan-options">
                {[
                  ["BASIC", "Divulgação", config.adPrice],
                  ["FEATURED", "Destaque", config.featuredPrice],
                ].map(([id, name, value]) => (
                  <label key={id} className={plan === id ? "chosen" : ""}>
                    <input
                      type="radio"
                      name="plan"
                      checked={plan === id}
                      onChange={() => {
                        setPlan(id);
                        setQuote(null);
                        setCouponPending(false);
                      }}
                    />
                    <strong>
                      {name} · {money(value)}
                    </strong>
                    <span>
                      {config.durationDays} dias
                      {id === "FEATURED" ? " · prioridade na listagem" : ""}
                    </span>
                  </label>
                ))}
              </div>
              <CouponField
                key={plan}
                request={request}
                plan={plan}
                onChange={setQuote}
                onPendingChange={setCouponPending}
              />
              <PaymentFields />
              <h3>Somente divulgação, sem comissão</h3>
              <p>
                Total do anúncio: <strong>{money(price)}</strong>
                {promotion && ` com o cupom ${promotion.code}`}. A negociação
                acontece diretamente entre você e o interessado.
              </p>
              <div className="terms-text">
                {config.terms?.[values.purpose]?.replace(
                  (config.adPrice / 100).toFixed(2),
                  (price / 100).toFixed(2),
                ) || "Condições ainda não configuradas."}
              </div>
              <label className="checkbox">
                <input
                  key={`${plan}-${values.purpose}-${promotion?.code || ""}-${promotion?.version || ""}-${price}-${config.termsVersion}`}
                  name="termsAccepted"
                  type="checkbox"
                  required
                />
                Li e aceito as condições de divulgação e autorizo o uso das
                imagens.
              </label>
            </>
          )}
        </section>
      </fieldset>
      {editing && !photoReady && (
        <p className="notice" role="status">
          Carregando as fotos atuais. Se não carregar,{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setPhotoRetry((v) => v + 1)}
          >
            tente novamente
          </button>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!editing && !config.commercialEnabled && (
        <p className="notice">
          Novas contratações estão temporariamente indisponíveis.
        </p>
      )}
      <div className="wizard-actions">
        {step > (editing ? 1 : 0) && (
          <button
            type="button"
            className="outline"
            disabled={busy}
            onClick={() => {
              setError("");
              setStep(step - 1);
            }}
          >
            Voltar
          </button>
        )}
        <button
          className="primary"
          disabled={
            busy ||
            !photoReady ||
            (step === 4 &&
              !editing &&
              (couponPending || !config.commercialEnabled))
          }
        >
          {busy
            ? editing
              ? "Salvando alterações…"
              : "Preparando pagamento…"
            : step === 4
              ? editing
                ? "Salvar alterações e enviar para análise"
                : "Cadastrar e seguir para pagamento"
              : "Continuar"}
        </button>
      </div>
    </form>
  );
}
