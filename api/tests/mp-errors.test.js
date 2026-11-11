import { test } from "node:test";
import assert from "node:assert/strict";
import { safeProviderError } from "../src/mp-errors.js";
test("erro do SDK retorna HTTP e códigos controlados, sem expor dados livres", () => {
  const result = safeProviderError({
    status: 400,
    error: "bad_request",
    message: "APP_USR-secret",
    causes: [
      { code: 145, description: "private@example.com" },
      { code: "invalid_transaction_security", data: { cpf: "12345678909" } },
    ],
    errors: [
      { code: "bad_request" },
      { code: "APP_USR-secret" },
      { code: "12345678909" },
      { code: "private@example.com" },
    ],
    request: { Authorization: "secret" },
  });
  assert.deepEqual(result, {
    httpStatus: 400,
    fields: [],
    codes: ["bad_request", "145", "invalid_transaction_security"],
  });
  assert.deepEqual(safeProviderError(new Error("secret")), {
    httpStatus: null,
    fields: [],
    codes: [],
  });
});

test("caminhos de campos são filtrados sem expor valores do pedido", () => {
  const value = safeProviderError({
    status: 400,
    errors: [
      {
        code: "invalid_value",
        field: "payer.authentication_type",
        value: "secret",
      },
      { code: "invalid_property", path: ["items", 0, "external_code"] },
      { field: "private@example.com" },
      { property: "config.online.transaction_security.validation" },
      { field: "Authorization" },
    ],
  });
  assert.deepEqual(value.fields, [
    "payer.authentication_type",
    "items.0.external_code",
    "config.online.transaction_security.validation",
  ]);
  assert.ok(!JSON.stringify(value).includes("secret"));
  assert.ok(!JSON.stringify(value).includes("@"));
});
