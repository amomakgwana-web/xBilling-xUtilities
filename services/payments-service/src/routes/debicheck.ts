import { Router } from "express";
import { debiCheckMandates } from "../store.js";

export const debicheckRouter: Router = Router();

debicheckRouter.get("/mandates", (_req, res) => {
  res.json({ ok: true, data: debiCheckMandates, meta: { service: "payments-service", tookMs: 0 } });
});
