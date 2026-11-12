import PDFDocument from "pdfkit";
import { z } from "zod";
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida.");
export function reportPeriod(input) {
  const parsed = z.object({ from: dateOnly, to: dateOnly }).parse(input);
  const start = new Date(parsed.from + "T00:00:00-03:00");
  const end = new Date(parsed.to + "T00:00:00-03:00");
  end.setUTCDate(end.getUTCDate() + 1);
  if (end <= start || end - start > 366 * 86400000)
    fail(
      400,
      "Selecione um período de até 366 dias, com início anterior ao fim.",
    );
  return { gte: start, lt: end };
}
const money = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const clean = (value) =>
  String(value ?? "Não informado")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .slice(0, 1200);
export function makePdf(title, sections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
      info: { Title: title, Author: "Negocieê" },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#5845F5")
      .text("Negocieê");
    doc.fontSize(16).fillColor("#202030").text(title);
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`Emitido em ${date(new Date())} (Brasília)`);
    doc.moveDown();
    for (const section of sections) {
      if (doc.y > 690) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(11).text(clean(section.title));
      doc.font("Helvetica").fontSize(10);
      for (const line of section.lines)
        doc.text(clean(line), { paragraphGap: 4 });
      doc.moveDown();
    }
    doc
      .fontSize(9)
      .text(
        "Documento gerencial do portal. Não é nota fiscal nem comprovante bancário.",
      );
    doc.end();
  });
}
function fail(status, message) {
  throw Object.assign(Error(message), { status });
}
async function send(response, filename, title, sections) {
  const buffer = await makePdf(title, sections);
  response.set("Cache-Control", "private, no-store");
  response.type("application/pdf").attachment(filename).send(buffer);
}
export function registerReportingRoutes(app, { db, auth, admin, wrap }) {
  app.get(
    "/api/receipts/listings/:id",
    auth,
    wrap(async (q, r) => {
      const l = await db.listing.findUnique({
        where: { id: q.params.id },
        include: { owner: { select: { name: true } } },
      });
      if (!l || (q.user.role !== "ADMIN" && l.ownerId !== q.user.id))
        fail(404, "Recibo não encontrado.");
      if (!l.paidAt || l.affiliateVoidedAt)
        fail(409, "O recibo exige pagamento confirmado e não estornado.");
      await send(
        r,
        `recibo-anuncio-${l.id}.pdf`,
        "Recibo de pagamento de anúncio",
        [
          {
            title: "Contratação de divulgação",
            lines: [
              `Recibo / anúncio: ${l.id}`,
              `Anunciante: ${l.owner.name}`,
              `Anúncio: ${l.title}`,
              `Pagamento confirmado em: ${date(l.paidAt)}`,
              `Valor pago pela divulgação: ${money(l.adPrice)}`,
              `Plano: ${l.plan} | Duração: ${l.durationDays} dias`,
              `Cupom: ${l.couponCode || "Sem cupom"}`,
              `Referência do pagamento: ${l.paymentId || "Não registrada"}`,
              "Este valor corresponde à divulgação, não à compra ou ao aluguel do bem anunciado.",
            ],
          },
        ],
      );
    }),
  );
  app.get(
    "/api/receipts/payouts/:id",
    auth,
    wrap(async (q, r) => {
      const p = await db.partnerPayout.findUnique({
        where: { id: q.params.id },
        include: { partner: { select: { userId: true } } },
      });
      if (!p || (q.user.role !== "ADMIN" && p.partner.userId !== q.user.id))
        fail(404, "Recibo não encontrado.");
      if (p.status !== "PAID")
        fail(409, "O repasse ainda não foi confirmado pelo administrador.");
      await send(
        r,
        `recibo-repasse-${p.id}.pdf`,
        "Recibo de repasse ao parceiro",
        [
          {
            title: "Registro de repasse confirmado pelo administrador",
            lines: [
              `Protocolo: ${p.id}`,
              `Beneficiário: ${p.recipientName}`,
              `Valor: ${money(p.amount)}`,
              `Confirmação: ${p.resolvedAt ? date(p.resolvedAt) : "Não registrada"}`,
              `Referência informada: ${p.receiptReference || "Não registrada"}`,
              "Transferência realizada fora do portal. Este documento registra a confirmação administrativa e não substitui o comprovante Pix do banco.",
            ],
          },
        ],
      );
    }),
  );
  app.get(
    "/api/admin/reports/:kind",
    auth,
    admin,
    wrap(async (q, r) => {
      const kind = z
          .enum(["payments", "payouts", "credits"])
          .parse(q.params.kind),
        period = reportPeriod(q.query);
      const options = { take: 10001, orderBy: { id: "asc" } };
      let rows, title, sections;
      if (kind === "payments") {
        rows = await db.listing.findMany({
          ...options,
          where: { paidAt: period },
          include: { owner: { select: { name: true } } },
        });
        checkLimit(rows);
        title = "Relatório de pagamentos de anúncios";
        sections = rows.map((l) => ({
          title: l.title,
          lines: [
            `Anúncio: ${l.id} | Anunciante: ${l.owner.name}`,
            `${date(l.paidAt)} | ${money(l.adPrice)} | ${l.affiliateVoidedAt ? "ESTORNADO" : "Confirmado"}${l.deletedAt ? " | Anúncio excluído" : ""}`,
            `Cupom: ${l.couponCode || "Sem cupom"}`,
          ],
        }));
        sections.unshift({
          title: "Resumo",
          lines: [
            `Pagamentos no período: ${rows.length}`,
            `Valor bruto sem estornos registrados: ${money(rows.filter((l) => !l.affiliateVoidedAt).reduce((sum, l) => sum + l.adPrice, 0))}`,
            `Valor com estorno registrado: ${money(rows.filter((l) => l.affiliateVoidedAt).reduce((sum, l) => sum + l.adPrice, 0))}`,
            "Inclui renovações e anúncios excluídos pagos no período. Estornos refletem o estado atual dos pagamentos, não a data do estorno. Não desconta tarifas nem representa saldo bancário.",
          ],
        });
      } else if (kind === "payouts") {
        rows = await db.partnerPayout.findMany({
          ...options,
          where: { status: "PAID", resolvedAt: period },
        });
        checkLimit(rows);
        title = "Relatório de repasses confirmados";
        sections = rows.map((p) => ({
          title: p.recipientName,
          lines: [
            `Protocolo: ${p.id}`,
            `${date(p.resolvedAt)} | ${money(p.amount)}`,
            `Referência: ${p.receiptReference || "Não registrada"}`,
          ],
        }));
        sections.unshift({
          title: "Resumo",
          lines: [
            `Repasses confirmados: ${rows.length} | Total: ${money(rows.reduce((sum, p) => sum + p.amount, 0))}`,
            "Pagamentos externos registrados pelo administrador. Período pela data de confirmação.",
          ],
        });
      } else {
        rows = await db.affiliateEntry.findMany({
          ...options,
          where: { createdAt: period },
          include: {
            partner: { include: { user: { select: { name: true } } } },
          },
        });
        checkLimit(rows);
        title = "Relatório de créditos dos parceiros";
        sections = rows.map((e) => ({
          title: e.partner.user.name,
          lines: [
            `Lançamento: ${e.id} | Anúncio: ${e.listingId}`,
            `${date(e.createdAt)} | ${e.kind === "CREDIT" ? "Crédito" : "Reversão"} | ${money(e.amount)}`,
            `Liberação: ${date(e.availableAt)}`,
          ],
        }));
        sections.unshift({
          title: "Resumo",
          lines: [
            `Lançamentos: ${rows.length} | Movimento líquido: ${money(rows.reduce((sum, e) => sum + e.amount, 0))}`,
            "Movimentação no período, incluindo reversões. Não representa saldo disponível para saque.",
          ],
        });
      }
      sections.unshift({
        title: "Período",
        lines: [
          `De ${q.query.from} a ${q.query.to}, inclusive, no horário de Brasília.`,
        ],
      });
      await send(
        r,
        `relatorio-${kind}-${q.query.from}-${q.query.to}.pdf`,
        title,
        sections,
      );
    }),
  );
}
function checkLimit(rows) {
  if (rows.length > 10000)
    fail(
      422,
      "O período ultrapassa 10.000 registros. Reduza o intervalo para baixar o relatório completo.",
    );
}
