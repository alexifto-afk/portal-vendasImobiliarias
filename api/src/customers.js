import { z } from "zod";
import { profileSchema } from "./user-profile.js";
import { moneyTransaction } from "./partners.js";
const fail = (status, message) => Object.assign(Error(message), { status });
const baseFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  partner: { select: { id: true, active: true } },
  _count: { select: { listings: true, uploads: true } },
};
const customerEdit = z
  .object({
    name: profileSchema.shape.name,
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    cpf: profileSchema.shape.cpf.nullable(),
    phone: profileSchema.shape.phone.nullable(),
    address: profileSchema.shape.address.nullable(),
    confirmEmailChange: z.boolean().optional(),
  })
  .strict();
async function customer(db, id) {
  const user = await db.user.findUnique({ where: { id }, select: baseFields });
  if (!user) throw fail(404, "Cliente não encontrado.");
  if (!["OWNER", "PARTNER"].includes(user.role))
    throw fail(403, "Contas administrativas não são gerenciadas nesta área.");
  return user;
}
function deletionBlock(user) {
  if (user._count.listings)
    return "Este cliente possui anúncios ou histórico de contratação. A conta deve ser preservada.";
  if (user.partner)
    return "Este cliente possui vínculo de parceiro. Gerencie a parceria antes de excluir a conta.";
  return null;
}
export function registerCustomerRoutes(app, { db, auth, admin, wrap, audit }) {
  app.get(
    "/api/admin/customers",
    auth,
    admin,
    wrap(async (_q, r) => {
      const users = await db.user.findMany({
        where: { role: { in: ["OWNER", "PARTNER"] } },
        select: baseFields,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
      r.set("Cache-Control", "no-store").json(
        users.map((u) => ({ ...u, deletionBlock: deletionBlock(u) })),
      );
    }),
  );
  app.get(
    "/api/admin/customers/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      const user = await customer(db, q.params.id);
      const details = await db.user.findUnique({
        where: { id: user.id },
        select: {
          ...baseFields,
          cpf: true,
          address: true,
          listings: {
            select: {
              id: true,
              title: true,
              status: true,
              adPrice: true,
              paidAt: true,
              affiliateVoidedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });
      if (!details) throw fail(404, "Cliente não encontrado.");
      r.set("Cache-Control", "no-store").json({
        ...details,
        deletionBlock: deletionBlock(details),
      });
    }),
  );
  app.put(
    "/api/admin/customers/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      const { confirmEmailChange, ...data } = customerEdit.parse(q.body);
      const updated = await moneyTransaction(db, async (tx) => {
        const user = await customer(tx, q.params.id);
        if (user.email !== data.email && !confirmEmailChange)
          throw fail(
            400,
            "Confirme a alteração do e-mail de acesso do cliente.",
          );
        const result = await tx.user.update({
          where: { id: user.id },
          data,
          select: baseFields,
        });
        await audit(
          tx,
          q.user.id,
          "CUSTOMER_UPDATED",
          user.id,
          "Dados de cadastro atualizados",
        );
        return result;
      });
      r.set("Cache-Control", "no-store").json({
        ...updated,
        deletionBlock: deletionBlock(updated),
      });
    }),
  );
  app.delete(
    "/api/admin/customers/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      await moneyTransaction(db, async (tx) => {
        const user = await customer(tx, q.params.id);
        const reason = deletionBlock(user);
        if (reason) throw fail(409, reason);
        // With no listings or partner, there is no contractual/affiliate history.
        // The existing FK cascade removes only this user's unused photo drafts.
        await tx.user.delete({ where: { id: user.id } });
        await audit(tx, q.user.id, "CUSTOMER_DELETED", user.id);
      });
      r.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/customers/:id/partner",
    auth,
    admin,
    wrap(async (q, r) => {
      const input = z
        .object({
          minWithdrawal: z.number().int().min(1).max(100000000),
          keepOwnerAccess: z.boolean(),
        })
        .strict()
        .parse(q.body);
      const result = await moneyTransaction(db, async (tx) => {
        const user = await customer(tx, q.params.id);
        if (user.partner)
          throw fail(
            409,
            "Este cliente já é parceiro. Atualize a tabela para consultar o vínculo.",
          );
        if (
          !input.keepOwnerAccess &&
          (user._count.listings || user._count.uploads)
        )
          throw fail(
            409,
            "O cliente possui anúncios ou fotos em rascunho. Mantenha também o acesso de cliente para preservar o atendimento.",
          );
        if (user.role === "PARTNER" && input.keepOwnerAccess)
          throw fail(
            400,
            "Esta conta já possui nível Parceiro. Vincule sem conceder acesso de cliente.",
          );
        const partner = await tx.partner.create({
          data: { userId: user.id, minWithdrawal: input.minWithdrawal },
        });
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { role: input.keepOwnerAccess ? "OWNER" : "PARTNER" },
          select: baseFields,
        });
        await audit(
          tx,
          q.user.id,
          "CUSTOMER_BECAME_PARTNER",
          user.id,
          input.keepOwnerAccess
            ? "Acesso de cliente preservado"
            : "Nível Parceiro",
        );
        return {
          user: updated,
          partner: { id: partner.id, active: partner.active },
        };
      });
      r.status(201).set("Cache-Control", "no-store").json(result);
    }),
  );
}
