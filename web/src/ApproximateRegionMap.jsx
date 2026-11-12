import React, { useEffect, useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import { regionMaps, listingRegion } from "./listing-location.js";
import "leaflet/dist/leaflet.css";
function CircleMap({ area }) {
  const target = useRef(null);
  const [error, setError] = useState(""),
    [tileError, setTileError] = useState(false);
  useEffect(() => {
    let active = true,
      map,
      observer,
      frame;
    import("leaflet")
      .then((module) => {
        if (!active) return;
        const L = module.default || module;
        map = L.map(target.current, {
          scrollWheelZoom: false,
          attributionControl: true,
          zoomControl: false,
        }).setView([area.latitude, area.longitude], 13);
        L.control
          .zoom({ zoomInTitle: "Aproximar mapa", zoomOutTitle: "Afastar mapa" })
          .addTo(map);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          updateWhenIdle: true,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => {
            if (active) setTileError(true);
          })
          .addTo(map);
        const circle = L.circle([area.latitude, area.longitude], {
          radius: area.radiusMeters,
          color: "#5845f5",
          fillColor: "#5845f5",
          fillOpacity: 0.2,
          weight: 3,
          interactive: false,
        }).addTo(map);
        map.fitBounds(circle.getBounds(), {
          padding: [24, 24],
          maxZoom: 15,
          animate: false,
        });
        target.current.setAttribute(
          "aria-label",
          "Mapa com círculo da região aproximada, sem pino do imóvel",
        );
        const fit = () => {
          map?.invalidateSize();
          map?.fitBounds(circle.getBounds(), {
            padding: [24, 24],
            maxZoom: 15,
            animate: false,
          });
        };
        frame = requestAnimationFrame(fit);
        observer = new ResizeObserver(fit);
        observer.observe(target.current);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar o mapa. Use o link externo para consultar a região.",
          );
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      map?.remove();
    };
  }, [area]);
  return (
    <>
      <div
        className="region-map-canvas"
        ref={target}
        role="region"
        aria-label="Carregando mapa da região"
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {tileError && (
        <p className="notice" role="status">
          Alguns trechos do mapa não carregaram. Você também pode consultar a
          região no mapa externo.
        </p>
      )}
    </>
  );
}
export default function ApproximateRegionMap({ listing, request, onClose }) {
  const [area, setArea] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setArea(null);
    setError("");
    const timer = setTimeout(() => {
      if (active) {
        setError(
          "A consulta da região demorou mais que o esperado. Tente novamente ou use o mapa externo.",
        );
        controller.abort();
      }
    }, 25000);
    request(`/listings/${listing.id}/region`, { signal: controller.signal })
      .then((data) => {
        if (active) setArea(data);
      })
      .catch((e) => {
        if (active && !controller.signal.aborted) setError(e.message);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [listing.id, retry]);
  return (
    <Dialog
      title="Localização aproximada"
      onClose={onClose}
      portal
      className="region-map-dialog"
    >
      <p className="region-map-label">
        {area?.label || listingRegion(listing)}
      </p>
      {!area && !error && (
        <div className="region-map-loading" role="status">
          Localizando a região do imóvel…
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button
            className="outline small"
            type="button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {area && <CircleMap key={retry} area={area} />}
      <p className="region-map-explanation">
        O círculo destaca uma área aproximada de referência{" "}
        {area?.level === "city" ? "da cidade" : "do bairro"}, não a posição nem
        os limites do imóvel. Ele usa uma referência pública do bairro. Combine
        o endereço exato com o anunciante.
      </p>
      {area?.level === "city" && (
        <p className="form-help">
          O bairro não foi localizado com segurança. Por isso, o mapa mostra uma
          região mais ampla da cidade cadastrada.
        </p>
      )}
      <a
        className="text-button"
        href={regionMaps(listing).external}
        target="_blank"
        rel="noreferrer"
      >
        Abrir região no mapa externo ↗
      </a>
    </Dialog>
  );
}
