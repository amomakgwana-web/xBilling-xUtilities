import { Router } from "express";
import { getComplianceScore } from "../repository.js";

export const scoreRouter: Router = Router();

scoreRouter.get("/", async (_req, res) => {
  const complianceScore = await getComplianceScore();
  res.json({ ok: true, data: complianceScore, meta: { service: "compliance-service", tookMs: 0 } });
});
