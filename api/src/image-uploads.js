import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { isPublic } from "./rules.js";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const uploadPath = (id) => `/uploads/${id}`;
export const uploadId = (value) =>
  /^\/uploads\/([a-f0-9-]{36})$/.exec(value)?.[1];
export async function normalizePhoto(buffer) {
  try {
    const image = sharp(buffer, {
      limitInputPixels: 40000000,
      animated: false,
      failOn: "error",
    });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format) || meta.pages > 1)
      throw Error("Formato não permitido");
    const data = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    if (data.length > 1024 * 1024) throw Error("Foto muito complexa");
    return data;
  } catch {
    throw Object.assign(
      Error(
        "Foto inválida. Envie JPG, PNG ou WebP de até 8 MB e 40 megapixels.",
      ),
      { status: 400 },
    );
  }
}
export function registerImageRoutes(
  app,
  { db, auth, wrap, requireAdvertiser = (_q, _r, next) => next() },
) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
  }).single("photo");
  const limit = rateLimit({
    windowMs: 3600000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  let active = 0;
  const capacity = (_q, r, n) => {
    if (active >= 2)
      return r
        .status(429)
        .json({ error: "Aguarde um instante antes de enviar outra foto." });
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    r.once("finish", release);
    r.once("close", release);
    n();
  };
  app.post(
    "/api/uploads",
    auth,
    requireAdvertiser,
    limit,
    capacity,
    (q, r, n) =>
      upload(q, r, (e) => {
        if (e)
          return r
            .status(400)
            .json({ error: "Envie uma foto por vez, de até 8 MB." });
        n();
      }),
    wrap(async (q, r) => {
      if (!q.file) return r.status(400).json({ error: "Selecione uma foto." });
      // No máximo 24 fotos em rascunhos simultâneos por proprietário.
      const count = await db.imageUpload.count({
        where: { ownerId: q.user.id, listingId: null },
      });
      if (count >= 24)
        return r.status(409).json({
          error:
            "Você já tem muitas fotos não utilizadas. Remova fotos antes de enviar novas.",
        });
      const data = await normalizePhoto(q.file.buffer),
        id = randomUUID();
      await db.imageUpload.create({
        data: { id, ownerId: q.user.id, data, mimeType: "image/webp" },
      });
      r.status(201).json({ id, url: uploadPath(id) });
    }),
  );
  app.get(
    "/api/uploads/:id",
    (q, r, n) => (q.headers.authorization ? auth(q, r, n) : n()),
    wrap(async (q, r) => {
      const image = await db.imageUpload.findUnique({
        where: { id: q.params.id },
        include: {
          listing: {
            select: {
              status: true,
              reviewed: true,
              paidAt: true,
              expiresAt: true,
            },
          },
        },
      });
      if (!image) return r.status(404).end();
      const published = image.listing && isPublic(image.listing);
      if (
        !published &&
        q.user?.id !== image.ownerId &&
        q.user?.role !== "ADMIN"
      )
        return r.status(404).end();
      r.set("Cache-Control", "private, no-store")
        .set("Cross-Origin-Resource-Policy", "cross-origin")
        .type(image.mimeType)
        .send(Buffer.from(image.data));
    }),
  );
  app.delete(
    "/api/uploads/:id",
    auth,
    requireAdvertiser,
    wrap(async (q, r) => {
      const result = await db.imageUpload.deleteMany({
        where: { id: q.params.id, ownerId: q.user.id, listingId: null },
      });
      if (!result.count)
        return r
          .status(404)
          .json({ error: "Foto não encontrada ou já utilizada em anúncio." });
      r.json({ ok: true });
    }),
  );
}
