import { Router } from "express";
import { listDebiCheckMandates } from "../repository.js";

export const debicheckRouter: Router = Router();

debicheckRouter.get("/mandates", async (_req, res) => {
  const mandates = await listDebiCheckMandates();
  res.json({ ok: true, data: mandates, meta: { service: "payments-service", tookMs: 0 } });
});
