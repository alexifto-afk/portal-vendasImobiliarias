export function partnerAccountPayload(fields, mode) {
  const base = {
    mode,
    email: fields.email,
    minWithdrawal: Math.round(Number(fields.minWithdrawal) * 100),
  };
  if (mode === "EXISTING") return base;
  if (fields.password !== fields.confirmPassword)
    throw Error("As senhas não coincidem. Confira a confirmação.");
  return {
    ...base,
    name: fields.name,
    cpf: fields.cpf,
    phone: fields.phone,
    address: fields.address,
    password: fields.password,
  };
}
export function dashboardFor(user) {
  if (user?.role === "ADMIN") return "admin";
  if (user?.role === "PARTNER" || user?.partner) return "partner";
  return "owner";
}
