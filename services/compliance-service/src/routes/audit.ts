import { Router } from "express";
import { appendAuditEvent, listAuditEvents, verifyAuditChain } from "../audit.js";

export const auditRouter: Router = Router();

auditRouter.post("/events", async (req, res) => {
  const { actor, actorName, role, action, target } = req.body ?? {};
  if (!actor || !action) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "actor and action are required" } });
    return;
  }
  const event = await appendAuditEvent({ actor, actorName, role, action, target });
  res.status(201).json({ ok: true, data: event, meta: { service: "compliance-service", tookMs: 0 } });
});

auditRouter.get("/events", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
  const events = await listAuditEvents(limit);
  res.json({ ok: true, data: events, meta: { service: "compliance-service", tookMs: 0 } });
});

auditRouter.get("/verify", async (_req, res) => {
  const result = await verifyAuditChain();
  res.json({ ok: true, data: result, meta: { service: "compliance-service", tookMs: 0 } });
});
