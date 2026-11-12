export const brandName = "Negocieê";
export const brandSlogan = "Seu lugar para comprar, vender e alugar.";
export const brandDescriptor = "NEGOCIEE";
export function statementDescriptor(value) {
  // Update the former default even if it is still present in Render. Keep a
  // distinct custom merchant descriptor configured by the operator.
  return !value || value === "LPIMOVEIS" ? brandDescriptor : value;
}
export function brandedSender(value) {
  if (!value) return value;
  // Replace only the former brand's display name, never the verified address.
  return value.replace(/^LP Imóveis\s*</i, brandName + " <");
}
