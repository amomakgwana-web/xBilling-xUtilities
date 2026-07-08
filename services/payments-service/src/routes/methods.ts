import { Router } from "express";
import { paymentMethods } from "../store.js";

export const methodsRouter: Router = Router();

methodsRouter.get("/", (_req, res) => {
  res.json({ ok: true, data: paymentMethods, meta: { service: "payments-service", tookMs: 0 } });
});
