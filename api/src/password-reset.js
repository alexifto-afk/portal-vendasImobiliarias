import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { moneyTransaction } from "./partners.js";
import { createResetMailer } from "./reset-mailer.js";
export const resetEmail = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const requestSchema = z.object({ email: resetEmail }).strict();
const confirmSchema = z
  .object({
    email: resetEmail,
    requestId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
    password: z.string().min(12).max(128),
  })
  .strict();
const MINUTE = 60000,
  HOUR = 60 * MINUTE;
export const resetMessage =
  "Se este e-mail estiver cadastrado, você receberá um código de recuperação. Confira também a pasta de spam.";
const invalidCode =
  "Código inválido, expirado ou já utilizado. Confira o código mais recente ou solicite outro.";
const digest = (secret, value) =>
  createHmac("sha256", secret).update(value).digest("hex");
export const resetEmailKey = (secret, email) =>
  digest(secret, "reset-email-v1:" + email);
export function resetCodeHash(secret, requestId, code) {
  return digest(secret, "reset-code-v1:" + requestId + ":" + code);
}
function equalHash(a, b) {
  return (
    typeof a === "string" &&
    /^[a-f0-9]{64}$/.test(a) &&
    timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
  );
}
export async function issuePasswordReset(
  db,
  secret,
  rawEmail,
  {
    now = new Date(),
    makeCode = () => String(randomInt(0, 1000000)).padStart(6, "0"),
  } = {},
) {
  const email = resetEmail.parse(rawEmail),
    id = resetEmailKey(secret, email);
  return moneyTransaction(db, async (tx) => {
    const previous = await tx.passwordReset.findUnique({ where: { id } });
    const inWindow =
      previous && now.getTime() - previous.windowStartedAt.getTime() < HOUR;
    const cooldown = previous
      ? Math.ceil(
          (previous.requestedAt.getTime() + MINUTE - now.getTime()) / 1000,
        )
      : 0;
    if ((inWindow && previous.requests >= 5) || cooldown > 0) {
      const retryAfter =
        inWindow && previous.requests >= 5
          ? Math.max(
              1,
              Math.ceil(
                (previous.windowStartedAt.getTime() + HOUR - now.getTime()) /
                  1000,
              ),
            )
          : cooldown;
      return {
        public: {
          message: resetMessage,
          requestId: previous.challengeId,
          retryAfter,
        },
        delivery: null,
      };
    }
    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true, authVersion: true },
    });
    const requestId = randomUUID(),
      code = makeCode();
    if (!/^\d{6}$/.test(code)) throw Error("Gerador de código inválido.");
    const values = {
      challengeId: requestId,
      userId: user?.id || null,
      credentialVersion: user?.authVersion || 0,
      codeHash: resetCodeHash(secret, requestId, code),
      requestedAt: now,
      expiresAt: new Date(now.getTime() + 10 * MINUTE),
      attempts: 0,
      windowStartedAt: inWindow ? previous.windowStartedAt : now,
      requests: inWindow ? previous.requests + 1 : 1,
    };
    await tx.passwordReset.upsert({
      where: { id },
      create: { id, ...values },
      update: values,
    });
    return {
      public: { message: resetMessage, requestId, retryAfter: 60 },
      delivery: user ? { email, code, requestId } : null,
    };
  });
}
export async function confirmPasswordReset(
  db,
  secret,
  rawInput,
  now = new Date(),
) {
  const input = confirmSchema.parse(rawInput),
    id = resetEmailKey(secret, input.email);
  const success = await moneyTransaction(db, async (tx) => {
    const record = await tx.passwordReset.findUnique({ where: { id } });
    if (
      !record ||
      record.challengeId !== input.requestId ||
      !record.codeHash ||
      record.expiresAt <= now ||
      record.attempts >= 5
    )
      return false;
    const user = record.userId
      ? await tx.user.findUnique({
          where: { id: record.userId },
          select: { id: true, email: true, authVersion: true },
        })
      : null;
    if (
      !equalHash(
        record.codeHash,
        resetCodeHash(secret, input.requestId, input.code),
      ) ||
      !user ||
      user.email !== input.email ||
      user.authVersion !== record.credentialVersion
    ) {
      const attempts = record.attempts + 1;
      // Return a result instead of throwing inside the transaction: failed tries
      // must commit, including invalidation at the fifth attempt.
      await tx.passwordReset.update({
        where: { id },
        data: { attempts, ...(attempts >= 5 ? { codeHash: null } : {}) },
      });
      return false;
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    await tx.passwordReset.updateMany({
      where: { userId: user.id },
      data: { codeHash: null, expiresAt: now },
    });
    await tx.audit.create({
      data: {
        actorId: user.id,
        action: "PASSWORD_RESET_COMPLETED",
        entityId: user.id,
        detail: "",
      },
    });
    return true;
  });
  if (!success) throw Object.assign(Error(invalidCode), { status: 400 });
  return {
    ok: true,
    message: "Senha alterada. Entre novamente com sua nova senha.",
  };
}
export function registerPasswordResetRoutes(
  app,
  {
    db,
    wrap,
    env,
    mailer = createResetMailer(env),
    dispatch = (job) => {
      void job().catch(() =>
        console.error("Falha ao processar envio de recuperação."),
      );
    },
  },
) {
  const requestLimit = rateLimit({
    windowMs: 15 * MINUTE,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error:
        "Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.",
    },
  });
  const confirmLimit = rateLimit({
    windowMs: 15 * MINUTE,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas tentativas. Aguarde antes de tentar novamente." },
  });
  app.post(
    "/api/auth/password-reset/request",
    requestLimit,
    wrap(async (q, r) => {
      const { email } = requestSchema.parse(q.body);
      if (!mailer.configured)
        throw Object.assign(
          Error(
            "A recuperação por e-mail está temporariamente indisponível. Fale com o atendimento.",
          ),
          { status: 503 },
        );
      const ticket = await issuePasswordReset(db, env.JWT_SECRET, email);
      // Only the public envelope reaches the browser. Dispatch after flushing the
      // response so provider timing/failures never reveal whether a user exists.
      r.once("finish", () =>
        dispatch(async () => {
          if (!ticket.delivery) return;
          let action = "PASSWORD_RESET_EMAIL_ACCEPTED",
            status = "";
          try {
            await mailer.send(ticket.delivery);
          } catch (e) {
            action = "PASSWORD_RESET_EMAIL_FAILED";
            status =
              Number.isInteger(e?.status) && e.status >= 400 && e.status <= 599
                ? String(e.status)
                : "network";
            console.error("Falha no envio do código de recuperação", status);
            await db.passwordReset.updateMany({
              where: { challengeId: ticket.delivery.requestId },
              data: { codeHash: null },
            });
          }
          await db.audit.create({
            data: {
              actorId: "password-reset",
              action,
              entityId: ticket.delivery.requestId,
              detail: status,
            },
          });
        }),
      );
      // Retain throttles for one day; no raw e-mail or code is stored in this table.
      void db.passwordReset
        .deleteMany({
          where: { windowStartedAt: { lt: new Date(Date.now() - 24 * HOUR) } },
        })
        .catch(() =>
          console.error("Falha na limpeza de recuperações antigas."),
        );
      r.set("Cache-Control", "no-store").json(ticket.public);
    }),
  );
  app.post(
    "/api/auth/password-reset/confirm",
    confirmLimit,
    wrap(async (q, r) => {
      r.set("Cache-Control", "no-store").json(
        await confirmPasswordReset(db, env.JWT_SECRET, q.body),
      );
    }),
  );
}
