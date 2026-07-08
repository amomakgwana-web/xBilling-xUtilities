import { Router } from "express";
import { integrations } from "../store.js";

export const integrationsRouter: Router = Router();

integrationsRouter.get("/", (req, res) => {
  const { category, status } = req.query;
  let result = integrations;
  if (category) result = result.filter((i) => i.category === category);
  if (status) result = result.filter((i) => i.status === status);
  res.json({ ok: true, data: result, meta: { service: "compliance-service", tookMs: 0 } });
});
