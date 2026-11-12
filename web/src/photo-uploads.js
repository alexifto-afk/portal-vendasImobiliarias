export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export function validatePhotoFiles(files, existing = 0) {
  if (existing + files.length > MAX_PHOTOS)
    throw Error("Você pode enviar até 12 fotos por anúncio.");
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw Error(`A foto “${file.name}” precisa estar em JPG, PNG ou WebP.`);
    if (file.size > MAX_PHOTO_BYTES)
      throw Error(`A foto “${file.name}” ultrapassa 8 MB.`);
  }
}
export async function uploadSelectedPhotos(photos, request, onUploaded) {
  if (!photos.length) throw Error("Selecione pelo menos uma foto do anúncio.");
  const urls = [];
  for (const photo of photos) {
    if (photo.url) {
      urls.push(photo.url);
      continue;
    }
    const form = new FormData();
    form.append("photo", photo.file);
    const uploaded = await request("/uploads", { method: "POST", body: form });
    onUploaded(photo.key, uploaded);
    urls.push(uploaded.url);
  }
  return urls;
}
