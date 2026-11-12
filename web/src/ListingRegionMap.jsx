import React, { useState } from "react";
import { categoryFor } from "./classified-catalog.js";
import { listingRegion, regionMaps } from "./listing-location.js";
export default function ListingRegionMap({ listing }) {
  const [open, setOpen] = useState(false);
  const category = listing.category || categoryFor(listing.type);
  if (!["REAL_ESTATE", "HOME"].includes(category)) return null;
  const urls = regionMaps(listing);
  return (
    <section className="listing-region-map" aria-label="Região do anúncio">
      <h3>Região do anúncio</h3>
      <p>{listingRegion(listing)}</p>
      <p className="form-help">
        O mapa mostra uma referência do bairro e da cidade, não o endereço
        exato. Combine a localização com o anunciante.
      </p>
      {open ? (
        <iframe
          title="Mapa da região do anúncio"
          src={urls.embed}
          loading="lazy"
          referrerPolicy="no-referrer"
          allowFullScreen
        />
      ) : (
        <button type="button" className="outline" onClick={() => setOpen(true)}>
          Mostrar mapa da região
        </button>
      )}
      <a
        className="text-button"
        href={urls.external}
        target="_blank"
        rel="noreferrer"
      >
        Abrir região no Google Maps ↗
      </a>
    </section>
  );
}
