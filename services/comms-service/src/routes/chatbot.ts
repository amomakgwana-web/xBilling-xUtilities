import { Router } from "express";
import { chatSessions } from "../store.js";

export const chatbotRouter: Router = Router();

chatbotRouter.get("/sessions", (_req, res) => {
  res.json({ ok: true, data: chatSessions, meta: { service: "comms-service", tookMs: 0 } });
});

chatbotRouter.get("/stats", (_req, res) => {
  const total = chatSessions.length;
  const resolved = chatSessions.filter((s) => s.resolved).length;
  const escalated = chatSessions.filter((s) => s.escalated).length;
  res.json({
    ok: true,
    data: { total, resolved, escalated },
    meta: { service: "comms-service", tookMs: 0 },
  });
});
