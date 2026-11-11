import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  moneyTransaction,
  reserveCoupon,
  creditPartner,
} from "../src/partners.js";
const databaseUrl = process.env.PORTAL_PARTNER_TEST_DATABASE_URL;
if (!databaseUrl)
  throw Error("Configure um banco PostgreSQL local isolado para os testes.");
const target = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.pathname !== "/portal_partner_test"
)
  throw Error("Banco de teste deve ser LOCAL e chamar portal_partner_test.");
const db = new PrismaClient({ datasourceUrl: databaseUrl }),
  prefix = "profile-test-" + randomUUID();
const secret = "local-profile-test-only-01234567890123456789",
  password = "local-test-password-12345";
let child, coupon, partner;
const users = {};
function cpf() {
  let n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (let end = 9; end < 11; end++) {
    const value =
      (n.reduce((sum, digit, index) => sum + digit * (end + 1 - index), 0) *
        10) %
      11;
    n.push(value === 10 ? 0 : value);
  }
  return n.join("");
}
const identity = () => ({
  name: "Pessoa de Teste",
  cpf: cpf(),
  phone: "63999999999",
  address: "Rua exclusiva de teste, 100, Palmas, TO",
});
async function request(
  path,
  { who = "admin", body, method = body ? "POST" : "GET", token } = {},
) {
  const bearer =
    token || (who ? jwt.sign({ sub: users[who].id }, secret) : null);
  const r = await fetch("http://127.0.0.1:3096/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, headers: r.headers, data: await r.json() };
}
async function newCoupon(code) {
  return db.coupon.create({
    data: {
      code,
      partnerId: partner.id,
      active: true,
      discountCents: 500,
      rewardCents: 500,
      holdDays: 7,
      plans: ["BASIC"],
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
}
before(async () => {
  const hash = await bcrypt.hash(password, 4);
  for (const name of ["admin", "owner", "blogger", "legacy"])
    users[name] = await db.user.create({
      data: {
        name: "Pessoa " + name,
        email: `${prefix}-${name}@example.com`,
        passwordHash: hash,
        role: name === "admin" ? "ADMIN" : "OWNER",
      },
    });
  partner = await db.partner.create({
    data: { userId: users.blogger.id, minWithdrawal: 500 },
  });
  coupon = await newCoupon(
    "P" + randomUUID().replaceAll("-", "").slice(0, 25).toUpperCase(),
  );
  child = spawn(
    process.execPath,
    [new URL("../src/server.js", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        JWT_SECRET: secret,
        NODE_ENV: "test",
        PORT: "3096",
        WEB_ORIGIN: "http://localhost:5173",
        COMMERCIAL_ENABLED: "true",
        SALE_COMMISSION_BPS: "600",
        RENT_COMMISSION_BPS: "10000",
        AD_PRICE_CENTS: "2990",
        FEATURED_PRICE_CENTS: "5990",
        MP_ACCESS_TOKEN: "local-only-no-payment-call",
        MP_COLLECTOR_ID: "42",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(Error(output || "startup timeout")),
      10000,
    );
    child.stdout.on("data", (b) => {
      output += b;
      if (output.includes("Portal API iniciada.")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (b) => (output += b));
    child.on("exit", () => {
      clearTimeout(timeout);
      reject(Error(output));
    });
  });
});
after(async () => {
  child?.kill();
  const ids = (
    await db.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    })
  ).map((u) => u.id);
  const partnerIds = (
    await db.partner.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    })
  ).map((p) => p.id);
  await db.audit.deleteMany({ where: { actorId: { in: ids } } });
  await db.affiliateEntry.deleteMany({
    where: { partnerId: { in: partnerIds } },
  });
  await db.partnerPayout.deleteMany({
    where: { partnerId: { in: partnerIds } },
  });
  await db.listing.deleteMany({ where: { ownerId: { in: ids } } });
  await db.coupon.deleteMany({ where: { partnerId: { in: partnerIds } } });
  await db.partner.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
test("cadastro real exige documentos/endereço, normaliza campos e nunca aceita promoção de papel", async () => {
  const info = identity(),
    email = `${prefix}-registered@example.com`;
  assert.equal(
    (
      await request("/auth/register", {
        who: null,
        body: { name: "Sem dados", email, password },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/auth/register", {
        who: null,
        body: { ...info, cpf: "11111111111", email, password },
      })
    ).status,
    400,
  );
  const result = await request("/auth/register", {
    who: null,
    body: {
      ...info,
      phone: "+55 (63) 99999-9999",
      email,
      password,
      role: "ADMIN",
    },
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.user.role, "OWNER");
  assert.equal(result.data.user.profileComplete, true);
  assert.equal(result.data.user.cpf, undefined);
  assert.equal(result.data.user.address, undefined);
  const saved = await db.user.findUnique({ where: { email } });
  assert.equal(saved.cpf, info.cpf);
  assert.equal(saved.phone, "63999999999");
  assert.equal(await bcrypt.compare(password, saved.passwordHash), true);
  assert.equal(
    (
      await request("/auth/register", {
        who: null,
        body: { ...info, email: `${prefix}-duplicate@example.com`, password },
      })
    ).status,
    409,
  );
  const me = await request("/me", { who: null, token: result.data.token });
  assert.equal(me.data.cpf, info.cpf);
  assert.equal(me.data.passwordHash, undefined);
  assert.equal(me.headers.get("cache-control"), "no-store");
});
test("conta antiga continua entrando sem CPF e pode completar o perfil", async () => {
  const result = await request("/auth/login", {
    who: null,
    body: { email: users.legacy.email, password },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.user.profileComplete, false);
  const info = identity();
  const updated = await request("/me", {
    token: result.data.token,
    method: "PUT",
    body: info,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.profileComplete, true);
  assert.equal(updated.data.name, info.name);
});
test("perfil só altera a própria conta, não expõe a senha e não aceita mudança de e-mail ou privilégios", async () => {
  assert.equal((await request("/me", { who: null })).status, 401);
  const info = identity();
  const result = await request("/me", {
    who: "owner",
    method: "PUT",
    body: {
      ...info,
      id: users.admin.id,
      role: "ADMIN",
      email: users.admin.email,
      passwordHash: "attacker",
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.role, "OWNER");
  assert.equal(result.data.email, users.owner.email);
  assert.equal(result.data.id, users.owner.id);
  assert.equal(result.data.passwordHash, undefined);
  assert.equal(
    (await db.user.findUnique({ where: { id: users.admin.id } })).name,
    users.admin.name,
  );
  const other = await request(`/me?userId=${users.owner.id}`, {
    who: "blogger",
  });
  assert.equal(other.data.id, users.blogger.id);
  assert.equal(other.data.cpf, null);
  const audit = JSON.stringify(
    await db.audit.findMany({ where: { actorId: users.owner.id } }),
  );
  assert.ok(!audit.includes(info.cpf));
  assert.ok(!audit.includes(info.address));
  assert.ok(!audit.includes(info.phone));
});
test("edição/exclusão de parceiros e cupons exige administrador", async () => {
  for (const [path, method, body] of [
    [`/admin/coupons/${coupon.id}`, "PUT", { active: false }],
    [`/admin/coupons/${coupon.id}`, "DELETE"],
    [`/admin/partners/${partner.id}`, "DELETE"],
    [
      `/admin/partners/${partner.id}`,
      "PUT",
      { active: false, minWithdrawal: 500 },
    ],
  ]) {
    assert.equal(
      (await request(path, { who: "owner", method, body })).status,
      403,
    );
    assert.equal(
      (await request(path, { who: null, method, body })).status,
      401,
    );
  }
});
test("editar parceiro atualiza nome e configurações sem expor documentos nas tabelas", async () => {
  const result = await request(`/admin/partners/${partner.id}`, {
    method: "PUT",
    body: { name: "João Parceiro", active: true, minWithdrawal: 1000 },
  });
  assert.equal(result.status, 200);
  const rows = await request("/admin/partners");
  const p = rows.data.partners.find((p) => p.id === partner.id);
  assert.equal(p.user.name, "João Parceiro");
  assert.equal(p.minWithdrawal, 1000);
  assert.equal(typeof p._count.coupons, "number");
  assert.equal(p.user.cpf, undefined);
  const previous = await db.user.findUnique({ where: { id: users.owner.id } });
  assert.ok(!JSON.stringify(rows.data).includes(previous.cpf));
});
test("edição de cupom versiona novas cotações e preserva preço/recompensa de anúncio anterior", async () => {
  const quote = (
    await request("/coupons/quote", {
      who: "owner",
      body: { code: coupon.code, plan: "BASIC" },
    })
  ).data;
  const ad = await moneyTransaction(db, async (tx) => {
    const promotion = await reserveCoupon(tx, {
      code: coupon.code,
      version: quote.version,
      basePrice: 2990,
      plan: "BASIC",
      userId: users.owner.id,
    });
    return tx.listing.create({
      data: {
        ...promotion,
        ownerId: users.owner.id,
        title: "Anúncio com preço preservado",
        description: "Imóvel de teste para validação das condições de cupom.",
        type: "HOUSE",
        purpose: "SALE",
        city: "Palmas",
        neighborhood: "Centro",
        privateAddress: "Privado",
        ownerPhone: "63999999999",
        price: 100000,
        area: 100,
        images: [],
        durationDays: 30,
        commissionBps: 600,
        termsVersion: "test",
        termsText: "test",
        acceptedAt: new Date(),
      },
    });
  });
  const edited = await request(`/admin/coupons/${coupon.id}`, {
    method: "PUT",
    body: {
      discountCents: 700,
      rewardCents: 300,
      holdDays: 10,
      expectedVersion: coupon.termsUpdatedAt.toISOString(),
    },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  const newQuote = (
    await request("/coupons/quote", {
      who: "owner",
      body: { code: coupon.code, plan: "BASIC" },
    })
  ).data;
  assert.equal(newQuote.finalPrice, 2290);
  assert.notEqual(newQuote.version, quote.version);
  await assert.rejects(
    () =>
      moneyTransaction(db, (tx) =>
        reserveCoupon(tx, {
          code: coupon.code,
          version: quote.version,
          basePrice: 2990,
          plan: "BASIC",
          userId: users.owner.id,
        }),
      ),
    (e) => e.status === 409,
  );
  const old = await db.listing.update({
    where: { id: ad.id },
    data: { paidAt: new Date(), paymentId: "local-" + randomUUID() },
  });
  assert.equal(old.adPrice, 2490);
  assert.equal(old.partnerReward, 500);
  assert.equal(old.partnerHoldDays, 7);
  await moneyTransaction(db, (tx) => creditPartner(tx, old, old.paymentId));
  const credit = await db.affiliateEntry.findUnique({
    where: { listingId_kind: { listingId: ad.id, kind: "CREDIT" } },
  });
  assert.equal(credit.amount, 500);
  assert.equal(
    credit.availableAt.getTime() - old.paidAt.getTime(),
    7 * 86400000,
  );
  assert.equal(
    (
      await request(`/admin/coupons/${coupon.id}`, {
        method: "PUT",
        body: { code: "RENAMED", expectedVersion: edited.data.termsUpdatedAt },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/admin/coupons/${coupon.id}`, {
        method: "PUT",
        body: { rewardCents: 200, expectedVersion: quote.version },
      })
    ).status,
    409,
  );
});
test("exclusão bloqueia histórico e remove cupom/parceria sem uso mantendo a conta", async () => {
  assert.equal(
    (await request(`/admin/coupons/${coupon.id}`, { method: "DELETE" })).status,
    409,
  );
  assert.equal(
    (await request(`/admin/partners/${partner.id}`, { method: "DELETE" }))
      .status,
    409,
  );
  const unused = await newCoupon(
    "U" + randomUUID().replaceAll("-", "").slice(0, 25).toUpperCase(),
  );
  assert.equal(
    (await request(`/admin/coupons/${unused.id}`, { method: "DELETE" })).status,
    200,
  );
  assert.equal(await db.coupon.findUnique({ where: { id: unused.id } }), null);
  const empty = await db.partner.create({
    data: { userId: users.legacy.id, minWithdrawal: 500 },
  });
  assert.equal(
    (await request(`/admin/partners/${empty.id}`, { method: "DELETE" })).status,
    200,
  );
  assert.ok(await db.user.findUnique({ where: { id: users.legacy.id } }));
});

test("administrador cria parceiro e conta PARTNER atomicamente com senha protegida", async () => {
  const input = {
    mode: "CREATE",
    ...identity(),
    email: `${prefix}-direct-partner@example.com`,
    password: "local-partner-password-123",
    minWithdrawal: 1000,
  };
  assert.equal(
    (await request("/admin/partners", { who: "owner", body: input })).status,
    403,
  );
  assert.equal(
    (await request("/admin/partners", { who: null, body: input })).status,
    401,
  );
  const result = await request("/admin/partners", { body: input });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.user.role, "PARTNER");
  assert.ok(!JSON.stringify(result.data).includes(input.password));
  assert.equal(result.data.user.cpf, undefined);
  const user = await db.user.findUnique({
    where: { email: input.email },
    include: { partner: true },
  });
  assert.equal(user.role, "PARTNER");
  assert.equal(user.partner.id, result.data.id);
  assert.equal(await bcrypt.compare(input.password, user.passwordHash), true);
  assert.notEqual(user.passwordHash, input.password);
  const audit = JSON.stringify(
    await db.audit.findMany({ where: { entityId: result.data.id } }),
  );
  assert.ok(!audit.includes(input.password));
  assert.ok(!audit.includes(input.cpf));
  const login = await request("/auth/login", {
    who: null,
    body: { email: input.email, password: input.password },
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, "PARTNER");
  assert.equal(login.data.user.partner.active, true);
  const token = login.data.token;
  const dashboard = await request("/partner/dashboard", { token });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.data.entries.length, 0);
  assert.equal((await request("/me", { token })).status, 200);
  for (const path of ["/admin/partners", "/admin/listings", "/owner/listings"])
    assert.equal((await request(path, { token })).status, 403);
  for (const path of [
    "/owner/listings",
    `/owner/listings/test/checkout`,
    `/owner/listings/test/sync-payment`,
    "/uploads",
  ])
    assert.equal((await request(path, { token, body: {} })).status, 403);
  assert.equal(
    (await request("/uploads/test", { token, method: "DELETE" })).status,
    403,
  );
  const fakeRoleToken = jwt.sign({ sub: user.id, role: "ADMIN" }, secret);
  assert.equal(
    (await request("/admin/partners", { token: fakeRoleToken })).status,
    403,
  );
});
test("criação não substitui senha de conta existente e conflito de CPF não deixa conta órfã", async () => {
  const existing = await db.user.findUnique({ where: { id: users.owner.id } });
  const input = {
    mode: "CREATE",
    ...identity(),
    email: existing.email,
    password: "different-password-12345",
    minWithdrawal: 1000,
  };
  assert.equal((await request("/admin/partners", { body: input })).status, 409);
  const unchanged = await db.user.findUnique({ where: { id: existing.id } });
  assert.equal(unchanged.passwordHash, existing.passwordHash);
  assert.equal(unchanged.role, existing.role);
  const email = `${prefix}-cpf-conflict@example.com`;
  assert.equal(
    (
      await request("/admin/partners", {
        body: { ...input, email, cpf: existing.cpf },
      })
    ).status,
    409,
  );
  assert.equal(await db.user.findUnique({ where: { email } }), null);
  assert.equal(
    (
      await request("/admin/partners", {
        body: {
          mode: "CREATE",
          email,
          password: "different-password-12345",
          minWithdrawal: 1000,
        },
      })
    ).status,
    400,
  );
});
test("vincular conta existente preserva senha, anúncios e permissões anteriores", async () => {
  const original = await db.user.findUnique({ where: { id: users.owner.id } });
  const result = await request("/admin/partners", {
    body: { mode: "EXISTING", email: original.email, minWithdrawal: 500 },
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.role, "OWNER");
  const user = await db.user.findUnique({ where: { id: original.id } });
  assert.equal(user.passwordHash, original.passwordHash);
  assert.equal(user.role, "OWNER");
  assert.equal(
    (await request("/owner/listings", { who: "owner" })).status,
    200,
  );
  assert.equal(
    (
      await request("/admin/partners", {
        body: {
          mode: "EXISTING",
          email: users.legacy.email,
          minWithdrawal: 500,
          password: "attempt-reset-password",
        },
      })
    ).status,
    400,
  );
});
