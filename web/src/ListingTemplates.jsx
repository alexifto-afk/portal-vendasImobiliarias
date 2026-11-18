import React, { useState } from "react";
import Dialog from "./Dialog.jsx";
import { typeNames } from "./classified-catalog.js";
import { listingTemplate } from "./listing-templates.js";
export default function ListingTemplates({ values, onApply }) {
  const [field, setField] = useState(null);
  const fields = field === "both" ? ["title", "description"] : [field];
  const labels = {
    title: "título",
    description: "descrição",
    both: "título e descrição",
  };
  const model = listingTemplate(values);
  const replacing = fields.filter((key) => key && values[key]?.trim());
  return (
    <section
      className="listing-templates"
      aria-label="Modelos para escrever o anúncio"
    >
      <h4>Uma ajuda para destacar seu anúncio</h4>
      <p>
        Use um esqueleto de texto para {typeNames[values.type] || "seu produto"}{" "}
        e personalize com informações reais. Troque todos os trechos{" "}
        <strong>[preencha: …]</strong> antes de continuar.
      </p>
      <div className="template-actions">
        <button
          className="outline small"
          type="button"
          onClick={() => setField("title")}
        >
          Modelo de título
        </button>
        <button
          className="outline small"
          type="button"
          onClick={() => setField("description")}
        >
          Modelo de descrição
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => setField("both")}
        >
          Ver os dois modelos
        </button>
      </div>
      {field && (
        <Dialog
          portal
          title={`Modelo de ${labels[field]}`}
          onClose={() => setField(null)}
          className="listing-template-dialog"
        >
          <p>
            {typeNames[values.type]} ·{" "}
            {values.purpose === "RENT" ? "Aluguel" : "Venda"}
          </p>
          {fields.includes("title") && (
            <>
              <h3>Sugestão de título</h3>
              <p className="template-title-preview">{model.title}</p>
            </>
          )}
          {fields.includes("description") && (
            <>
              <h3>Sugestão de descrição</h3>
              <pre
                className="template-description-preview"
                tabIndex={0}
                role="region"
                aria-label="Modelo completo de descrição"
              >
                {model.description}
              </pre>
            </>
          )}
          {replacing.length > 0 && (
            <p className="notice" role="status">
              Você já escreveu {replacing.map((key) => labels[key]).join(" e ")}
              . Ao aplicar, somente{" "}
              {replacing.length > 1
                ? "esses campos serão substituídos"
                : "esse campo será substituído"}{" "}
              pelo modelo. Cancele para manter seu texto.
            </p>
          )}
          <p className="form-help">
            Depois de aplicar, edite livremente no formulário. O modelo não
            comprova características, documentação ou condições do item.
          </p>
          <div className="wizard-actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                onApply(
                  Object.fromEntries(fields.map((key) => [key, model[key]])),
                );
                setField(null);
              }}
            >
              {replacing.length
                ? `Substituir ${labels[field]} pelo modelo`
                : `Aplicar modelo de ${labels[field]}`}
            </button>
            <button
              className="outline"
              type="button"
              onClick={() => setField(null)}
            >
              Cancelar e manter meu texto
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
