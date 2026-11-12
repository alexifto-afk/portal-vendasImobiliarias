import React, { useEffect, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";
import { validatePhotoFiles } from "./photo-uploads.js";
export function MediaImage({ src, apiBase, token, ...props }) {
  const [image, setImage] = useState(""),
    [failed, setFailed] = useState(false);
  const uploaded = src?.startsWith("/uploads/");
  useEffect(() => {
    if (!uploaded) return;
    let objectUrl,
      active = true;
    const controller = new AbortController();
    setImage("");
    setFailed(false);
    fetch(apiBase + src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setImage(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((e) => {
        if (e.name !== "AbortError" && active) setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, apiBase, token, uploaded]);
  if (uploaded && !image)
    return (
      <div
        className={props.className || "photo-placeholder"}
        role="img"
        aria-label={
          failed ? "Foto indisponível" : props.alt || "Carregando foto"
        }
      >
        <ImagePlus size={24} />
        {failed && <small>Foto indisponível</small>}
      </div>
    );
  return <img {...props} src={uploaded ? image : src} />;
}
export function PhotoPicker({ photos, setPhotos, disabled, request }) {
  const [error, setError] = useState("");
  const add = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    try {
      validatePhotoFiles(files, photos.length);
      const selected = files.map((file) => {
        const preview = URL.createObjectURL(file);
        return { key: crypto.randomUUID(), file, preview };
      });
      setPhotos((previous) => [...previous, ...selected]);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (photo) => {
    try {
      if (photo.id && !photo.existing)
        await request(`/uploads/${photo.id}`, { method: "DELETE" });
      setPhotos((previous) => previous.filter((p) => p.key !== photo.key));
      URL.revokeObjectURL(photo.preview);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <fieldset className="photo-picker" disabled={disabled}>
      <legend>Fotos do anúncio</legend>
      <p>Selecione de 1 a 12 fotos. A primeira será a capa do anúncio.</p>
      <label className="photo-drop">
        <Upload size={25} />
        <strong>Selecionar fotos do anúncio</strong>
        <span>
          Do computador ou celular · JPG, PNG ou WebP · até 8 MB por foto
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={add}
          aria-label="Selecionar fotos do anúncio"
        />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="photo-previews">
        {photos.map((photo, index) => (
          <div className="photo-preview" key={photo.key}>
            <img src={photo.preview} alt={`Foto ${index + 1} do anúncio`} />
            <span>{index === 0 ? "Capa" : `Foto ${index + 1}`}</span>
            <div className="photo-order-actions">
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Mover foto ${index + 1} para antes`}
                onClick={() =>
                  setPhotos((previous) => {
                    const next = [...previous];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    return next;
                  })
                }
              >
                ←
              </button>
              <button
                type="button"
                disabled={index === photos.length - 1}
                aria-label={`Mover foto ${index + 1} para depois`}
                onClick={() =>
                  setPhotos((previous) => {
                    const next = [...previous];
                    [next[index], next[index + 1]] = [
                      next[index + 1],
                      next[index],
                    ];
                    return next;
                  })
                }
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={() => remove(photo)}
              aria-label={`Remover foto ${index + 1}`}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <small>
        {photos.length}/12 fotos selecionadas. Não inclua documentos pessoais ou
        dados privados nas imagens.
      </small>
    </fieldset>
  );
}
