import { Router } from "express";
import { listIntegrations } from "../repository.js";

export const integrationsRouter: Router = Router();

integrationsRouter.get("/", async (req, res) => {
  const { category, status } = req.query;
  const result = await listIntegrations({
    category: typeof category === "string" ? category : undefined,
    status: typeof status === "string" ? status : undefined,
  });
  res.json({ ok: true, data: result, meta: { service: "compliance-service", tookMs: 0 } });
});
