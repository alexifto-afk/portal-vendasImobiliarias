import { test } from "node:test";
import assert from "node:assert/strict";
import { listingRegion, regionMaps } from "../src/listing-location.js";
test("mapa inclui somente bairro, cidade e estado, sem endereço exato nem dados pessoais", () => {
  const l = {
    neighborhood: "Centro",
    city: "Araguaína",
    state: "TO",
    privateAddress: "Rua privada 123",
    ownerPhone: "63999999999",
    title: "Nome privado",
  };
  assert.equal(listingRegion(l), "Centro, Araguaína, TO, Brasil");
  const urls = regionMaps(l);
  const decoded = decodeURIComponent(urls.embed);
  assert.match(decoded, /Centro, Araguaína, TO, Brasil/);
  assert.ok(!decoded.includes(l.privateAddress));
  assert.ok(!decoded.includes(l.ownerPhone));
  assert.ok(!decoded.includes(l.title));
  assert.equal(new URL(urls.external).hostname, "www.google.com");
});
