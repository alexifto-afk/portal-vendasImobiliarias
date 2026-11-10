import { createHash } from "node:crypto";
import { TERMS_VERSION, terms } from "./rules.js";
export function commercialState(base, saved, env) {
  const config = {
    ...base,
    saleCommissionBps: saved?.saleCommissionBps ?? base.saleCommissionBps,
    rentCommissionBps: saved?.rentCommissionBps ?? base.rentCommissionBps,
  };
  const paymentsConfigured = Boolean(
    env.MP_ACCESS_TOKEN && env.MP_COLLECTOR_ID,
  );
  const requestedEnabled = saved?.enabled ?? env.COMMERCIAL_ENABLED === "true";
  config.commercialEnabled =
    requestedEnabled &&
    paymentsConfigured &&
    config.saleCommissionBps > 0 &&
    config.rentCommissionBps > 0 &&
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
      const {
        saleCommissionBps: sale,
        rentCommissionBps: rent,
        enabled,
      } = q.body || {};
      if (
        ![sale, rent].every(
          (n) => Number.isInteger(n) && n >= 0 && n <= 10000,
        ) ||
        typeof enabled !== "boolean"
      )
        return r
          .status(400)
          .json({
            error:
              "Informe percentuais entre 0 e 100%, com até duas casas decimais.",
          });
      const candidate = commercialState(
        base,
        { saleCommissionBps: sale, rentCommissionBps: rent, enabled },
        env,
      );
      if (enabled && !candidate.config.commercialEnabled)
        return r
          .status(400)
          .json({
            error:
              "Para ativar, configure as credenciais do Mercado Pago no Render e comissões maiores que zero.",
          });
      await db.$transaction(async (tx) => {
        await tx.commercialSettings.upsert({
          where: { id: "main" },
          create: {
            id: "main",
            saleCommissionBps: sale,
            rentCommissionBps: rent,
            enabled,
          },
          update: { saleCommissionBps: sale, rentCommissionBps: rent, enabled },
        });
        await audit(
          tx,
          q.user.id,
          "COMMERCIAL_SETTINGS_UPDATED",
          "main",
          JSON.stringify({
            saleCommissionBps: sale,
            rentCommissionBps: rent,
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
