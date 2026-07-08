import { Router } from "express";
import { reconTransactions } from "../store.js";

export const reconRouter: Router = Router();

reconRouter.get("/", (_req, res) => {
  res.json({ ok: true, data: reconTransactions, meta: { service: "payments-service", tookMs: 0 } });
});

reconRouter.post("/:ref/resolve", (req, res) => {
  const tx = reconTransactions.find((t) => t.ref === req.params.ref);
  if (!tx) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Transaction not found" } });
    return;
  }
  tx.status = "matched";
  tx.erpStatus = "posted";
  res.json({ ok: true, data: tx, meta: { service: "payments-service", tookMs: 0 } });
});
