import { z } from "zod";
import { validCpf } from "./payment-payloads.js";
export function normalizeMobile(value) {
  let digits = String(value).replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}
export const profileSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo.").max(100),
  cpf: z
    .string()
    .max(20)
    .transform((s) => s.replace(/\D/g, ""))
    .refine(validCpf, "CPF inválido."),
  phone: z
    .string()
    .max(24)
    .transform(normalizeMobile)
    .refine(
      (s) => /^[1-9]{2}9\d{8}$/.test(s),
      "Informe um celular válido com DDD.",
    ),
  address: z.string().trim().min(10, "Informe o endereço completo.").max(300),
});
export const registrationSchema = profileSchema.extend({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
});
export function sessionUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    partner: u.partner || null,
    profileComplete: Boolean(u.cpf && u.phone && u.address),
  };
}
const privateFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  cpf: true,
  phone: true,
  address: true,
  partner: { select: { active: true } },
};
export function registerProfileRoutes(app, { db, auth, wrap, audit }) {
  app.get(
    "/api/me",
    auth,
    wrap(async (q, r) => {
      const user = await db.user.findUnique({
        where: { id: q.user.id },
        select: privateFields,
      });
      r.set("Cache-Control", "no-store").json({
        ...user,
        profileComplete: Boolean(user.cpf && user.phone && user.address),
      });
    }),
  );
  app.put(
    "/api/me",
    auth,
    wrap(async (q, r) => {
      const input = profileSchema.parse(q.body);
      const user = await db.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: q.user.id },
          data: input,
          select: privateFields,
        });
        // Do not put CPF, address or phone in the general admin audit log.
        await audit(tx, q.user.id, "PROFILE_UPDATED", q.user.id);
        return updated;
      });
      r.set("Cache-Control", "no-store").json({
        ...user,
        profileComplete: true,
      });
    }),
  );
}
