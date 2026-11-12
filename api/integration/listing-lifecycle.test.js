import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { creditPartner, moneyTransaction } from "../src/partners.js";
const databaseUrl = process.env.PORTAL_PARTNER_TEST_DATABASE_URL;
if (!databaseUrl)
  throw Error("Configure PORTAL_PARTNER_TEST_DATABASE_URL local isolado.");
const target = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.pathname !== "/portal_partner_test"
)
  throw Error("A integração exige banco LOCAL portal_partner_test.");
const db = new PrismaClient({ datasourceUrl: databaseUrl }),
  prefix = "lifecycle-" + randomUUID(),
  secret = "lifecycle-test-only-0123456789012345678901234567",
  root = "http://127.0.0.1:3106/api";
let child,
  owner,
  other,
  admin,
  partnerUser,
  partner,
  coupon,
  source,
  photo,
  newPhoto,
  renewed,
  config;
const token = (u) => jwt.sign({ sub: u.id }, secret);
async function req(path, body, user = owner, method = body ? "POST" : "GET") {
  const r = await fetch(root + path, {
    method,
    headers: {
      ...(user ? { Authorization: "Bearer " + token(user) } : {}),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
const photoStatus = async (id, user = null) =>
  (
    await fetch(root + "/uploads/" + id, {
      headers: user ? { Authorization: "Bearer " + token(user) } : {},
    })
  ).status;
before(async () => {
  const create = (role) =>
    db.user.create({
      data: {
        name: "Teste ciclo " + role,
        email: prefix + "-" + role + "@example.com",
        passwordHash: "not-for-login",
        role: role === "OTHER" ? "OWNER" : role,
      },
    });
  owner = await create("OWNER");
  other = await create("OTHER");
  admin = await create("ADMIN");
  partnerUser = await create("PARTNER");
  partner = await db.partner.create({
    data: { userId: partnerUser.id, minWithdrawal: 500 },
  });
  coupon = await db.coupon.create({
    data: {
      code: "LC" + randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase(),
      partnerId: partner.id,
      discountCents: 500,
      rewardCents: 500,
      holdDays: 0,
      plans: ["BASIC", "FEATURED"],
      expiresAt: new Date(Date.now() + 86400000),
      reservations: 1,
    },
  });
  source = await db.listing.create({
    data: {
      ownerId: owner.id,
      title: "Casa do ciclo de testes",
      description:
        "Descrição suficientemente detalhada da casa para a integração.",
      type: "HOUSE",
      category: "REAL_ESTATE",
      purpose: "SALE",
      city: "Palmas",
      state: "TO",
      neighborhood: "Centro",
      privateAddress: "Endereço privado original",
      ownerPhone: "63999999999",
      contactMode: "DIRECT",
      price: 15000000,
      area: 120,
      bedrooms: 2,
      images: [],
      status: "PUBLISHED",
      reviewed: true,
      paidAt: new Date(Date.now() - 86400000),
      expiresAt: new Date(Date.now() + 3 * 86400000),
      adPrice: 2490,
      originalAdPrice: 2990,
      plan: "BASIC",
      durationDays: 30,
      commissionBps: 0,
      termsVersion: "2026-11-classifieds-original",
      termsText: "Contrato original preservado",
      acceptedAt: new Date(),
      paymentId: prefix + "-original",
      couponId: coupon.id,
      couponCode: coupon.code,
      partnerReward: 500,
      partnerHoldDays: 0,
    },
  });
  photo = await db.imageUpload.create({
    data: {
      id: randomUUID(),
      ownerId: owner.id,
      listingId: source.id,
      data: Buffer.from("webp-fixture"),
      mimeType: "image/webp",
    },
  });
  newPhoto = await db.imageUpload.create({
    data: {
      id: randomUUID(),
      ownerId: owner.id,
      data: Buffer.from("webp-fixture-2"),
      mimeType: "image/webp",
    },
  });
  source = await db.listing.update({
    where: { id: source.id },
    data: { images: ["/uploads/" + photo.id] },
  });
  await moneyTransaction(db, (tx) =>
    creditPartner(tx, source, source.paymentId),
  );
  child = spawn(
    process.execPath,
    [new URL("../src/server.js", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PORT: "3106",
        JWT_SECRET: secret,
        WEB_ORIGIN: "https://negociee.example",
        NODE_ENV: "test",
        COMMERCIAL_ENABLED: "true",
        MP_ACCESS_TOKEN: "unused-no-network",
        MP_COLLECTOR_ID: "42",
        AD_PRICE_CENTS: "2990",
        FEATURED_PRICE_CENTS: "5990",
        AD_DURATION_DAYS: "30",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(
      () => reject(Error(out || "startup timeout")),
      10000,
    );
    child.stdout.on("data", (b) => {
      out += b;
      if (out.includes("Portal API iniciada.")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", (b) => (out += b));
    child.on("exit", () => {
      clearTimeout(timer);
      reject(Error(out));
    });
  });
  config = (await req("/config")).data;
});
after(async () => {
  child?.kill();
  const userIds = [owner, other, admin, partnerUser]
    .filter(Boolean)
    .map((u) => u.id);
  await db.audit.deleteMany({ where: { actorId: { in: userIds } } });
  if (partner) {
    await db.affiliateEntry.deleteMany({ where: { partnerId: partner.id } });
    await db.partnerPayout.deleteMany({ where: { partnerId: partner.id } });
  }
  await db.imageUpload.deleteMany({ where: { ownerId: { in: userIds } } });
  await db.listing.deleteMany({ where: { ownerId: { in: userIds } } });
  if (partner) {
    await db.coupon.deleteMany({ where: { partnerId: partner.id } });
    await db.partner.delete({ where: { id: partner.id } });
  }
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
function editBody(l = source) {
  return {
    revision: l.revision,
    type: l.type,
    purpose: l.purpose,
    plan: l.plan,
    title: "Casa com descrição editada",
    description:
      "Descrição nova, completa e detalhada da casa que está anunciada.",
    price: 16000000,
    area: l.area,
    bedrooms: l.bedrooms,
    city: l.city,
    state: l.state,
    neighborhood: l.neighborhood,
    ownerPhone: l.ownerPhone,
    contactAccepted: true,
    images: ["/uploads/" + newPhoto.id],
  };
}
test("edição protege dono e histórico, retira anúncio para revisão e não estende o prazo", async () => {
  assert.equal(
    (await req("/owner/listings/" + source.id, editBody(), other, "PUT"))
      .status,
    403,
  );
  const result = await req(
    "/owner/listings/" + source.id,
    {
      ...editBody(),
      adPrice: 1,
      expiresAt: "2099-01-01",
      partnerReward: 999999,
      commissionBps: 9999,
    },
    owner,
    "PUT",
  );
  assert.equal(result.status, 200, JSON.stringify(result));
  const l = result.data;
  assert.equal(l.revision, 1);
  assert.equal(l.status, "PENDING");
  assert.equal(l.reviewed, false);
  for (const key of [
    "adPrice",
    "partnerReward",
    "paymentId",
    "termsText",
    "termsVersion",
    "couponId",
  ])
    assert.equal(l[key], source[key]);
  assert.equal(new Date(l.expiresAt).getTime(), source.expiresAt.getTime());
  assert.equal((await req("/listings/" + source.id, null, null)).status, 404);
  assert.equal(await photoStatus(newPhoto.id), 404);
  assert.equal(
    await db.affiliateEntry.count({ where: { listingId: source.id } }),
    1,
  );
  assert.equal(
    (await req("/owner/listings/" + source.id, editBody(), owner, "PUT"))
      .status,
    409,
  );
  assert.equal(
    (
      await req(
        "/admin/listings/" + source.id + "/review",
        { approve: true, revision: 0 },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        "/admin/listings/" + source.id + "/review",
        { approve: true, revision: 1 },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(await photoStatus(newPhoto.id), 200);
  assert.equal(await photoStatus(photo.id), 404);
  source = await db.listing.findUnique({ where: { id: source.id } });
  assert.equal(source.expiresAt.getTime(), new Date(l.expiresAt).getTime());
});
test("foto de outra conta não pode ser usada; vencimento bloqueia edição e remove todos os acessos públicos", async () => {
  const foreign = await db.imageUpload.create({
    data: {
      id: randomUUID(),
      ownerId: other.id,
      data: Buffer.from("x"),
      mimeType: "image/webp",
    },
  });
  assert.equal(
    (
      await req(
        "/owner/listings/" + source.id,
        { ...editBody(), images: ["/uploads/" + foreign.id] },
        owner,
        "PUT",
      )
    ).status,
    400,
  );
  source = await db.listing.update({
    where: { id: source.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (await req("/owner/listings/" + source.id, editBody(), owner, "PUT"))
      .status,
    409,
  );
  for (const suffix of ["", "/contact", "/region"])
    assert.equal(
      (await req("/listings/" + source.id + suffix, null, null)).status,
      404,
    );
  assert.equal(await photoStatus(newPhoto.id), 404);
  const catalog = await req("/listings", null, null);
  assert.ok(!catalog.data.some((l) => l.id === source.id));
});
function renewalBody() {
  return {
    plan: "BASIC",
    ownerPhone: source.ownerPhone,
    contactAccepted: true,
    termsAccepted: true,
    termsVersion: config.renewalTermsVersion,
    couponCode: coupon.code,
    couponVersion: coupon.termsUpdatedAt.toISOString(),
  };
}
test("renovações concorrentes geram um ciclo só, preço e cupom corretos, sem copiar fotos ou dar crédito antes de pagar", async () => {
  assert.equal(
    (await req("/owner/listings/" + source.id + "/renew", renewalBody(), other))
      .status,
    403,
  );
  assert.equal(
    (
      await req("/owner/listings/" + source.id + "/renew", {
        ...renewalBody(),
        termsVersion: "old",
      })
    ).status,
    409,
  );
  const attempts = await Promise.all([
    req("/owner/listings/" + source.id + "/renew", renewalBody()),
    req("/owner/listings/" + source.id + "/renew", renewalBody()),
  ]);
  assert.ok(
    attempts.some((r) => r.status === 201),
    JSON.stringify(attempts),
  );
  const children = await db.listing.findMany({
    where: { renewalOfId: source.id, deletedAt: null },
  });
  assert.equal(children.length, 1);
  renewed = children[0];
  assert.equal(renewed.durationDays, 30);
  assert.equal(renewed.adPrice, 2490);
  assert.equal(renewed.partnerReward, 500);
  assert.equal(renewed.paidAt, null);
  assert.equal(renewed.expiresAt, null);
  assert.equal(renewed.commissionBps, 0);
  assert.deepEqual(renewed.images, source.images);
  assert.equal(renewed.paymentId, null);
  assert.equal(await db.imageUpload.count({ where: { ownerId: owner.id } }), 2);
  assert.equal(
    (await db.coupon.findUnique({ where: { id: coupon.id } })).reservations,
    2,
  );
  assert.equal(
    await db.affiliateEntry.count({ where: { listingId: renewed.id } }),
    0,
  );
  assert.equal(
    (await req("/owner/listings/" + source.id + "/renew", renewalBody())).data
      .id,
    renewed.id,
  );
  assert.equal(
    (
      await req("/owner/listings/" + source.id + "/renew", {
        ...renewalBody(),
        plan: "FEATURED",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        "/admin/listings/" + renewed.id + "/review",
        { approve: true, revision: 0 },
        admin,
      )
    ).status,
    409,
  );
});
test("novo pagamento libera um crédito novo e publicação por 30 dias com fotos reaproveitadas", async () => {
  renewed = await db.listing.update({
    where: { id: renewed.id },
    data: { paidAt: new Date(), paymentId: prefix + "-renewed" },
  });
  await moneyTransaction(db, (tx) =>
    creditPartner(tx, renewed, renewed.paymentId),
  );
  await moneyTransaction(db, (tx) =>
    creditPartner(tx, renewed, renewed.paymentId),
  );
  assert.equal(
    await db.affiliateEntry.count({ where: { listingId: renewed.id } }),
    1,
  );
  assert.equal(
    (
      await req(
        "/admin/listings/" + renewed.id + "/review",
        { approve: true, revision: 0 },
        admin,
      )
    ).status,
    200,
  );
  const l = await db.listing.findUnique({ where: { id: renewed.id } });
  assert.ok(
    Math.abs(l.expiresAt.getTime() - Date.now() - 30 * 86400000) < 5000,
  );
  assert.equal(await photoStatus(newPhoto.id), 200);
  assert.equal(
    (await db.listing.findUnique({ where: { id: source.id } })).paymentId,
    source.paymentId,
  );
  assert.equal(
    (await req("/owner/listings/" + renewed.id + "/renew", renewalBody()))
      .status,
    409,
  );
});
test("exclusão é lógica, protege acesso e mantém pagamentos e créditos sem publicar imagem órfã", async () => {
  assert.equal(
    (await req("/owner/listings/" + renewed.id, null, other, "DELETE")).status,
    403,
  );
  assert.equal(
    (await req("/owner/listings/" + renewed.id, null, owner, "DELETE")).status,
    200,
  );
  const row = await db.listing.findUnique({ where: { id: renewed.id } });
  assert.ok(row.deletedAt);
  assert.equal(row.status, "CANCELLED");
  assert.equal(row.paymentId, renewed.paymentId);
  assert.equal(
    await db.affiliateEntry.count({ where: { partnerId: partner.id } }),
    2,
  );
  assert.equal((await req("/listings/" + renewed.id, null, null)).status, 404);
  assert.equal(await photoStatus(newPhoto.id), 404);
  assert.ok(
    !(await req("/owner/listings")).data.some((l) => l.id === renewed.id),
  );
  assert.ok(
    (await req("/admin/listings", null, admin)).data.some(
      (l) => l.id === renewed.id,
    ),
  );
  assert.equal(
    (
      await req(
        "/admin/listings/" + renewed.id + "/review",
        { approve: true, revision: row.revision },
        admin,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await req(
        "/owner/listings/" + renewed.id,
        editBody({ ...source, revision: row.revision }),
        owner,
        "PUT",
      )
    ).status,
    404,
  );
});
