import { useState } from "react";
export function PdfButton({
  request,
  path,
  filename,
  children = "Baixar recibo PDF",
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        className="outline small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const blob = await request(path, { responseType: "blob" });
            const url = URL.createObjectURL(blob),
              anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = filename;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Gerando PDF…" : children}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export default function Reports({ request }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [kind, setKind] = useState("payments");
  return (
    <section className="form-panel">
      <h2>Relatórios em PDF</h2>
      <p>
        Escolha um período de até 366 dias, no horário de Brasília. Os
        relatórios incluem renovações e anúncios excluídos pagos no período.
      </p>
      <label className="field">
        Relatório
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="payments">Pagamentos de anúncios</option>
          <option value="payouts">Repasses confirmados aos parceiros</option>
          <option value="credits">Créditos e reversões dos parceiros</option>
        </select>
      </label>
      <label className="field">
        De
        <input
          type="date"
          required
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label className="field">
        Até
        <input
          type="date"
          required
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      {from && to && from <= to && (
        <PdfButton
          request={request}
          path={`/admin/reports/${kind}?${new URLSearchParams({ from, to })}`}
          filename={`relatorio-${kind}-${from}-${to}.pdf`}
        >
          Baixar relatório PDF
        </PdfButton>
      )}
      <p>
        Documentos gerenciais. Os valores de anúncios são brutos; os repasses
        registram a confirmação manual do administrador. Não são notas fiscais
        nem comprovantes bancários.
      </p>
    </section>
  );
}
