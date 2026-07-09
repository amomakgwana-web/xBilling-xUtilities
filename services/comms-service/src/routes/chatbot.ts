import { Router } from "express";
import { getChatStats, listChatSessions } from "../repository.js";

export const chatbotRouter: Router = Router();

chatbotRouter.get("/sessions", async (_req, res) => {
  const sessions = await listChatSessions();
  res.json({ ok: true, data: sessions, meta: { service: "comms-service", tookMs: 0 } });
});

chatbotRouter.get("/stats", async (_req, res) => {
  const stats = await getChatStats();
  res.json({ ok: true, data: stats, meta: { service: "comms-service", tookMs: 0 } });
});
