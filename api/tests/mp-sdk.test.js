import { test } from "node:test";
import assert from "node:assert/strict";
import { requestMercadoPago } from "../src/mp-sdk.js";
test("SDK oficial envia autenticação isolada, idempotência e metadados de identificação do SDK", async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: "id", results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const key = "12345678-1234-4234-8234-123456789abc";
    await requestMercadoPago("test-token", "/users/me");
    await requestMercadoPago("test-token", "/v1/orders", {
      method: "POST",
      headers: { "X-Idempotency-Key": key },
      body: JSON.stringify({
        type: "online",
        processing_mode: "manual",
        total_amount: "10.00",
      }),
    });
    await requestMercadoPago("test-token", "/v1/orders/ORDTST123");
    await requestMercadoPago("production-token", "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({ external_reference: "listing" }),
    });
    await requestMercadoPago(
      "production-token",
      "/v1/payments/search?external_reference=listing&limit=50",
    );
    assert.equal(calls[0].url, "https://api.mercadopago.com/users/me");
    const order = calls[1],
      headers = new Headers(order.options.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-token");
    assert.equal(headers.get("X-Idempotency-Key"), key);
    assert.ok(headers.get("User-Agent"));
    assert.ok(headers.get("X-Product-Id"));
    assert.equal(JSON.parse(order.options.body).total_amount, "10.00");
    assert.equal(
      new Headers(calls[3].options.headers).get("Authorization"),
      "Bearer production-token",
    );
    assert.ok(calls[4].url.includes("external_reference=listing"));
  } finally {
    globalThis.fetch = original;
  }
});
