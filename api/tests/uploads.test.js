import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import {
  normalizePhoto,
  registerImageRoutes,
  uploadId,
} from "../src/image-uploads.js";
let server,
  url,
  stored = new Map();
before(async () => {
  const app = express();
  const db = {
    listing: {
      findFirst: async ({ where }) => {
        const image = stored.get(uploadId(where.images.has)),
          l = image?.listing;
        return l &&
          l.status === "PUBLISHED" &&
          l.reviewed &&
          l.paidAt &&
          !l.deletedAt &&
          !l.affiliateVoidedAt &&
          new Date(l.expiresAt) > new Date()
          ? { id: "public-fixture" }
          : null;
      },
    },
    imageUpload: {
      count: async () => 0,
      create: async ({ data }) => stored.set(data.id, data),
      findUnique: async ({ where }) => stored.get(where.id),
      deleteMany: async ({ where }) => {
        const image = stored.get(where.id);
        if (image?.ownerId === where.ownerId && !image.listingId) {
          stored.delete(where.id);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };
  const auth = (q, r, n) => {
    if (!q.headers.authorization) return r.sendStatus(401);
    q.user = {
      id: q.headers.authorization,
      role: q.headers.authorization === "admin" ? "ADMIN" : "OWNER",
    };
    n();
  };
  registerImageRoutes(app, {
    db,
    auth,
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
  });
  app.use((e, q, r, n) => r.status(e.status || 500).json({ error: e.message }));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server?.close());
test("imagem é decodificada, reduzida e convertida sem metadados; conteúdo falso é rejeitado", async () => {
  const original = await sharp({
    create: { width: 1800, height: 1000, channels: 3, background: "#369" },
  })
    .jpeg()
    .toBuffer();
  const processed = await normalizePhoto(original);
  const meta = await sharp(processed).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1600);
  assert.equal(meta.exif, undefined);
  await assert.rejects(
    () => normalizePhoto(Buffer.from('<svg onload="alert(1)"></svg>')),
    /Foto inválida/,
  );
});
test("upload requer login, valida conteúdo e mantém fotos em rascunho privadas", async () => {
  assert.equal((await fetch(url + "/uploads", { method: "POST" })).status, 401);
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#369" },
  })
    .png()
    .toBuffer();
  const upload = async (bytes) => {
    const form = new FormData();
    form.append("photo", new Blob([bytes], { type: "image/png" }), "foto.png");
    return fetch(url + "/uploads", {
      method: "POST",
      headers: { Authorization: "owner" },
      body: form,
    });
  };
  assert.equal((await upload(Buffer.from("arquivo falso"))).status, 400);
  const response = await upload(png);
  assert.equal(response.status, 201);
  const photo = await response.json();
  assert.equal(uploadId(photo.url), photo.id);
  assert.equal((await fetch(url + photo.url)).status, 404);
  assert.equal(
    (
      await fetch(url + photo.url, {
        headers: { Authorization: "another-owner" },
      })
    ).status,
    404,
  );
  const preview = await fetch(url + photo.url, {
    headers: { Authorization: "owner" },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/webp");
  assert.equal(
    (await fetch(url + photo.url, { headers: { Authorization: "admin" } }))
      .status,
    200,
  );
  const record = stored.get(photo.id);
  record.listing = {
    status: "PUBLISHED",
    reviewed: true,
    paidAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  };
  assert.equal((await fetch(url + photo.url)).status, 200);
  record.listing.status = "CLOSED";
  assert.equal((await fetch(url + photo.url)).status, 404);
  assert.equal(
    (
      await fetch(url + photo.url, {
        method: "DELETE",
        headers: { Authorization: "another-owner" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(url + photo.url, {
        method: "DELETE",
        headers: { Authorization: "owner" },
      })
    ).status,
    200,
  );
});
