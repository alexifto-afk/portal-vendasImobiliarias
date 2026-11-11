import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentReturnMessage } from "../src/payment-result.js";
test("retorno diferencia pendência, falha e sucesso sem afirmar confirmação bancária", () => {
  for (const state of ["returned", "pending", "failure"]) {
    const text = paymentReturnMessage(new URLSearchParams({ payment: state }));
    assert.match(text, /não comprova pagamento/);
    assert.ok(!text.includes("foi aprovado"));
  }
  assert.match(
    paymentReturnMessage(new URLSearchParams({ payment: "pending" })),
    /pendente/,
  );
  assert.match(
    paymentReturnMessage(new URLSearchParams({ payment: "failure" })),
    /falha ou cancelamento/,
  );
  assert.match(
    paymentReturnMessage(
      new URLSearchParams({ payment: "returned", flow: "test" }),
    ),
    /Compra de teste/,
  );
  assert.equal(
    paymentReturnMessage(new URLSearchParams({ payment: "<script>" })),
    null,
  );
});
