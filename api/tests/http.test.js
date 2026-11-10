import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
let child,
  base = "http://127.0.0.1:3098/api";
before(async () => {
  child = spawn(process.execPath, ["src/server.js"], {
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/test",
      JWT_SECRET: "test-only-not-a-real-secret-01234567890123456789",
      PORT: "3098",
      COMMERCIAL_ENABLED: "false",
      WEB_ORIGIN: "http://localhost:5173",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    let data = "";
    const timer = setTimeout(() => reject(Error("API não iniciou")), 10000);
    child.stdout.on("data", (b) => {
      data += b;
      if (data.includes("Portal API iniciada.")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", (b) => (data += b));
    child.on("exit", () => {
      clearTimeout(timer);
      reject(Error(data));
    });
  });
});
after(() => child?.kill());
test("API inicia, mostra preços e bloqueia comercial sem configuração completa", async () => {
  const r = await fetch(base + "/config");
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.equal(c.commercialEnabled, false);
  assert.equal(c.adPrice, 2990);
  assert.equal(c.featuredPrice, 5990);
  assert.equal(c.brokerPhone, "5563999915770");
  assert.ok(c.termsVersion.startsWith("2026-11-v1-"));
  assert.equal("MP_ACCESS_TOKEN" in c, false);
});
test("áreas privadas rejeitam acesso sem sessão antes de consultar o banco", async () => {
  for (const path of [
    "/owner/listings",
    "/admin/listings",
    "/admin/leads",
    "/admin/audit",
  ]) {
    const r = await fetch(base + path);
    assert.equal(r.status, 401);
  }
});
test("JWT inválido e registro malformado não concedem acesso", async () => {
  assert.equal(
    (
      await fetch(base + "/admin/listings", {
        headers: { Authorization: "Bearer invalid" },
      })
    ).status,
    401,
  );
  const r = await fetch(base + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "X",
      email: "bad",
      password: "short",
      role: "ADMIN",
    }),
  });
  assert.equal(r.status, 400);
});
test("CORS permite a origem configurada e não reflete origem arbitrária", async () => {
  for (const origin of ["http://localhost:5173", "https://evil.example"]) {
    const r = await fetch(base + "/health", { headers: { Origin: origin } });
    assert.equal(
      r.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
  }
  const r = await fetch(base + "/health");
  assert.ok(r.headers.get("x-content-type-options"));
});
