import React, { useEffect, useState } from "react";
import { states } from "./classified-catalog.js";
import { selectedCity } from "./location-options.js";
export default function StateCityFields({
  value,
  onChange,
  request,
  required = false,
  allowAll = false,
  legacyLocation = null,
  onReadyChange,
}) {
  const [cities, setCities] = useState([]),
    [loading, setLoading] = useState(Boolean(value.state)),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setCities([]);
    setError("");
    setLoading(Boolean(value.state));
    if (!value.state)
      return () => {
        active = false;
        controller.abort();
      };
    request(`/locations/${value.state}/cities`, { signal: controller.signal })
      .then((rows) => {
        if (active) setCities(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [value.state, retry]);
  const chosen = selectedCity(cities, value, legacyLocation);
  const ready = Boolean(value.state && !loading && !error && chosen.name);
  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);
  return (
    <>
      <label className="field">
        <span>Estado (UF)</span>
        <select
          name="state"
          aria-label="Estado"
          autoComplete="address-level1"
          required={required}
          value={value.state}
          onChange={(e) => {
            setCities([]);
            onChange({ state: e.target.value, city: "" });
          }}
        >
          <option value="">
            {allowAll ? "Todos os estados" : "Selecione o estado"}
          </option>
          {states.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </label>
      <div className="state-city-field">
        <label className="field">
          <span>Cidade</span>
          <select
            name="city"
            aria-label="Cidade"
            autoComplete="address-level2"
            value={chosen.name}
            required={required}
            disabled={!value.state || loading || Boolean(error)}
            onChange={(e) =>
              onChange({ state: value.state, city: e.target.value })
            }
          >
            <option value="">
              {!value.state
                ? "Primeiro selecione o estado"
                : loading
                  ? "Carregando cidades…"
                  : error
                    ? "Cidades indisponíveis"
                    : allowAll
                      ? "Todas as cidades"
                      : "Selecione a cidade"}
            </option>
            {chosen.legacy && (
              <option value={chosen.name}>{chosen.name} (já cadastrada)</option>
            )}
            {cities.map((city) => (
              <option key={city.id} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="form-help" role="alert">
            Não foi possível carregar as cidades.{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => setRetry((n) => n + 1)}
            >
              Tentar novamente
            </button>
          </p>
        )}
        {chosen.legacy && !loading && !error && (
          <p className="form-help">
            Localidade preservada do anúncio anterior. Você pode selecionar o
            município correspondente.
          </p>
        )}
      </div>
    </>
  );
}
