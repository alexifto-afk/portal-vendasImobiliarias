export const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
export function phoneDigits(value) {
  let digits = digitsOnly(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    digits = digits.slice(2);
  return digits.slice(0, 11);
}
export function formatCpf(value) {
  const digits = digitsOnly(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
export function formatPhone(value) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length < 3) return "(" + digits;
  const subscriber = digits.slice(2),
    split = digits.length > 10 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${subscriber.slice(0, split)}${subscriber.length > split ? "-" + subscriber.slice(split) : ""}`;
}
export function maskedChange(previous, raw, caret, inputType, mask) {
  let digits = mask === "cpf" ? digitsOnly(raw).slice(0, 11) : phoneDigits(raw);
  let before = digitsOnly(raw.slice(0, caret)).length;
  if (
    inputType?.startsWith("delete") &&
    raw.length < previous.length &&
    digits === digitsOnly(previous)
  ) {
    const index = inputType === "deleteContentForward" ? before : before - 1;
    if (index >= 0) {
      digits = digits.slice(0, index) + digits.slice(index + 1);
      before = Math.max(0, index);
    }
  }
  const value = (mask === "cpf" ? formatCpf : formatPhone)(digits);
  let position = 0,
    count = 0;
  while (position < value.length && count < before) {
    if (/\d/.test(value[position])) count++;
    position++;
  }
  return { value, caret: position };
}
