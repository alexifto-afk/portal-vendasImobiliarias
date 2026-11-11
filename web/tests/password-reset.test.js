import { test } from "node:test";
import assert from "node:assert/strict";
import { resetConfirmation, retrySeconds } from "../src/password-reset.js";
test("confirmação mantém zeros no código e recusa senhas divergentes", () => {
  assert.deepEqual(
    resetConfirmation("test@example.com", "request", {
      code: "000 123",
      password: "new-test-password",
      confirmPassword: "new-test-password",
      role: "ADMIN",
    }),
    {
      email: "test@example.com",
      requestId: "request",
      code: "000123",
      password: "new-test-password",
    },
  );
  assert.throws(
    () =>
      resetConfirmation("test@example.com", "request", {
        password: "one",
        confirmPassword: "two",
      }),
    /não coincidem/,
  );
});
test("prazo de reenvio aceita somente segundos inteiros dentro do limite", () => {
  assert.equal(retrySeconds(3600), 3600);
  assert.equal(retrySeconds(60), 60);
  for (const value of [0, -1, 1.5, "60", 10000000, null])
    assert.equal(retrySeconds(value), 60);
});
