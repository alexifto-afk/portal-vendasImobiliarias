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
  const fields = [error?.causes, error?.cause, error?.errors]
    .flatMap((values) =>
      Array.isArray(values)
        ? values
            .slice(0, 10)
            .flatMap((item) => [item?.field, item?.property, item?.path])
        : [],
    )
    .map(field)
    .filter(Boolean);
  return {
    httpStatus,
    fields: [...new Set(fields)].slice(0, 10),
    codes: [...new Set(raw.map(code).filter(Boolean))].slice(0, 10),
  };
}
