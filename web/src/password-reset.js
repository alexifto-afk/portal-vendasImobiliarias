export function resetConfirmation(email, requestId, fields) {
  if (fields.password !== fields.confirmPassword)
    throw Error("As senhas não coincidem. Confira a confirmação.");
  return {
    email,
    requestId,
    code: String(fields.code || "").replace(/\D/g, ""),
    password: fields.password,
  };
}
export function retrySeconds(value) {
  return Number.isInteger(value) && value > 0 && value <= 3600 ? value : 60;
}
