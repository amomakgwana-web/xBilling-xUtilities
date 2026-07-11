import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "./config.js";
import { issueToken, requireAuth, requireRole, type AuthedUser } from "./auth.js";
import { getPlatformStatus } from "./platformStatus.js";
import { verifyCredentials } from "./users.js";

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
 * Real login: email + password verified with bcrypt against platform.users.
 * Provisioned identities only — there is deliberately no self-signup for a
 * municipal billing platform.
 */
app.post("/api/auth/login", express.json(), async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "email and password are required" } });
    return;
  }
  const user = await verifyCredentials(email, password);
  if (!user) {
    res.status(401).json({ ok: false, data: null, error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } });
    return;
  }
  const token = issueToken({
    sub: user.id,
    role: user.role,
    accountNumber: user.accountNumber,
    name: user.name,
    persona: user.persona,
  });
  res.json({
    ok: true,
    data: {
      token,
      user: { name: user.name, email: user.email, persona: user.persona, accountNumber: user.accountNumber },
    },
  });
});

/**
 * Every proxied domain requires a valid platform JWT. Consumers (citizens
 * signed into the unified console) may reach billing, payments and metering
 * for self-service (statements, pay-now, prepaid token purchase); comms and
 * compliance are admin/service only.
 */
const routeMap: Array<{ path: string; target: string; roles: Array<AuthedUser["role"]> }> = [
  { path: "/api/billing", target: config.services.billing, roles: ["consumer", "admin", "service"] },
  { path: "/api/payments", target: config.services.payments, roles: ["consumer", "admin", "service"] },
  { path: "/api/metering", target: config.services.metering, roles: ["consumer", "admin", "service"] },
  { path: "/api/comms", target: config.services.comms, roles: ["admin", "service"] },
  { path: "/api/compliance", target: config.services.compliance, roles: ["admin", "service"] },
];

/**
 * Fire-and-forget audit of every authenticated mutating request, written to
 * compliance-service's hash-chained audit log. Failures never block the
 * request — the platform must not go down because auditing is degraded.
 */
function auditMutation(req: express.Request): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  void fetch(`${config.services.compliance}/audit/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor: req.user?.sub ?? "anonymous",
      actorName: req.user?.name,
      role: req.user?.role,
      action: `${req.method} ${req.baseUrl}${req.path}`,
      target: req.user?.accountNumber ?? null,
    }),
  }).catch(() => undefined);
}

for (const route of routeMap) {
  app.use(
    route.path,
    requireAuth,
    requireRole(...route.roles),
    (req, _res, next) => {
      auditMutation(req);
      next();
    },
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      pathRewrite: { [`^${route.path}`]: "" },
      on: {
        proxyReq: (proxyReq, req) => {
          // Forward the gateway-verified identity; never trust these headers
          // from the client (they are overwritten unconditionally).
          const user = (req as express.Request).user;
          proxyReq.setHeader("x-user-sub", user?.sub ?? "");
          proxyReq.setHeader("x-user-role", user?.role ?? "");
          proxyReq.setHeader("x-user-account", user?.accountNumber ?? "");
        },
      },
    }),
  );
}

app.listen(config.port, () => {
  console.log(`[gateway] listening on :${config.port}`);
  console.log(`[gateway] routing ${routeMap.length} services`);
});
