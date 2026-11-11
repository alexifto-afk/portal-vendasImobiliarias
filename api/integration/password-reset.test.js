import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import { z } from "zod";
import {
  issuePasswordReset,
  confirmPasswordReset,
  registerPasswordResetRoutes,
  resetEmailKey,
  resetMessage,
} from "../src/password-reset.js";
const connection = process.env.PORTAL_PARTNER_TEST_DATABASE_URL;
if (!connection)
  throw Error("Configure PostgreSQL local isolado para os testes.");
const location = new URL(connection);
if (
  !["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.pathname !== "/portal_partner_test"
)
  throw Error("Somente PostgreSQL local portal_partner_test é permitido.");
const db = new PrismaClient({ datasourceUrl: connection }),
  prefix = "reset-test-" + randomUUID();
const secret = "local-test-reset-secret-01234567890123456789",
  emails = new Set(),
  services = [];
const clock = new Date(),
  newer = (minutes) => new Date(clock.getTime() + minutes * 60000);
function email(suffix) {
  const value = `${prefix}-${suffix}@example.com`;
  emails.add(value);
  return value;
}
async function user(suffix, role = "OWNER") {
  return db.user.create({
    data: {
      name: "Pessoa de teste",
      email: email(suffix),
      passwordHash: await bcrypt.hash("old-test-password-123", 4),
      role,
    },
  });
}
const options = (code, now = clock) => ({ now, makeCode: () => code });
const confirmInput = (u, ticket, code, password = "new-test-password-123") => ({
  email: u.email || u,
  requestId: ticket.public.requestId,
  code,
  password,
});
async function appFor({ configured = true, fail = false } = {}) {
  const jobs = [],
    delivered = [],
    app = express();
  app.use(express.json());
  registerPasswordResetRoutes(app, {
    db,
    env: { JWT_SECRET: secret },
    wrap: (fn) => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(n),
    mailer: {
      configured,
      send: async (data) => {
        if (fail)
          throw Object.assign(Error("private-secret-error"), { status: 422 });
        delivered.push(data);
      },
    },
    dispatch: (job) => jobs.push(job),
  });
  app.use((e, q, r, n) =>
    r
      .status(e.status || (e instanceof z.ZodError ? 400 : 500))
      .json({ error: e.message }),
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  services.push(server);
  const request = async (path, body) => {
    const r = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/password-reset/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return { status: r.status, headers: r.headers, data: await r.json() };
  };
  return { request, delivered, jobs };
}
after(async () => {
  for (const server of services) server.close();
  const users = await db.user.findMany({
    where: { email: { startsWith: prefix } },
    select: { id: true },
  });
  await db.audit.deleteMany({
    where: {
      OR: [
        { actorId: { in: users.map((u) => u.id) } },
        {
          entityId: {
            in: (
              await db.passwordReset.findMany({
                where: {
                  id: { in: [...emails].map((e) => resetEmailKey(secret, e)) },
                },
                select: { challengeId: true },
              })
            ).map((r) => r.challengeId),
          },
        },
      ],
    },
  });
  await db.passwordReset.deleteMany({
    where: { id: { in: [...emails].map((e) => resetEmailKey(secret, e)) } },
  });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
});
test("código não fica em claro, vale uma vez e preserva papel, perfil e senha protegida", async () => {
  const u = await user("single", "PARTNER"),
    ticket = await issuePasswordReset(db, secret, u.email, options("000123"));
  const stored = await db.passwordReset.findUnique({
    where: { id: resetEmailKey(secret, u.email) },
  });
  assert.ok(!JSON.stringify(stored).includes(u.email));
  assert.notEqual(stored.codeHash, "000123");
  assert.equal(stored.expiresAt.getTime() - clock.getTime(), 600000);
  assert.equal(
    (
      await confirmPasswordReset(
        db,
        secret,
        confirmInput(u, ticket, "000123"),
        newer(1),
      )
    ).ok,
    true,
  );
  const updated = await db.user.findUnique({ where: { id: u.id } });
  assert.equal(updated.role, "PARTNER");
  assert.equal(updated.email, u.email);
  assert.equal(updated.authVersion, 1);
  assert.equal(
    await bcrypt.compare("new-test-password-123", updated.passwordHash),
    true,
  );
  await assert.rejects(
    () =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(u, ticket, "000123"),
        newer(2),
      ),
    (e) => e.status === 400,
  );
  const audit = JSON.stringify(
    await db.audit.findMany({ where: { actorId: u.id } }),
  );
  assert.ok(!audit.includes("000123"));
  assert.ok(!audit.includes("new-test-password"));
});
test("cinco tentativas incorretas persistem e invalidam o código correto", async () => {
  const u = await user("attempts"),
    ticket = await issuePasswordReset(db, secret, u.email, options("123456"));
  for (let n = 1; n <= 5; n++) {
    await assert.rejects(
      () =>
        confirmPasswordReset(
          db,
          secret,
          confirmInput(u, ticket, "111111"),
          newer(1),
        ),
      (e) => e.status === 400,
    );
    assert.equal(
      (
        await db.passwordReset.findUnique({
          where: { id: resetEmailKey(secret, u.email) },
        })
      ).attempts,
      n,
    );
  }
  await assert.rejects(
    () =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(u, ticket, "123456"),
        newer(2),
      ),
    (e) => e.status === 400,
  );
  assert.equal(
    (await db.user.findUnique({ where: { id: u.id } })).authVersion,
    0,
  );
});
test("expiração e reenvio invalidam códigos anteriores", async () => {
  const u = await user("expire"),
    first = await issuePasswordReset(db, secret, u.email, options("123456"));
  await assert.rejects(
    () =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(u, first, "123456"),
        newer(10),
      ),
    (e) => e.status === 400,
  );
  const second = await issuePasswordReset(
    db,
    secret,
    u.email,
    options("654321", newer(11)),
  );
  await assert.rejects(
    () =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(u, first, "123456"),
        newer(12),
      ),
    (e) => e.status === 400,
  );
  assert.equal(
    (
      await confirmPasswordReset(
        db,
        secret,
        confirmInput(u, second, "654321"),
        newer(12),
      )
    ).ok,
    true,
  );
});
test("espera entre envios e limite horário persistem por e-mail inclusive inexistente", async () => {
  for (const e of [(await user("limit")).email, email("unknown-limit")]) {
    const first = await issuePasswordReset(db, secret, e, options("123456"));
    const cooldown = await issuePasswordReset(
      db,
      secret,
      e,
      options("222222", new Date(clock.getTime() + 1000)),
    );
    assert.equal(cooldown.public.requestId, first.public.requestId);
    assert.equal(cooldown.delivery, null);
    assert.equal(cooldown.public.retryAfter, 59);
    for (let minute = 1; minute <= 4; minute++)
      await issuePasswordReset(db, secret, e, options("123456", newer(minute)));
    const blocked = await issuePasswordReset(
      db,
      secret,
      e,
      options("111111", newer(5)),
    );
    assert.equal(blocked.delivery, null);
    assert.equal(blocked.public.retryAfter, 3300);
    const renewed = await issuePasswordReset(
      db,
      secret,
      e,
      options("333333", newer(61)),
    );
    assert.notEqual(renewed.public.requestId, blocked.public.requestId);
    assert.equal(
      (
        await db.passwordReset.findUnique({
          where: { id: resetEmailKey(secret, e) },
        })
      ).requests,
      1,
    );
  }
});
test("código é vinculado ao e-mail e à versão de credenciais, sem aceitar e-mail antigo", async () => {
  const a = await user("bound-a"),
    b = await user("bound-b");
  const ticket = await issuePasswordReset(
    db,
    secret,
    a.email,
    options("123456"),
  );
  await assert.rejects(
    () =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(b, ticket, "123456"),
        newer(1),
      ),
    (e) => e.status === 400,
  );
  const changed = email("changed");
  await db.user.update({ where: { id: a.id }, data: { email: changed } });
  await assert.rejects(
    () =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(a, ticket, "123456"),
        newer(1),
      ),
    (e) => e.status === 400,
  );
  const fresh = await issuePasswordReset(
    db,
    secret,
    changed,
    options("654321", newer(2)),
  );
  await db.user.update({
    where: { id: a.id },
    data: { authVersion: { increment: 1 } },
  });
  await assert.rejects(
    () =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(changed, fresh, "654321"),
        newer(3),
      ),
    (e) => e.status === 400,
  );
});
test("confirmações concorrentes usam o código apenas uma vez", async () => {
  const u = await user("concurrent"),
    ticket = await issuePasswordReset(db, secret, u.email, options("123456"));
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      confirmPasswordReset(
        db,
        secret,
        confirmInput(u, ticket, "123456"),
        newer(1),
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.user.findUnique({ where: { id: u.id } })).authVersion,
    1,
  );
  assert.equal(
    await db.audit.count({
      where: { actorId: u.id, action: "PASSWORD_RESET_COMPLETED" },
    }),
    1,
  );
});
test("API tem resposta genérica, envia depois da resposta e nunca retorna código", async () => {
  const u = await user("http"),
    unknown = email("http-unknown"),
    app = await appFor();
  const known = await app.request("request", { email: u.email });
  const missing = await app.request("request", { email: unknown });
  assert.equal(known.status, 200);
  assert.equal(missing.status, 200);
  assert.deepEqual(
    Object.keys(known.data).sort(),
    Object.keys(missing.data).sort(),
  );
  assert.equal(known.data.message, resetMessage);
  assert.equal(missing.data.message, resetMessage);
  assert.equal(app.delivered.length, 0);
  assert.equal(known.headers.get("cache-control"), "no-store");
  for (const job of app.jobs) await job();
  assert.equal(app.delivered.length, 1);
  assert.equal(app.delivered[0].email, u.email);
  assert.deepEqual(Object.keys(known.data).sort(), [
    "message",
    "requestId",
    "retryAfter",
  ]);
  assert.equal(known.data.code, undefined);
  assert.equal(known.data.delivery, undefined);
  assert.ok(!JSON.stringify(known.data).includes(u.email));
  const reset = await app.request("confirm", {
    email: u.email,
    requestId: known.data.requestId,
    code: app.delivered[0].code,
    password: "new-http-password-123",
  });
  assert.equal(reset.status, 200);
  assert.deepEqual(reset.data.ok, true);
});
test("sem configuração e falha de entrega não revelam existência da conta", async () => {
  const u = await user("delivery-fail"),
    unavailable = await appFor({ configured: false });
  const a = await unavailable.request("request", { email: u.email }),
    b = await unavailable.request("request", {
      email: email("not-configured"),
    });
  assert.equal(a.status, 503);
  assert.deepEqual(a.data, b.data);
  const broken = await appFor({ fail: true });
  const response = await broken.request("request", { email: u.email });
  assert.equal(response.status, 200);
  assert.equal(response.data.message, resetMessage);
  for (const job of broken.jobs) await job();
  assert.equal(
    (
      await db.passwordReset.findUnique({
        where: { id: resetEmailKey(secret, u.email) },
      })
    ).codeHash,
    null,
  );
  const audit = JSON.stringify(
    await db.audit.findMany({ where: { entityId: response.data.requestId } }),
  );
  assert.ok(!audit.includes("private-secret-error"));
  assert.ok(!audit.includes(u.email));
});
test("requisições concorrentes compartilham cooldown e há limite por IP", async () => {
  const u = await user("request-concurrent");
  const results = await Promise.all(
    [1, 2].map(() =>
      issuePasswordReset(db, secret, u.email, options("123456")),
    ),
  );
  assert.equal(results.filter((r) => r.delivery).length, 1);
  assert.equal(results[0].public.requestId, results[1].public.requestId);
  const app = await appFor(),
    target = email("ip-limit");
  for (let n = 0; n < 10; n++)
    assert.equal((await app.request("request", { email: target })).status, 200);
  assert.equal((await app.request("request", { email: target })).status, 429);
});
