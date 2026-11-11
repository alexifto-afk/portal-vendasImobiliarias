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
  return {
    httpStatus,
    codes: [...new Set(raw.map(code).filter(Boolean))].slice(0, 10),
  };
}
