import React, { useEffect, useState } from "react";
const supported = ["CAR", "MOTORCYCLE", "TRUCK"];
export default function VehicleFields({ type, values, setValues, request }) {
  const [manual, setManual] = useState(!supported.includes(type)),
    [brand, setBrand] = useState(""),
    [model, setModel] = useState("");
  const [brands, setBrands] = useState([]),
    [models, setModels] = useState([]),
    [years, setYears] = useState([]),
    [loading, setLoading] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (manual) return;
    const controller = new AbortController();
    let active = true;
    const base = `/vehicles/${type}/brands`;
    const stage = model ? "years" : brand ? "models" : "brands";
    const path = model
      ? `${base}/${brand}/models/${model}/years`
      : brand
        ? `${base}/${brand}/models`
        : base;
    setLoading(stage);
    setError("");
    request(path, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        if (stage === "brands") setBrands(data);
        if (stage === "models") setModels(data);
        if (stage === "years")
          setYears(
            [
              ...new Set(
                data
                  .map((y) => Number(y.id.split("-")[0]))
                  .filter(
                    (y) => y >= 1900 && y <= new Date().getFullYear() + 1,
                  ),
              ),
            ].sort((a, b) => b - a),
          );
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading("");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [type, brand, model, manual, retry]);
  const change = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  function field(key, label, props = {}) {
    return (
      <label className="field">
        <span>{label}</span>
        <input
          name={key}
          value={values[key]}
          onChange={(e) => change(key, e.target.value)}
          required
          {...props}
        />
      </label>
    );
  }
  return (
    <div className="vehicle-catalog-fields">
      <div className="form-grid">
        {manual ? (
          <>
            {field("brand", "Marca", { maxLength: 60 })}
            {field("model", "Modelo", { maxLength: 100 })}
            {field("year", "Ano", {
              type: "number",
              min: 1900,
              max: new Date().getFullYear() + 1,
              step: 1,
            })}
          </>
        ) : (
          <>
            <label className="field">
              <span>Marca</span>
              <select
                aria-label="Marca"
                required
                value={brand}
                disabled={loading === "brands"}
                onChange={(e) => {
                  const id = e.target.value;
                  setBrand(id);
                  setModel("");
                  setModels([]);
                  setYears([]);
                  setValues((v) => ({
                    ...v,
                    brand: brands.find((b) => b.id === id)?.name || "",
                    model: "",
                    year: "",
                  }));
                }}
              >
                <option value="">
                  {loading === "brands"
                    ? "Carregando marcas…"
                    : "Selecione a marca"}
                </option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Modelo</span>
              <select
                aria-label="Modelo"
                required
                value={model}
                disabled={!brand || loading === "models"}
                onChange={(e) => {
                  const id = e.target.value;
                  setModel(id);
                  setYears([]);
                  setValues((v) => ({
                    ...v,
                    model: models.find((m) => m.id === id)?.name || "",
                    year: "",
                  }));
                }}
              >
                <option value="">
                  {loading === "models"
                    ? "Carregando modelos…"
                    : brand
                      ? "Selecione o modelo"
                      : "Primeiro escolha a marca"}
                </option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ano</span>
              <select
                aria-label="Ano"
                required
                value={values.year}
                disabled={!model || loading === "years"}
                onChange={(e) => change("year", e.target.value)}
              >
                <option value="">
                  {loading === "years"
                    ? "Carregando anos…"
                    : model
                      ? "Selecione o ano"
                      : "Primeiro escolha o modelo"}
                </option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {field("mileage", "Quilometragem (km)", {
          type: "number",
          min: 0,
          max: 10000000,
          step: 1,
        })}
      </div>
      {error && !manual && (
        <p className="notice error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            type="button"
            onClick={() => setRetry((r) => r + 1)}
          >
            Tentar novamente
          </button>
        </p>
      )}
      {supported.includes(type) && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setManual(!manual);
            setBrand("");
            setModel("");
            setBrands([]);
            setModels([]);
            setYears([]);
            setValues((v) => ({ ...v, brand: "", model: "", year: "" }));
          }}
        >
          {manual
            ? "Usar lista de marcas e modelos"
            : "Não encontrei meu veículo / preencher manualmente"}
        </button>
      )}
      {!manual && (
        <p className="form-help">
          Escolha a marca para carregar os modelos e, depois, os anos
          disponíveis. Catálogo de referência FIPE via Parallelum. Veículos não
          listados podem ser informados manualmente.
        </p>
      )}
    </div>
  );
}
