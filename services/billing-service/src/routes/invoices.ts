import { Router } from "express";
import { accounts, invoices } from "../store.js";

export const invoicesRouter: Router = Router();

invoicesRouter.get("/", (req, res) => {
  const { accountNumber, status } = req.query;
  let result = invoices;
  if (accountNumber) result = result.filter((i) => i.accountNumber === accountNumber);
  if (status) result = result.filter((i) => i.status === status);
  res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
});

invoicesRouter.get("/:id", (req, res) => {
  const invoice = invoices.find((i) => i.id === req.params.id);
  if (!invoice) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Invoice not found" } });
    return;
  }
  res.json({ ok: true, data: invoice, meta: { service: "billing-service", tookMs: 0 } });
});

/**
 * Called by payments-service (or the gateway on its behalf) once a payment
 * settles, so the ledger reflects reality without the two services sharing
 * a database.
 */
invoicesRouter.post("/:id/apply-payment", (req, res) => {
  const invoice = invoices.find((i) => i.id === req.params.id);
  if (!invoice) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Invoice not found" } });
    return;
  }
  const amount = Number(req.body?.amount ?? 0);
  invoice.amountPaid = Math.min(invoice.totalAmount, invoice.amountPaid + amount);
  invoice.status = invoice.amountPaid >= invoice.totalAmount ? "paid" : "pending";

  const account = accounts.find((a) => a.accountNumber === invoice.accountNumber);
  if (account) {
    account.balance = Math.max(0, account.balance - amount);
    account.status = account.balance === 0 ? "paid" : "pending";
  }

  res.json({ ok: true, data: invoice, meta: { service: "billing-service", tookMs: 0 } });
});
