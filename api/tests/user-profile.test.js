import { test } from "node:test";
import assert from "node:assert/strict";
import {
  profileSchema,
  registrationSchema,
  sessionUser,
} from "../src/user-profile.js";
const valid = {
  name: "Maria Pereira",
  cpf: "123.456.789-09",
  phone: "+55 (63) 99999-9999",
  address: "Rua de teste, 100, Centro, Palmas, TO, 77000-000",
};
test("cadastro exige CPF com dígitos válidos, celular com DDD e endereço completo", () => {
  const result = registrationSchema.parse({
    ...valid,
    email: " MARIA@example.com ",
    password: "test-password-local",
    role: "ADMIN",
  });
  assert.equal(result.cpf, "12345678909");
  assert.equal(result.phone, "63999999999");
  assert.equal(result.email, "maria@example.com");
  assert.equal(result.role, undefined);
  for (const patch of [
    { cpf: "11111111111" },
    { cpf: "12345678900" },
    { phone: "6333334444" },
    { phone: "999999999" },
    { address: "rua" },
  ])
    assert.throws(() => profileSchema.parse({ ...valid, ...patch }));
  for (const key of ["name", "cpf", "phone", "address"]) {
    const missing = { ...valid };
    delete missing[key];
    assert.throws(() => profileSchema.parse(missing));
  }
});
test("perfil normaliza DDD 55 sem confundir com prefixo do país; protege privilégios", () => {
  const result = profileSchema.parse({
    ...valid,
    phone: "(55) 99999-9999",
    email: "other@example.com",
    role: "ADMIN",
    id: "other",
    passwordHash: "secret",
  });
  assert.equal(result.phone, "55999999999");
  assert.equal(result.role, undefined);
  assert.equal(result.email, undefined);
  assert.equal(result.passwordHash, undefined);
});
test("sessão não retorna documentos, endereço, senha ou chave Pix e aceita conta antiga", () => {
  const result = sessionUser({
    id: "u",
    name: "Maria",
    email: "test@example.com",
    role: "OWNER",
    cpf: valid.cpf,
    phone: valid.phone,
    address: valid.address,
    passwordHash: "secret",
  });
  assert.equal(result.profileComplete, true);
  assert.ok(!JSON.stringify(result).includes("123.456"));
  assert.equal(result.address, undefined);
  assert.equal(result.passwordHash, undefined);
  assert.equal(
    sessionUser({ id: "legacy", name: "Antigo", role: "OWNER" })
      .profileComplete,
    false,
  );
});
