import React, { useEffect, useState } from "react";
export default function RecordsTable({
  label,
  headings,
  rows,
  render,
  empty,
  filterKey = "",
}) {
  const [page, setPage] = useState(0),
    size = 10;
  useEffect(() => setPage(0), [filterKey]);
  const pages = Math.max(1, Math.ceil(rows.length / size)),
    current = Math.min(page, pages - 1);
  return (
    <>
      <p className="table-scroll-hint">
        Deslize a tabela para ver todas as colunas e ações.
      </p>
      <div
        className="records-table"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              {headings.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(current * size, (current + 1) * size).map(render)}
            {!rows.length && (
              <tr>
                <td colSpan={headings.length} className="records-empty">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="records-pagination">
        <span>
          {rows.length} registro(s) · página {current + 1} de {pages}
        </span>
        <div>
          <button
            className="outline small"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </button>
          <button
            className="outline small"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </>
  );
}
