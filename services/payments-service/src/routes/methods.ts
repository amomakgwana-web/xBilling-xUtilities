import { Router } from "express";
import { listPaymentMethods } from "../repository.js";

export const methodsRouter: Router = Router();

methodsRouter.get("/", async (_req, res) => {
  const methods = await listPaymentMethods();
  res.json({ ok: true, data: methods, meta: { service: "payments-service", tookMs: 0 } });
});
