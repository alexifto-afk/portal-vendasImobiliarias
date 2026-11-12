import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCpf,
  formatPhone,
  maskedChange,
  phoneDigits,
} from "../src/input-masks.js";
test("CPF aceita dígitos ou colagem com máscara, limita tamanho e mantém vazio", () => {
  assert.equal(formatCpf("52998224725"), "529.982.247-25");
  assert.equal(formatCpf("529.982.247-25"), "529.982.247-25");
  assert.equal(formatCpf("52998224725123abc"), "529.982.247-25");
  assert.equal(formatCpf("1234"), "123.4");
  assert.equal(formatCpf(""), "");
});
test("telefone formata fixo, celular e colagem com país sem confundir DDD 55", () => {
  assert.equal(formatPhone("63999915770"), "(63) 99991-5770");
  assert.equal(formatPhone("6332221234"), "(63) 3222-1234");
  assert.equal(formatPhone("+55 (63) 99991-5770"), "(63) 99991-5770");
  assert.equal(formatPhone("55999915770"), "(55) 99991-5770");
  assert.equal(phoneDigits("+55 (63) 99991-5770"), "63999915770");
  assert.equal(formatPhone(""), "");
});
test("edição no meio e apagar separadores preservam posição e permitem apagar dígitos", () => {
  assert.deepEqual(
    maskedChange(
      "123.456.789-01",
      "123456.789-01",
      3,
      "deleteContentBackward",
      "cpf",
    ),
    { value: "124.567.890-1", caret: 2 },
  );
  const middle = maskedChange(
    "123.456.789-01",
    "123.956.789-01",
    5,
    "insertText",
    "cpf",
  );
  assert.equal(middle.value, "123.956.789-01");
  assert.equal(middle.caret, 5);
});
