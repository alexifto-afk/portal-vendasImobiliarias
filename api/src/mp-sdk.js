import {
  MercadoPagoConfig,
  Order,
  User,
  Preference,
  Payment,
} from "mercadopago";
// Credenciais recebidas apenas no servidor. As rotas não registram o conteúdo.
export async function requestMercadoPago(token, path, options = {}) {
  const config = new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 20000, maxRetries: 0 },
  });
  if (path === "/users/me") return new User(config).get();
  if (path === "/v1/orders" && options.method === "POST")
    return new Order(config).create({
      body: JSON.parse(options.body),
      requestOptions: { idempotencyKey: options.headers["X-Idempotency-Key"] },
    });
  if (path.startsWith("/v1/orders/"))
    return new Order(config).get({
      id: decodeURIComponent(path.slice("/v1/orders/".length)),
    });
  if (path === "/checkout/preferences")
    return new Preference(config).create({ body: JSON.parse(options.body) });
  if (/^\/v1\/payments\/\d+$/.test(path))
    return new Payment(config).get({ id: path.split("/").pop() });
  if (path.startsWith("/v1/payments/search?"))
    return new Payment(config).search({
      options: Object.fromEntries(new URLSearchParams(path.split("?")[1])),
    });
  throw Error("Operação Mercado Pago não suportada.");
}
