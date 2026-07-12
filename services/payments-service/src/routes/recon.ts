import { Router } from "express";
import { forbidConsumers } from "../identity.js";
import { listTransactions, resolveTransaction } from "../repository.js";
import { applyPaymentToOldestInvoice } from "../billingClient.js";

export const reconRouter: Router = Router();

/**
 * Rule-based matching pass over suspense transactions: a suspense payment is
 * matched when its account has an open invoice to absorb it — the amount is
 * applied to the oldest unpaid invoice (over billing-service's HTTP API, the
 * same path a live settlement takes) and the transaction posts to the ERP.
 */
reconRouter.post("/run", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const transactions = await listTransactions();
  const suspense = transactions.filter((t) => t.status === "suspense");
  let matched = 0;
  for (const tx of suspense) {
    const applied = await applyPaymentToOldestInvoice(tx.accountNumber, tx.amount);
    if (applied) {
      await resolveTransaction(tx.ref);
      matched++;
    }
  }
  res.json({
    ok: true,
    data: { scanned: suspense.length, matched, remaining: suspense.length - matched },
    meta: { service: "payments-service", tookMs: 0 },
  });
});

reconRouter.get("/", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const transactions = await listTransactions();
  res.json({ ok: true, data: transactions, meta: { service: "payments-service", tookMs: 0 } });
});

reconRouter.post("/:ref/resolve", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const tx = await resolveTransaction(req.params.ref);
  if (!tx) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Transaction not found" } });
    return;
  }
  res.json({ ok: true, data: tx, meta: { service: "payments-service", tookMs: 0 } });
});
