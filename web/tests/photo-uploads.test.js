import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePhotoFiles,
  uploadSelectedPhotos,
} from "../src/photo-uploads.js";
test("seletor limita quantidade, tamanho e formato", () => {
  const jpg = { name: "casa.jpg", type: "image/jpeg", size: 100 };
  assert.doesNotThrow(() => validatePhotoFiles([jpg], 11));
  assert.throws(() => validatePhotoFiles([jpg], 12), /12 fotos/);
  assert.throws(
    () => validatePhotoFiles([{ ...jpg, size: 9 * 1024 * 1024 }]),
    /8 MB/,
  );
  assert.throws(
    () => validatePhotoFiles([{ ...jpg, type: "text/html" }]),
    /JPG/,
  );
});
test("envio retoma fotos já enviadas sem duplicar e mantém a ordem da capa", async () => {
  const calls = [],
    uploaded = [];
  const photos = [
    { key: "capa", url: "/uploads/capa" },
    { key: "nova", file: new Blob(["photo"], { type: "image/jpeg" }) },
  ];
  const urls = await uploadSelectedPhotos(
    photos,
    async (path, options) => {
      assert.equal(path, "/uploads");
      assert.ok(options.body instanceof FormData);
      assert.ok(options.body.get("photo"));
      calls.push(path);
      return { id: "nova", url: "/uploads/nova" };
    },
    (key, d) => uploaded.push([key, d]),
  );
  assert.deepEqual(urls, ["/uploads/capa", "/uploads/nova"]);
  assert.equal(calls.length, 1);
  assert.equal(uploaded[0][0], "nova");
});
test("sem fotos ou com falha no envio o fluxo não continua com anúncio incompleto", async () => {
  await assert.rejects(
    () =>
      uploadSelectedPhotos(
        [],
        () => {},
        () => {},
      ),
    /Selecione/,
  );
  await assert.rejects(
    () =>
      uploadSelectedPhotos(
        [{ key: "x", file: new Blob(["x"]) }],
        async () => {
          throw Error("Falha de rede");
        },
        () => {},
      ),
    /Falha de rede/,
  );
});
