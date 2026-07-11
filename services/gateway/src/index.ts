import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "./config.js";
import { issueToken, requireAuth, requireRole, type AuthedUser } from "./auth.js";
import { getPlatformStatus } from "./platformStatus.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(morgan("dev"));

// NOTE: express.json() is intentionally NOT mounted globally. Applying it
// before the proxy routes below would consume each request's body stream,
// leaving http-proxy-middleware nothing to forward and every proxied POST/PUT
// would hang. Only the gateway's own routes (not proxied) parse JSON.

app.get("/health", (_req, res) => {
  res.json({ ok: true, data: { service: "gateway", status: "live" } });
});

app.get("/api/platform/status", async (_req, res) => {
  const status = await getPlatformStatus();
  res.json({ ok: true, data: status, meta: { service: "gateway", tookMs: 0 } });
});

/**
 * Dev-only login: issues a JWT for any of the three role personas without a
 * real identity provider. Replace with a real auth flow before production —
 * downstream routing and RBAC are already shaped around `req.user`.
 */
app.post("/api/auth/dev-login", express.json(), (req, res) => {
  const role = (req.body?.role as string) ?? "consumer";
  if (!["consumer", "admin", "service"].includes(role)) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_ROLE", message: "role must be consumer, admin or service" } });
    return;
  }
  const token = issueToken({ sub: req.body?.sub ?? "demo-user", role: role as "consumer" | "admin" | "service" });
  res.json({ ok: true, data: { token } });
});

/**
 * Every proxied domain requires a valid platform JWT. Consumers (citizens
 * signed into the unified console) may reach billing and payments for
 * self-service; the operational domains are admin/service only.
 */
const routeMap: Array<{ path: string; target: string; roles: Array<AuthedUser["role"]> }> = [
  { path: "/api/billing", target: config.services.billing, roles: ["consumer", "admin", "service"] },
  { path: "/api/payments", target: config.services.payments, roles: ["consumer", "admin", "service"] },
  { path: "/api/metering", target: config.services.metering, roles: ["admin", "service"] },
  { path: "/api/comms", target: config.services.comms, roles: ["admin", "service"] },
  { path: "/api/compliance", target: config.services.compliance, roles: ["admin", "service"] },
];

for (const route of routeMap) {
  app.use(
    route.path,
    requireAuth,
    requireRole(...route.roles),
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      pathRewrite: { [`^${route.path}`]: "" },
    }),
  );
}

app.listen(config.port, () => {
  console.log(`[gateway] listening on :${config.port}`);
  console.log(`[gateway] routing ${routeMap.length} services`);
});
