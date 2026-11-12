import { createHash } from "node:crypto";
import { TERMS_VERSION, terms } from "./rules.js";
export function commercialState(base, saved, env) {
  const config = {
    ...base,
    saleCommissionBps: 0,
    rentCommissionBps: 0,
  };
  const paymentsConfigured = Boolean(
    env.MP_ACCESS_TOKEN && env.MP_COLLECTOR_ID,
  );
  const requestedEnabled = saved?.enabled ?? env.COMMERCIAL_ENABLED === "true";
  config.commercialEnabled =
    requestedEnabled &&
    paymentsConfigured &&
    config.adPrice > 0 &&
    config.featuredPrice > 0;
  const termsVersion =
    TERMS_VERSION +
    "-" +
    createHash("sha256")
      .update(JSON.stringify(config))
      .digest("hex")
      .slice(0, 16);
  return { config, termsVersion, paymentsConfigured, requestedEnabled };
}
export function publicCommercial(state) {
  return {
    ...state.config,
    termsVersion: state.termsVersion,
    renewalDurationDays: 30,
    renewalTermsVersion: state.termsVersion + "-renewal-30",
    renewalTerms: {
      SALE: terms({ ...state.config, durationDays: 30 }, "SALE"),
      RENT: terms({ ...state.config, durationDays: 30 }, "RENT"),
    },
    terms: {
      SALE: terms(state.config, "SALE"),
      RENT: terms(state.config, "RENT"),
    },
  };
}
export function registerCommercialRoutes(
  app,
  { db, auth, admin, wrap, base, env, audit },
) {
  const state = async () =>
    commercialState(
      base,
      await db.commercialSettings.findUnique({ where: { id: "main" } }),
      env,
    );
  app.get(
    "/api/config",
    wrap(async (_q, r) => r.json(publicCommercial(await state()))),
  );
  app.get(
    "/api/admin/settings",
    auth,
    admin,
    wrap(async (_q, r) => {
      const s = await state();
      r.json({
        ...publicCommercial(s),
        paymentsConfigured: s.paymentsConfigured,
        requestedEnabled: s.requestedEnabled,
      });
    }),
  );
  app.put(
    "/api/admin/settings",
    auth,
    admin,
    wrap(async (q, r) => {
      const { enabled } = q.body || {};
      if (typeof enabled !== "boolean")
        return r
          .status(400)
          .json({ error: "Informe se a contratação está ativa." });
      const candidate = commercialState(base, { enabled }, env);
      if (enabled && !candidate.config.commercialEnabled)
        return r.status(400).json({
          error:
            "Para ativar, configure as credenciais do Mercado Pago no Render e preços de divulgação válidos.",
        });
      await db.$transaction(async (tx) => {
        await tx.commercialSettings.upsert({
          where: { id: "main" },
          create: {
            id: "main",
            saleCommissionBps: 0,
            rentCommissionBps: 0,
            enabled,
          },
          update: { enabled },
        });
        await audit(
          tx,
          q.user.id,
          "COMMERCIAL_SETTINGS_UPDATED",
          "main",
          JSON.stringify({
            saleCommissionBps: 0,
            rentCommissionBps: 0,
            enabled,
          }),
        );
      });
      r.json({
        ...publicCommercial(candidate),
        paymentsConfigured: candidate.paymentsConfigured,
        requestedEnabled: candidate.requestedEnabled,
      });
    }),
  );
  return state;
}
