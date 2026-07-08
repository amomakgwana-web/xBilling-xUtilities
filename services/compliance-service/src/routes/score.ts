import { Router } from "express";
import { complianceScore } from "../store.js";

export const scoreRouter: Router = Router();

scoreRouter.get("/", (_req, res) => {
  res.json({ ok: true, data: complianceScore, meta: { service: "compliance-service", tookMs: 0 } });
});
