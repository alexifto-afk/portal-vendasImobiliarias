const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
export function searchRecords(rows, query, text) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    terms.every((term) => normalize(text(row)).includes(term)),
  );
}
