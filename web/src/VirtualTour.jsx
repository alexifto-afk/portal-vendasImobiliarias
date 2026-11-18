import React, { useState } from "react";
import Dialog from "./Dialog.jsx";
import { tourLink } from "./tour-links.js";
export default function VirtualTour({ url, title, preview = false }) {
  const [open, setOpen] = useState(false);
  const tour = tourLink(url);
  if (!tour) return null;
  return (
    <section
      className="virtual-tour"
      aria-label="Tour virtual ou visualização 360°"
    >
      <button type="button" className="outline" onClick={() => setOpen(true)}>
        {preview
          ? "Conferir tour ou visualização 360°"
          : "Visita virtual / 360°"}
      </button>
      <span className="form-help">{tour.provider}</span>
      {open && (
        <Dialog
          portal
          className="virtual-tour-dialog"
          title={preview ? "Prévia do tour virtual" : "Visita virtual / 360°"}
          onClose={() => setOpen(false)}
        >
          <p>{title}</p>
          <p className="form-help">
            Conteúdo interativo hospedado no {tour.provider}. Use os controles
            do tour para explorar.
          </p>
          <iframe
            className="virtual-tour-frame"
            title={`Visita virtual de ${title}`}
            src={tour.embedUrl}
            allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups"
          />
          <p className="form-help">
            Se o tour não carregar ou pedir acesso, consulte a versão no serviço
            de origem.
          </p>
          <a
            className="text-button"
            href={tour.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir no {tour.provider} em outra aba ↗
          </a>
        </Dialog>
      )}
    </section>
  );
}
