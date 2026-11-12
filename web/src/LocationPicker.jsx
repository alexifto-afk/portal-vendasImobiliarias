import React, { useEffect, useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import { markedArea } from "./marked-location.js";
import "leaflet/dist/leaflet.css";
function PickerMap({ region, initialPoint, request, onChange }) {
  const target = useRef(null),
    mapRef = useRef(null),
    chooseRef = useRef(null);
  const [message, setMessage] = useState(
    "Buscando o bairro para iniciar o mapa…",
  );
  useEffect(() => {
    let active = true,
      map,
      marker,
      circle,
      observer,
      interacted = false;
    const controller = new AbortController();
    import("leaflet")
      .then(async (module) => {
        if (!active) return;
        const L = module.default || module;
        map = L.map(target.current, { scrollWheelZoom: false }).setView(
          initialPoint
            ? [initialPoint.latitude, initialPoint.longitude]
            : [-10.5, -52],
          initialPoint ? 15 : 4,
        );
        mapRef.current = map;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        })
          .on("tileerror", () => {
            if (active)
              setMessage(
                "Alguns trechos não carregaram. Tente novamente antes de confirmar.",
              );
          })
          .addTo(map);
        const choose = (point) => {
          if (
            !Number.isFinite(point.lat) ||
            !Number.isFinite(point.lng) ||
            point.lat < -34 ||
            point.lat > 6 ||
            point.lng < -74 ||
            point.lng > -28
          ) {
            setMessage("Selecione uma localização no Brasil.");
            return;
          }
          interacted = true;
          marker?.remove();
          circle?.remove();
          marker = L.marker([point.lat, point.lng], {
            draggable: true,
            title: "Ponto reservado do imóvel. Arraste para ajustar.",
            icon: L.divIcon({
              className: "location-picker-pin",
              html: "<span></span>",
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          }).addTo(map);
          marker.on("dragend", () => {
            const moved = marker.getLatLng();
            choose(moved);
          });
          const area = markedArea(point.lat, point.lng);
          circle = L.circle([area.latitude, area.longitude], {
            radius: area.radiusMeters,
            color: "#5845f5",
            fillOpacity: 0.15,
            interactive: false,
          }).addTo(map);
          onChange({ latitude: point.lat, longitude: point.lng });
          setMessage(
            "Confira o ponto azul reservado e o círculo roxo que aparecerá para os visitantes.",
          );
        };
        chooseRef.current = () => choose(map.getCenter());
        map.on("click", (event) => choose(event.latlng));
        map.on("dragstart", () => {
          interacted = true;
        });
        observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(target.current);
        if (initialPoint) {
          choose({ lat: initialPoint.latitude, lng: initialPoint.longitude });
          return;
        }
        try {
          const area = await request("/owner/location-preview", {
            method: "POST",
            body: region,
            signal: controller.signal,
          });
          if (active && !interacted) {
            map.setView(
              [area.latitude, area.longitude],
              area.level === "city" ? 12 : 15,
            );
            setMessage(
              "Toque no local do imóvel ou mova o mapa e use “Marcar no centro do mapa”.",
            );
          }
        } catch (error) {
          if (active && !interacted)
            setMessage(
              "Não foi possível buscar o bairro. Você pode aproximar e mover o mapa manualmente para marcar o imóvel.",
            );
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Não foi possível carregar o mapa. Feche e tente novamente.",
          );
      });
    return () => {
      active = false;
      controller.abort();
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      chooseRef.current = null;
    };
  }, []);
  return (
    <>
      <div
        ref={target}
        className="location-picker-canvas"
        role="region"
        aria-label="Mapa para marcar a localização do imóvel"
      />
      <p role="status">{message}</p>
      <button
        type="button"
        className="outline small"
        onClick={() => chooseRef.current?.()}
      >
        Marcar no centro do mapa
      </button>
    </>
  );
}
export default function LocationPicker({ region, value, onChange, request }) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(null);
  const ready =
    region.city && region.state && region.neighborhood.trim().length >= 2;
  return (
    <section className="form-panel location-picker">
      <h4>Localização no mapa</h4>
      <p>
        Marque onde o imóvel fica. O visitante verá apenas um círculo aproximado
        de 500 metros de raio, sem o ponto reservado.
      </p>
      <button
        type="button"
        className="outline"
        disabled={!ready}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        {value
          ? "Conferir ou alterar localização"
          : "Marcar localização no mapa"}
      </button>
      {!ready && (
        <p className="form-help">
          Selecione cidade e UF e informe o bairro/setor primeiro.
        </p>
      )}
      {value && (
        <p className="form-help" role="status">
          Localização marcada. Confira o ponto e a área pública antes de
          continuar.
        </p>
      )}
      {value && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange(null)}
        >
          Remover marcação
        </button>
      )}
      {open && (
        <Dialog
          portal
          title="Marcar localização do imóvel"
          onClose={() => setOpen(false)}
          className="region-map-dialog"
        >
          <p>
            {region.neighborhood} · {region.city}/{region.state}
          </p>
          <p>
            Toque no mapa ou arraste o ponto azul. O círculo roxo mostra a área
            pública; o ponto azul ficará reservado.
          </p>
          <PickerMap
            region={region}
            initialPoint={value}
            request={request}
            onChange={setDraft}
          />
          <div className="wizard-actions">
            <button
              type="button"
              className="primary"
              disabled={!draft}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Confirmar localização
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
