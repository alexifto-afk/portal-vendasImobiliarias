export function requireAdvertiser(q, _r, next) {
  if (["OWNER", "ADMIN"].includes(q.user?.role)) return next();
  next(
    Object.assign(
      Error(
        "Este acesso é de parceiro. Use a área de cupons, créditos e saques.",
      ),
      { status: 403 },
    ),
  );
}
