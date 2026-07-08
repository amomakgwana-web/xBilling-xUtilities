import { Router } from "express";
import { generateInsight } from "../ai.js";

export const insightRouter: Router = Router();

insightRouter.post("/platform", async (req, res) => {
  const summary = req.body?.summary ?? "Platform KPIs unavailable.";
  const result = await generateInsight(
    "You are xLayer — a unified municipal utilities platform AI. Provide a concise 3-sentence executive briefing. Be precise and data-driven.",
    `Platform KPIs: ${summary}`,
    `Collections remain on track and all core services (billing, payments, metering, comms) are reporting live. No action required at this time.`,
  );
  res.json({ ok: true, data: result, meta: { service: "comms-service", tookMs: 0, mocked: result.mocked } });
});

insightRouter.post("/draft-sms", async (req, res) => {
  const brief = req.body?.brief ?? "Overdue account reminder";
  const result = await generateInsight(
    "You are xCentral bulk comms. Write a concise, compliant South African municipal billing SMS (max 160 chars). Use placeholders: {{NAME}} {{AMOUNT}} {{DATE}} {{LINK}}. Return only the SMS text.",
    brief,
    "{{MUNICIPALITY}}: R{{AMOUNT}} due {{DATE}} on acct {{ACCT}}. Pay: {{LINK}} - Queries: *120#",
  );
  res.json({ ok: true, data: result, meta: { service: "comms-service", tookMs: 0, mocked: result.mocked } });
});
