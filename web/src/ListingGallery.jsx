import React, { useState } from "react";
export default function ListingGallery(props) {
  return <Gallery key={JSON.stringify(props.images)} {...props} />;
}
function Gallery({
  images = [],
  title,
  Photo,
  card = false,
  onOpen,
  children,
}) {
  const [index, setIndex] = useState(0);
  const move = (step) =>
    setIndex((current) => (current + step + images.length) % images.length);
  return (
    <div
      className={
        card
          ? "card-image listing-slides"
          : "property-detail-cover listing-slides"
      }
      role="group"
      aria-label={`Fotos de ${title}`}
      tabIndex={images.length > 1 ? 0 : undefined}
      onKeyDown={(event) => {
        if (
          images.length > 1 &&
          ["ArrowLeft", "ArrowRight"].includes(event.key)
        ) {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      {onOpen ? (
        <button
          type="button"
          className="slide-open"
          onClick={onOpen}
          aria-label={`Ver anúncio: ${title}`}
        >
          <Photo
            src={images[index]}
            alt={`${title} — foto ${index + 1}`}
            loading="lazy"
          />
        </button>
      ) : (
        <Photo
          className="detail-cover"
          src={images[index]}
          alt={`${title} — foto ${index + 1}`}
        />
      )}
      {children}
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="slide-nav slide-prev"
            aria-label={`Foto anterior de ${title}`}
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="slide-nav slide-next"
            aria-label={`Próxima foto de ${title}`}
            onClick={() => move(1)}
          >
            ›
          </button>
          <span className="slide-count" aria-live="polite" aria-atomic="true">
            {index + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}
