import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "./config.js";
import { eq } from "drizzle-orm";
import { issueToken, requireAuth, requireRole, type AuthedUser } from "./auth.js";
import { getPlatformStatus } from "./platformStatus.js";
import { verifyCredentials } from "./users.js";
import { createApiKey, listApiKeys, revokeApiKey } from "./apiKeys.js";
import { db } from "./db/client.js";
import { municipalities } from "./db/schema.js";

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
    municipalityId: user.municipalityId,
  });
  res.json({
    ok: true,
    data: {
      token,
      user: {
        name: user.name,
        email: user.email,
        persona: user.persona,
        accountNumber: user.accountNumber,
        municipalityId: user.municipalityId,
      },
    },
  });
});

/**
 * Municipality tenant data lives in the gateway's own platform schema
 * (same place as users) rather than a dedicated service — one table
 * doesn't earn its own microservice. Operators see and edit every
 * municipality; officials — who share the coarser `admin` role with
 * operators, so `persona` is what actually distinguishes them here — see
 * and may only touch their own, and only its contact details, not its
 * branding.
 */
app.get("/api/platform/municipalities", requireAuth, requireRole("admin", "service"), async (req, res, next) => {
  try {
    const rows =
      req.user?.persona === "official"
        ? await db.select().from(municipalities).where(eq(municipalities.id, req.user.municipalityId ?? ""))
        : await db.select().from(municipalities);
    res.json({ ok: true, data: rows, meta: { service: "gateway", tookMs: 0 } });
  } catch (err) {
    // Express 4 does not route a rejected promise from an async handler to
    // error middleware on its own — an uncaught throw here would otherwise
    // take down the whole gateway process, not just this request.
    next(err);
  }
});

app.patch("/api/platform/municipalities/:id", requireAuth, requireRole("admin", "service"), express.json(), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "id is required" } });
      return;
    }
    const isOperator = req.user?.persona === "operator" || req.user?.persona === undefined;
    const isOwnMunicipality = req.user?.persona === "official" && req.user.municipalityId === id;
    if (!isOperator && !isOwnMunicipality) {
      res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: "You may only edit your own municipality" } });
      return;
    }

    const body = req.body ?? {};
    const patch = isOperator
      ? {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.province !== undefined && { province: body.province }),
          ...(body.brandColor !== undefined && { brandColor: body.brandColor }),
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
          ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
          ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
        }
      : {
          // Officials may update contact details for their own municipality
          // only — not rename it, rebrand it, or reassign its tariffs.
          ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
          ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
        };

    if (Object.keys(patch).length === 0) {
      // e.g. an official's body only touched fields they're not allowed to
      // change — nothing survived the filter above. Drizzle's .set({})
      // throws rather than no-opping, so this must be caught before that.
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "No editable fields were provided" } });
      return;
    }

    const rows = await db.update(municipalities).set(patch).where(eq(municipalities.id, id)).returning();
    if (!rows[0]) {
      res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Municipality not found" } });
      return;
    }
    res.json({ ok: true, data: rows[0], meta: { service: "gateway", tookMs: 0 } });
  } catch (err) {
    next(err);
  }
});

/**
 * Integration API keys, operator-only — officials share the coarser `admin`
 * role with operators, so `persona` is what actually keeps them off a
 * platform-wide credential they have no reason to hold. Key lifecycle only
 * (issue/list/revoke); nothing downstream verifies requests against these
 * keys yet.
 */
function requireOperator(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (req.user?.persona === "official") {
    res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: "This operation is restricted to platform operators" } });
    return;
  }
  next();
}

app.get("/api/platform/api-keys", requireAuth, requireRole("admin", "service"), requireOperator, async (_req, res, next) => {
  try {
    const rows = await listApiKeys();
    res.json({ ok: true, data: rows, meta: { service: "gateway", tookMs: 0 } });
  } catch (err) {
    next(err);
  }
});

app.post("/api/platform/api-keys", requireAuth, requireRole("admin", "service"), requireOperator, express.json(), async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "name is required" } });
      return;
    }
    const created = await createApiKey(name, req.user?.name ?? req.user?.sub ?? "unknown");
    res.status(201).json({ ok: true, data: created, meta: { service: "gateway", tookMs: 0 } });
  } catch (err) {
    next(err);
  }
});

app.post("/api/platform/api-keys/:id/revoke", requireAuth, requireRole("admin", "service"), requireOperator, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "id is required" } });
      return;
    }
    const revoked = await revokeApiKey(id);
    if (!revoked) {
      res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "API key not found" } });
      return;
    }
    res.json({ ok: true, data: revoked, meta: { service: "gateway", tookMs: 0 } });
  } catch (err) {
    next(err);
  }
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
          proxyReq.setHeader("x-user-persona", user?.persona ?? "");
          proxyReq.setHeader("x-user-municipality", user?.municipalityId ?? "");
        },
      },
    }),
  );
}

// Final error-handling middleware — the safety net for any route above that
// calls next(err), or any synchronous throw Express itself catches. Must be
// registered last and take four arguments for Express to recognise it as
// an error handler.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[gateway] unhandled route error:", err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, data: null, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  }
});

app.listen(config.port, () => {
  console.log(`[gateway] listening on :${config.port}`);
  console.log(`[gateway] routing ${routeMap.length} services`);
});
