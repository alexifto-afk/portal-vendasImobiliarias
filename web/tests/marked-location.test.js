import { test } from "node:test";
import assert from "node:assert/strict";
import { markedArea } from "../src/marked-location.js";
import { markedArea as serverArea } from "../../api/src/marked-location.js";
import { listingFormValues } from "../src/listing-lifecycle.js";
test("prévia da área pública corresponde à área que a API entrega, em vários pontos do Brasil", () => {
  for (const [lat, lng] of [
    [-5.648864, -48.1236783],
    [-33.4, -53.4],
    [0.00001, -51.07],
    [-10.25, -48.35],
  ])
    assert.deepEqual(markedArea(lat, lng), serverArea(lat, lng));
});
test("edição recupera marcação reservada e anúncios antigos não inventam coordenadas", () => {
  const ad = {
    price: 100,
    details: {},
    locationLatitude: -5.648864,
    locationLongitude: -48.1236783,
  };
  assert.equal(listingFormValues(ad).locationLatitude, ad.locationLatitude);
  assert.equal(
    listingFormValues({
      ...ad,
      locationLatitude: null,
      locationLongitude: null,
    }).locationLatitude,
    null,
  );
});
