import { test } from "node:test";
import assert from "node:assert/strict";
import { createListingCheckout } from "../src/listing-checkout.js";
test("cadastro segue para o checkout do anúncio retornado pela API", async () => {
  const calls = [],
    payload = { title: "Casa" },
    listing = { id: "anuncio-123" };
  const result = await createListingCheckout(
    async (path, options) => {
      calls.push([path, options]);
      return path === "/owner/listings"
        ? listing
        : { url: "https://www.mercadopago.com.br/checkout" };
    },
    payload,
    (l) => calls.push(["created", l]),
  );
  assert.deepEqual(calls, [
    ["/owner/listings", { method: "POST", body: payload }],
    ["created", listing],
    ["/owner/listings/anuncio-123/checkout", { method: "POST" }],
  ]);
  assert.equal(result.url, "https://www.mercadopago.com.br/checkout");
});
test("falha no checkout mantém o anúncio cadastrado para retomar pagamento sem duplicar", async () => {
  let count = 0,
    created;
  const result = await createListingCheckout(
    async (path) => {
      count++;
      if (path === "/owner/listings") return { id: "salvo" };
      throw Error("Provedor indisponível");
    },
    {},
    (l) => (created = l),
  );
  assert.equal(count, 2);
  assert.equal(created.id, "salvo");
  assert.equal(result.listing.id, "salvo");
  assert.equal(result.url, undefined);
  assert.match(result.error, /Pagar anúncio/);
  assert.match(result.error, /Provedor indisponível/);
});
test("falha no cadastro não abre checkout nem informa que salvou", async () => {
  let count = 0,
    created = false;
  await assert.rejects(
    () =>
      createListingCheckout(
        async () => {
          count++;
          throw Error("Dados inválidos");
        },
        {},
        () => (created = true),
      ),
    /Dados inválidos/,
  );
  assert.equal(count, 1);
  assert.equal(created, false);
});
