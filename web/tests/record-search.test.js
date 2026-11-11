import { test } from "node:test";
import assert from "node:assert/strict";
import { searchRecords } from "../src/record-search.js";
const rows = [
  { name: "João Pereira", email: "joao@example.com" },
  { name: "Maria José", email: "maria@example.com" },
  { name: "Ana", email: "ana@example.com" },
];
const text = (r) => `${r.name} ${r.email}`;
test("pesquisa parceiros por nome e e-mail ignora acentos, caixa e espaços", () => {
  assert.deepEqual(searchRecords(rows, "JOAO", text), [rows[0]]);
  assert.deepEqual(searchRecords(rows, "  jose MARIA ", text), [rows[1]]);
  assert.deepEqual(searchRecords(rows, "ana@example.com", text), [rows[2]]);
  assert.deepEqual(searchRecords(rows, "não existe", text), []);
  assert.deepEqual(searchRecords(rows, "", text), rows);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["João Pereira", "Maria José", "Ana"],
  );
});
