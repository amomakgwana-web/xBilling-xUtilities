import { Router } from "express";
import { forbidConsumers } from "../identity.js";
import { listDebiCheckMandates } from "../repository.js";

export const debicheckRouter: Router = Router();

debicheckRouter.get("/mandates", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const mandates = await listDebiCheckMandates();
  res.json({ ok: true, data: mandates, meta: { service: "payments-service", tookMs: 0 } });
});
