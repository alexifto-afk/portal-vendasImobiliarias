import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerAccountPayload, dashboardFor } from "../src/partner-access.js";
test("cadastro de acesso exige senhas iguais e envia valores explicitamente sem papel escolhido pelo cliente", () => {
  const fields = {
    name: "Maria",
    email: "maria@example.com",
    cpf: "12345678909",
    phone: "63999999999",
    address: "Rua local de teste",
    password: "local-test-password",
    confirmPassword: "local-test-password",
    minWithdrawal: "15.90",
    role: "ADMIN",
  };
  const result = partnerAccountPayload(fields, "CREATE");
  assert.equal(result.minWithdrawal, 1590);
  assert.equal(result.password, fields.password);
  assert.equal(result.role, undefined);
  assert.equal(result.confirmPassword, undefined);
  assert.throws(
    () =>
      partnerAccountPayload(
        { ...fields, confirmPassword: "different" },
        "CREATE",
      ),
    /não coincidem/,
  );
  assert.deepEqual(partnerAccountPayload(fields, "EXISTING"), {
    mode: "EXISTING",
    email: fields.email,
    minWithdrawal: 1590,
  });
});
test("login direciona parceiro ao próprio painel e preserva painel administrativo e do proprietário", () => {
  assert.equal(dashboardFor({ role: "PARTNER" }), "partner");
  assert.equal(
    dashboardFor({ role: "ADMIN", partner: { active: true } }),
    "admin",
  );
  assert.equal(dashboardFor({ role: "OWNER" }), "owner");
  assert.equal(
    dashboardFor({ role: "OWNER", partner: { active: true } }),
    "partner",
  );
});
