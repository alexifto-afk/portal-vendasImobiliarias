// Não expõe mensagens livres, requisição, token, CPF, email ou objeto bruto do SDK.
export function safeProviderError(error) {
  const status = Number(error?.status),
    httpStatus =
      Number.isInteger(status) && status >= 400 && status <= 599
        ? status
        : null;
  const code = (value) => {
    if (
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 999999
    )
      return String(value);
    if (
      typeof value === "string" &&
      /^(?:[a-z][a-z0-9_]{1,79}|\d{1,6})$/.test(value)
    )
      return value;
    return null;
  };
  const raw = [
    error?.error,
    ...[error?.causes, error?.cause, error?.errors].flatMap((values) =>
      Array.isArray(values) ? values.slice(0, 10).map((v) => v?.code) : [],
    ),
  ];
  const field = (value) => {
    if (Array.isArray(value)) value = value.join(".");
    return typeof value === "string" &&
      /^(?:payer|items|additional_info|config|type|processing_mode|total_amount|external_reference)(?:[.][a-zA-Z_][a-zA-Z0-9_]*|\[\d{1,3}\]|[.]\d{1,3})*$/.test(
        value,
      ) &&
      value.length <= 180
      ? value
      : null;
  };
  // Algumas respostas Orders só identificam o campo dentro de message/description.
  // Extraímos apenas nomes conhecidos; nunca retornamos a mensagem livre.
  const knownPaths = new Set([
    "type", "processing_mode", "total_amount", "external_reference",
    "payer.email", "payer.phone", "payer.phone.area_code", "payer.phone.number",
    "payer.first_name", "payer.last_name", "payer.identification.type",
    "payer.identification.number", "payer.registration_date",
    "payer.authentication_type", "payer.is_first_purchase_online", "payer.last_purchase",
    "items.external_code", "items.title", "items.description", "items.category_id",
    "items.unit_price", "items.quantity", "config.statement_descriptor",
    "config.online.success_url", "config.online.failure_url", "config.online.pending_url",
    "config.online.auto_return", "config.online.transaction_security.validation",
    "config.online.transaction_security.liability_shift",
  ]);
  const messageFields = (value) => {
    if (typeof value !== "string") return [];
    return (value.slice(0, 4000).match(/[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\[\d{1,3}\])?\.[a-zA-Z0-9_]+)+|\b(?:type|processing_mode|total_amount|external_reference)\b/g) || [])
      .filter((path) => knownPaths.has(path.replace(/^additional_info\./, "").replace(/\[\d{1,3}\]|\.\d{1,3}(?=\.)/g, "")));
  };
  const fields = [error?.causes, error?.cause, error?.errors]
    .flatMap((values) =>
      Array.isArray(values)
        ? values
            .slice(0, 10)
            .flatMap((item) => [item?.field, item?.property, item?.path,
              ...messageFields(item?.message), ...messageFields(item?.description)])
        : [],
    )
    .concat(messageFields(error?.message))
    .map(field)
    .filter(Boolean);
  return {
    httpStatus,
    fields: [...new Set(fields)].slice(0, 10),
    codes: [...new Set(raw.map(code).filter(Boolean))].slice(0, 10),
  };
}
