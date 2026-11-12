import bcrypt from "bcryptjs";
import { registrationSchema } from "./user-profile.js";
import { z } from "zod";
const fail = (status, message) => Object.assign(Error(message), { status });
export const couponCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/, "Use de 3 a 32 letras, números, _ ou -.");
const cents = z.number().int().min(1).max(100000000);
const couponInput = z.object({
  code: couponCode,
  partnerId: z.string().min(1),
  active: z.boolean(),
  discountCents: cents,
  rewardCents: cents,
  holdDays: z.number().int().min(0).max(365),
  plans: z
    .array(z.enum(["BASIC", "FEATURED"]))
    .min(1)
    .max(2),
  expiresAt: z.string().datetime(),
  maxUses: z.number().int().min(1).max(1000000).nullable(),
});
// PostgreSQL serializable prevents competing withdrawals, coupon reservations and
// refunds from reading the same balance. Retries repeat DB work only, never Pix/MP.
export async function moneyTransaction(db, fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (e) {
      if (e.code !== "P2034" || attempt >= 4) throw e;
    }
  }
}
export function couponPrice(coupon, basePrice, plan, userId, now = new Date()) {
  if (
    !coupon ||
    !coupon.active ||
    !coupon.partner.active ||
    new Date(coupon.expiresAt) <= now ||
    !coupon.plans.includes(plan) ||
    (coupon.maxUses !== null && coupon.reservations >= coupon.maxUses)
  )
    throw fail(
      400,
      "Cupom indisponível, esgotado ou não aplicável a este plano.",
    );
  if (coupon.partner.userId === userId)
    throw fail(400, "O parceiro não pode usar o próprio cupom.");
  const finalPrice = basePrice - coupon.discountCents;
  if (finalPrice < 1 || coupon.rewardCents > finalPrice)
    throw fail(
      400,
      "Cupom incompatível com o preço atual do plano. Fale com o administrador.",
    );
  return {
    code: coupon.code,
    version: new Date(coupon.termsUpdatedAt || coupon.createdAt).toISOString(),
    originalPrice: basePrice,
    discount: coupon.discountCents,
    finalPrice,
    plan,
  };
}
export async function reserveCoupon(
  tx,
  { code, version, basePrice, plan, userId },
) {
  if (!code) return { adPrice: basePrice };
  const coupon = await tx.coupon.findUnique({
    where: { code: couponCode.parse(code) },
    include: { partner: true },
  });
  const quote = couponPrice(coupon, basePrice, plan, userId);
  if (quote.version !== version)
    throw fail(
      409,
      "O cupom mudou. Aplique-o novamente e confira o preço antes de aceitar.",
    );
  const reserved = await tx.coupon.updateMany({
    where: {
      id: coupon.id,
      reservations: coupon.reservations,
      updatedAt: coupon.updatedAt,
    },
    data: { reservations: { increment: 1 } },
  });
  if (reserved.count !== 1)
    throw fail(409, "O cupom foi atualizado. Aplique-o novamente.");
  return {
    adPrice: quote.finalPrice,
    originalAdPrice: basePrice,
    couponId: coupon.id,
    couponCode: coupon.code,
    partnerReward: coupon.rewardCents,
    partnerHoldDays: coupon.holdDays,
  };
}
// Called only after server-side validation of the PSP amount, seller and reference.
export async function creditPartner(tx, listing, paymentId) {
  if (!listing.couponId || !listing.partnerReward) return;
  const current = await tx.listing.findUnique({ where: { id: listing.id } });
  if (
    current.affiliateVoidedAt ||
    !current.paidAt ||
    current.paymentId !== paymentId
  )
    return;
  const coupon = await tx.coupon.findUnique({
    where: { id: listing.couponId },
  });
  const data = {
    partnerId: coupon.partnerId,
    listingId: listing.id,
    kind: "CREDIT",
    amount: listing.partnerReward,
    availableAt: new Date(
      new Date(current.paidAt).getTime() + listing.partnerHoldDays * 86400000,
    ),
  };
  await tx.affiliateEntry.upsert({
    where: { listingId_kind: { listingId: listing.id, kind: "CREDIT" } },
    create: data,
    update: {},
  });
}
export async function reversePartner(tx, listing, now = new Date()) {
  if (!listing.couponId) return;
  // A retry must not cancel a later withdrawal containing the already-netted
  // credit/reversal pair. Detect reversal before touching any reservation.
  if (
    await tx.affiliateEntry.findUnique({
      where: { listingId_kind: { listingId: listing.id, kind: "REVERSAL" } },
    })
  )
    return;
  const credit = await tx.affiliateEntry.findUnique({
    where: { listingId_kind: { listingId: listing.id, kind: "CREDIT" } },
    include: { payout: true },
  });
  if (!credit) return;
  // A reversed credit cannot remain inside an unpaid withdrawal. Release the
  // entire request, including any prior negative entries, then net the reversal.
  if (credit.payout?.status === "REQUESTED") {
    await tx.partnerPayout.update({
      where: { id: credit.payoutId },
      data: {
        status: "REJECTED",
        resolvedAt: now,
        note: "Solicitação cancelada por estorno de anúncio. Confira o saldo e solicite novamente.",
      },
    });
    await tx.affiliateEntry.updateMany({
      where: { payoutId: credit.payoutId },
      data: { payoutId: null },
    });
  }
  await tx.affiliateEntry.update({
    where: { id: credit.id },
    data: { availableAt: now },
  });
  await tx.affiliateEntry.upsert({
    where: { listingId_kind: { listingId: listing.id, kind: "REVERSAL" } },
    create: {
      partnerId: credit.partnerId,
      listingId: listing.id,
      kind: "REVERSAL",
      amount: -credit.amount,
      availableAt: now,
    },
    update: {},
  });
}
export function partnerBalances(entries, now = new Date()) {
  const totals = { pending: 0, available: 0, reserved: 0, paid: 0 };
  for (const e of entries) {
    const bucket =
      e.payout?.status === "PAID"
        ? "paid"
        : e.payout?.status === "REQUESTED"
          ? "reserved"
          : new Date(e.availableAt) > now
            ? "pending"
            : "available";
    totals[bucket] += e.amount;
  }
  return totals;
}
async function profile(db, userId, active = true) {
  const partner = await db.partner.findUnique({ where: { userId } });
  if (!partner || (active && !partner.active))
    throw fail(
      403,
      "Seu acesso de parceiro ainda não foi ativado pelo administrador.",
    );
  return partner;
}
export async function requestPayout(tx, partner, input, now = new Date()) {
  const previous = await tx.partnerPayout.findUnique({
    where: { requestKey: input.requestKey },
  });
  if (previous) {
    if (previous.partnerId !== partner.id)
      throw fail(409, "Identificador de solicitação já utilizado.");
    return previous;
  }
  if (!partner.active) throw fail(403, "Parceiro desativado.");
  if (
    await tx.partnerPayout.findFirst({
      where: { partnerId: partner.id, status: "REQUESTED" },
    })
  )
    throw fail(409, "Você já tem um saque em análise. Aguarde a resolução.");
  const entries = await tx.affiliateEntry.findMany({
    where: { partnerId: partner.id, payoutId: null, availableAt: { lte: now } },
  });
  const amount = entries.reduce((sum, e) => sum + e.amount, 0);
  if (amount < partner.minWithdrawal || amount <= 0)
    throw fail(
      400,
      "Saldo disponível abaixo do mínimo para saque, considerando estornos.",
    );
  if (!Number.isSafeInteger(amount) || amount > 2147483647)
    throw fail(
      400,
      "O saldo excede o limite de uma solicitação. Contate o administrador.",
    );
  const payout = await tx.partnerPayout.create({
    data: { partnerId: partner.id, amount, ...input },
  });
  const reserved = await tx.affiliateEntry.updateMany({
    where: { id: { in: entries.map((e) => e.id) }, payoutId: null },
    data: { payoutId: payout.id },
  });
  if (reserved.count !== entries.length)
    throw fail(409, "O saldo mudou. Atualize a página.");
  return payout;
}
export function registerPartnerRoutes(
  app,
  { db, auth, admin, wrap, getCommercial, audit },
) {
  app.post(
    "/api/coupons/quote",
    auth,
    wrap(async (q, r) => {
      const input = z
        .object({ code: couponCode, plan: z.enum(["BASIC", "FEATURED"]) })
        .parse(q.body);
      const { config } = await getCommercial();
      if (!config.commercialEnabled)
        throw fail(503, "Contratações desativadas.");
      const coupon = await db.coupon.findUnique({
        where: { code: input.code },
        include: { partner: true },
      });
      r.json(
        couponPrice(
          coupon,
          input.plan === "BASIC" ? config.adPrice : config.featuredPrice,
          input.plan,
          q.user.id,
        ),
      );
    }),
  );
  app.get(
    "/api/partner/dashboard",
    auth,
    wrap(async (q, r) => {
      // Inactive partners retain access to their own statement, but cannot request withdrawals.
      const partner = await profile(db, q.user.id, false);
      const [entries, payouts, coupons] = await Promise.all([
        db.affiliateEntry.findMany({
          where: { partnerId: partner.id },
          include: { payout: { select: { status: true } } },
          orderBy: { createdAt: "desc" },
        }),
        db.partnerPayout.findMany({
          where: { partnerId: partner.id },
          orderBy: { createdAt: "desc" },
        }),
        db.coupon.findMany({
          where: { partnerId: partner.id },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      const counts = await db.listing.groupBy({
        by: ["couponId"],
        where: {
          couponId: { in: coupons.map((c) => c.id) },
          paidAt: { not: null },
          affiliateVoidedAt: null,
        },
        _count: { _all: true },
      });
      r.json({
        partner: {
          active: partner.active,
          minWithdrawal: partner.minWithdrawal,
        },
        balances: partnerBalances(entries),
        // No listing title, address, customer identity or contact in the partner area.
        entries: entries.map(
          ({
            id,
            listingId,
            kind,
            amount,
            availableAt,
            payoutId,
            createdAt,
          }) => ({
            id,
            listingId,
            kind,
            amount,
            availableAt,
            payoutId,
            createdAt,
          }),
        ),
        payouts,
        coupons: coupons.map((c) => ({
          code: c.code,
          active: c.active,
          discountCents: c.discountCents,
          rewardCents: c.rewardCents,
          holdDays: c.holdDays,
          expiresAt: c.expiresAt,
          plans: c.plans,
          paidAds: counts.find((n) => n.couponId === c.id)?._count._all || 0,
        })),
      });
    }),
  );
  app.post(
    "/api/partner/payouts",
    auth,
    wrap(async (q, r) => {
      const input = z
        .object({
          requestKey: z.string().uuid(),
          pixKey: z.string().trim().min(3).max(254),
          recipientName: z.string().trim().min(3).max(120),
          accepted: z.literal(true),
        })
        .parse(q.body);
      const result = await moneyTransaction(db, async (tx) => {
        const partner = await profile(tx, q.user.id);
        const { accepted, ...data } = input;
        const payout = await requestPayout(tx, partner, data);
        await audit(
          tx,
          q.user.id,
          "PARTNER_PAYOUT_REQUESTED",
          payout.id,
          String(payout.amount),
        );
        return payout;
      });
      r.status(201).json(result);
    }),
  );
  app.get(
    "/api/admin/partners",
    auth,
    admin,
    wrap(async (_q, r) => {
      const [partners, coupons, payouts] = await Promise.all([
        db.partner.findMany({
          include: {
            user: { select: { name: true, email: true, role: true } },
            entries: { include: { payout: { select: { status: true } } } },
            _count: { select: { coupons: true, entries: true, payouts: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.coupon.findMany({
          include: { _count: { select: { listings: true } } },
          orderBy: { createdAt: "desc" },
        }),
        db.partnerPayout.findMany({
          include: {
            partner: {
              select: { user: { select: { name: true, email: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      r.json({
        partners: partners.map(({ entries, ...p }) => ({
          ...p,
          balances: partnerBalances(entries),
        })),
        coupons,
        payouts,
      });
    }),
  );
  app.post(
    "/api/admin/partners",
    auth,
    admin,
    wrap(async (q, r) => {
      const mode =
        q.body?.mode ??
        (q.body?.password !== undefined ? "CREATE" : "EXISTING");
      const input = z
        .discriminatedUnion("mode", [
          registrationSchema
            .extend({ mode: z.literal("CREATE"), minWithdrawal: cents })
            .strict(),
          z
            .object({
              mode: z.literal("EXISTING"),
              email: z
                .string()
                .trim()
                .email()
                .max(254)
                .transform((s) => s.toLowerCase()),
              minWithdrawal: cents,
            })
            .strict(),
        ])
        .parse({ ...q.body, mode });
      // Hash before the transaction; never retain or return the plain password.
      const passwordHash =
        input.mode === "CREATE" ? await bcrypt.hash(input.password, 12) : null;
      const partner = await moneyTransaction(db, async (tx) => {
        let user = await tx.user.findUnique({ where: { email: input.email } });
        if (input.mode === "CREATE") {
          if (user)
            throw fail(
              409,
              "Este e-mail já possui uma conta. Use Vincular conta existente, sem alterar a senha atual.",
            );
          user = await tx.user.create({
            data: {
              name: input.name,
              email: input.email,
              cpf: input.cpf,
              phone: input.phone,
              address: input.address,
              passwordHash,
              role: "PARTNER",
            },
          });
        } else if (!user || user.role === "ADMIN") {
          throw fail(
            400,
            "Conta comum não encontrada. Use Criar acesso de parceiro para cadastrar login e senha.",
          );
        }
        const created = await tx.partner.create({
          data: { userId: user.id, minWithdrawal: input.minWithdrawal },
        });
        await audit(
          tx,
          q.user.id,
          input.mode === "CREATE"
            ? "PARTNER_ACCESS_CREATED"
            : "PARTNER_CREATED",
          created.id,
        );
        return {
          ...created,
          user: { name: user.name, email: user.email, role: user.role },
        };
      });
      r.status(201).json(partner);
    }),
  );
  app.put(
    "/api/admin/partners/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      const input = z
        .object({
          active: z.boolean(),
          minWithdrawal: cents,
          name: z.string().trim().min(3).max(100).optional(),
        })
        .parse(q.body);
      r.json(
        await moneyTransaction(db, async (tx) => {
          const { name, ...settings } = input;
          const updated = await tx.partner.update({
            where: { id: q.params.id },
            data: settings,
          });
          if (name)
            await tx.user.update({
              where: { id: updated.userId },
              data: { name },
            });
          await audit(
            tx,
            q.user.id,
            "PARTNER_UPDATED",
            updated.id,
            "Dados e configuração do parceiro atualizados",
          );
          return updated;
        }),
      );
    }),
  );
  app.post(
    "/api/admin/coupons",
    auth,
    admin,
    wrap(async (q, r) => {
      const input = couponInput.parse(q.body);
      const { config } = await getCommercial();
      if (new Date(input.expiresAt) <= new Date())
        throw fail(400, "Informe uma validade futura.");
      for (const plan of input.plans) {
        const price = plan === "BASIC" ? config.adPrice : config.featuredPrice;
        if (price - input.discountCents < input.rewardCents)
          throw fail(
            400,
            "Desconto e crédito juntos não podem superar o preço do plano.",
          );
      }
      r.status(201).json(
        await moneyTransaction(db, async (tx) => {
          const p = await tx.partner.findUnique({
            where: { id: input.partnerId },
          });
          if (!p?.active) throw fail(400, "Parceiro indisponível.");
          const c = await tx.coupon.create({
            data: { ...input, expiresAt: new Date(input.expiresAt) },
          });
          await audit(tx, q.user.id, "COUPON_CREATED", c.id, c.code);
          return c;
        }),
      );
    }),
  );
  app.put(
    "/api/admin/coupons/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      const input = couponInput
        .omit({ partnerId: true })
        .partial()
        .extend({ expectedVersion: z.string().datetime().optional() })
        .strict()
        .parse(q.body);
      if (!Object.keys(input).some((key) => key !== "expectedVersion"))
        throw fail(400, "Informe os campos para editar.");
      const { config } = await getCommercial();
      r.json(
        await moneyTransaction(db, async (tx) => {
          const current = await tx.coupon.findUnique({
            where: { id: q.params.id },
            include: { _count: { select: { listings: true } } },
          });
          if (!current) throw fail(404, "Cupom não encontrado.");
          const { expectedVersion, ...changes } = input;
          const editsTerms = Object.keys(changes).some(
            (key) => key !== "active",
          );
          if (
            editsTerms &&
            expectedVersion !== current.termsUpdatedAt.toISOString()
          )
            throw fail(
              409,
              "Este cupom foi alterado. Atualize a tabela e abra a edição novamente.",
            );
          if (
            changes.code &&
            changes.code !== current.code &&
            (current.reservations || current._count.listings)
          )
            throw fail(
              409,
              "O código de um cupom utilizado é preservado no histórico. Crie outro código se necessário.",
            );
          const candidate = { ...current, ...changes };
          if (changes.expiresAt && new Date(changes.expiresAt) <= new Date())
            throw fail(400, "Informe uma validade futura.");
          if (
            candidate.maxUses !== null &&
            candidate.maxUses < current.reservations
          )
            throw fail(
              400,
              "O limite não pode ser menor que as utilizações já reservadas.",
            );
          if (editsTerms || changes.active === true)
            for (const plan of candidate.plans) {
              const price =
                plan === "BASIC" ? config.adPrice : config.featuredPrice;
              if (price - candidate.discountCents < candidate.rewardCents)
                throw fail(
                  400,
                  "Desconto e crédito juntos não podem superar o preço do plano.",
                );
            }
          const c = await tx.coupon.update({
            where: { id: current.id },
            data: {
              ...changes,
              ...(changes.expiresAt
                ? { expiresAt: new Date(changes.expiresAt) }
                : {}),
              termsUpdatedAt: new Date(
                Math.max(Date.now(), current.termsUpdatedAt.getTime() + 1),
              ),
            },
          });
          await audit(
            tx,
            q.user.id,
            "COUPON_UPDATED",
            c.id,
            Object.keys(changes).join(","),
          );
          return c;
        }),
      );
    }),
  );
  app.delete(
    "/api/admin/coupons/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      await moneyTransaction(db, async (tx) => {
        const c = await tx.coupon.findUnique({
          where: { id: q.params.id },
          include: { _count: { select: { listings: true } } },
        });
        if (!c) throw fail(404, "Cupom não encontrado.");
        if (c.reservations || c._count.listings)
          throw fail(
            409,
            "Este cupom tem utilizações. Desative-o para preservar o histórico.",
          );
        await tx.coupon.delete({ where: { id: c.id } });
        await audit(tx, q.user.id, "COUPON_DELETED", c.id);
      });
      r.json({ ok: true });
    }),
  );
  app.delete(
    "/api/admin/partners/:id",
    auth,
    admin,
    wrap(async (q, r) => {
      await moneyTransaction(db, async (tx) => {
        const p = await tx.partner.findUnique({
          where: { id: q.params.id },
          include: {
            _count: { select: { coupons: true, entries: true, payouts: true } },
          },
        });
        if (!p) throw fail(404, "Parceiro não encontrado.");
        if (Object.values(p._count).some(Boolean))
          throw fail(
            409,
            "Este parceiro possui cupons ou histórico financeiro. Desative-o ou exclua primeiro os cupons sem uso.",
          );
        await tx.partner.delete({ where: { id: p.id } });
        await audit(tx, q.user.id, "PARTNER_DELETED", p.id);
      });
      r.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/partner-payouts/:id/resolve",
    auth,
    admin,
    wrap(async (q, r) => {
      const input = z
        .discriminatedUnion("status", [
          z.object({
            status: z.literal("PAID"),
            receiptReference: z.string().trim().min(6).max(200),
            confirmed: z.literal(true),
          }),
          z.object({
            status: z.literal("REJECTED"),
            note: z.string().trim().min(5).max(500),
          }),
        ])
        .parse(q.body);
      r.json(
        await moneyTransaction(db, async (tx) => {
          const payout = await tx.partnerPayout.findUnique({
            where: { id: q.params.id },
          });
          if (!payout) throw fail(404, "Saque não encontrado.");
          if (payout.status !== "REQUESTED")
            throw fail(
              409,
              "Saque já resolvido. Nenhuma nova baixa foi feita.",
            );
          const entries = await tx.affiliateEntry.findMany({
            where: { payoutId: payout.id },
          });
          if (entries.reduce((sum, e) => sum + e.amount, 0) !== payout.amount)
            throw fail(409, "Saldo reservado divergente. Confira o histórico.");
          const { confirmed, ...data } = input;
          const updated = await tx.partnerPayout.update({
            where: { id: payout.id },
            data: { ...data, resolvedAt: new Date() },
          });
          if (input.status === "REJECTED")
            await tx.affiliateEntry.updateMany({
              where: { payoutId: payout.id },
              data: { payoutId: null },
            });
          await audit(
            tx,
            q.user.id,
            "PARTNER_PAYOUT_" + input.status,
            payout.id,
            String(payout.amount),
          );
          return updated;
        }),
      );
    }),
  );
}
