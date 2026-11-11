import { searchRecords } from "./record-search.js";
export function customerLevel(user) {
  return user.role === "PARTNER"
    ? "Parceiro"
    : user.partner
      ? "Cliente e parceiro"
      : "Cliente";
}
export function filterCustomers(users, query, level) {
  const digits = query.replace(/\D/g, "");
  const matches =
    digits && !/[a-zA-ZÀ-ÿ]/.test(query)
      ? users.filter((u) => (u.phone || "").includes(digits))
      : searchRecords(
          users,
          query,
          (u) => `${u.name} ${u.email} ${u.phone || ""}`,
        );
  return matches.filter(
    (u) =>
      level === "ALL" ||
      (level === "CLIENT" && u.role === "OWNER" && !u.partner) ||
      (level === "BOTH" && u.role === "OWNER" && u.partner) ||
      (level === "PARTNER" && u.role === "PARTNER"),
  );
}
export function customerEditPayload(fields) {
  const nullable = (value) => String(value || "").trim() || null;
  return {
    name: fields.name,
    email: fields.email,
    cpf: nullable(fields.cpf),
    phone: nullable(fields.phone),
    address: nullable(fields.address),
    confirmEmailChange: fields.confirmEmailChange === "on",
  };
}
