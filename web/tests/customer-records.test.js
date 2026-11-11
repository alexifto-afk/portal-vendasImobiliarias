import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterCustomers,
  customerLevel,
  customerEditPayload,
} from "../src/customer-records.js";
const rows = [
  {
    name: "João Silva",
    email: "joao@example.com",
    phone: "63999999999",
    role: "OWNER",
    partner: null,
  },
  {
    name: "Ana",
    email: "ana@example.com",
    phone: null,
    role: "OWNER",
    partner: { id: "p" },
  },
  {
    name: "Maria",
    email: "maria@example.com",
    phone: "11988887777",
    role: "PARTNER",
    partner: { id: "q" },
  },
];
test("clientes podem ser pesquisados sem acentos, por e-mail ou telefone formatado e filtrados por nível", () => {
  assert.deepEqual(filterCustomers(rows, "JOAO", "ALL"), [rows[0]]);
  assert.deepEqual(filterCustomers(rows, "ana@example.com", "ALL"), [rows[1]]);
  assert.deepEqual(filterCustomers(rows, "(63) 99999-9999", "ALL"), [rows[0]]);
  assert.deepEqual(filterCustomers(rows, "", "CLIENT"), [rows[0]]);
  assert.deepEqual(filterCustomers(rows, "", "BOTH"), [rows[1]]);
  assert.deepEqual(filterCustomers(rows, "", "PARTNER"), [rows[2]]);
  assert.equal(customerLevel(rows[1]), "Cliente e parceiro");
});
test("edição preserva ausência de dados antigos sem enviar papel ou senha", () => {
  const data = customerEditPayload({
    name: "Nome de teste",
    email: "test@example.com",
    cpf: "",
    phone: "",
    address: "  ",
    role: "ADMIN",
    passwordHash: "secret",
    confirmEmailChange: "on",
  });
  assert.equal(data.cpf, null);
  assert.equal(data.phone, null);
  assert.equal(data.address, null);
  assert.equal(data.confirmEmailChange, true);
  assert.equal(data.role, undefined);
  assert.equal(data.passwordHash, undefined);
});
