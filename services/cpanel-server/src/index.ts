import "./env.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import { billingRouter } from "@xplatform/billing-service/router";
import { paymentsRouter } from "@xplatform/payments-service/router";
import { meteringRouter } from "@xplatform/metering-service/router";
import { commsRouter } from "@xplatform/comms-service/router";
import { complianceRouter } from "@xplatform/compliance-service/router";

const app = express();
const port = Number(process.env.PORT);
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";

app.use(cors({ origin: (process.env.CORS_ORIGIN ?? "*").split(",") }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, data: { service: "cpanel-server", status: "live" } });
});

app.get("/api/platform/status", (_req, res) => {
  const now = new Date().toISOString();
  const services = ["billing", "payments", "metering", "comms", "compliance"].map((name) => ({
    name,
    url: "in-process",
    status: "live" as const,
    uptime: "100%",
  }));
  res.json({ ok: true, data: { services, checkedAt: now }, meta: { service: "cpanel-server", tookMs: 0 } });
});

/**
 * Dev-mode login mirroring services/gateway/src/auth.ts — issues a JWT for
 * any of the three role personas without a real identity provider. Replace
 * with a real auth flow before production.
 */
app.post("/api/auth/dev-login", (req, res) => {
  const role = (req.body?.role as string) ?? "consumer";
  if (!["consumer", "admin", "service"].includes(role)) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_ROLE", message: "role must be consumer, admin or service" } });
    return;
  }
  const token = jwt.sign({ sub: req.body?.sub ?? "demo-user", role }, jwtSecret, { expiresIn: "12h" });
  res.json({ ok: true, data: { token } });
});

app.use("/api/billing", billingRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/metering", meteringRouter);
app.use("/api/comms", commsRouter);
app.use("/api/compliance", complianceRouter);

app.listen(port, () => {
  console.log(`[cpanel-server] listening on :${port}`);
});
