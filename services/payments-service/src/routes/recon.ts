import { Router } from "express";
import { listTransactions, resolveTransaction } from "../repository.js";

export const reconRouter: Router = Router();

reconRouter.get("/", async (_req, res) => {
  const transactions = await listTransactions();
  res.json({ ok: true, data: transactions, meta: { service: "payments-service", tookMs: 0 } });
});

reconRouter.post("/:ref/resolve", async (req, res) => {
  const tx = await resolveTransaction(req.params.ref);
  if (!tx) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Transaction not found" } });
    return;
  }
  res.json({ ok: true, data: tx, meta: { service: "payments-service", tookMs: 0 } });
});
