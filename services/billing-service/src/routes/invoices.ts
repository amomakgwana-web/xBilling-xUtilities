import { Router } from "express";
import { applyPaymentToInvoice, getInvoiceById, listInvoices } from "../repository.js";

export const invoicesRouter: Router = Router();

invoicesRouter.get("/", async (req, res) => {
  const { accountNumber, status } = req.query;
  const result = await listInvoices({
    accountNumber: typeof accountNumber === "string" ? accountNumber : undefined,
    status: typeof status === "string" ? status : undefined,
  });
  res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
});

invoicesRouter.get("/:id", async (req, res) => {
  const invoice = await getInvoiceById(req.params.id);
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
invoicesRouter.post("/:id/apply-payment", async (req, res) => {
  const amount = Number(req.body?.amount ?? 0);
  const invoice = await applyPaymentToInvoice(req.params.id, amount);
  if (!invoice) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Invoice not found" } });
    return;
  }
  res.json({ ok: true, data: invoice, meta: { service: "billing-service", tookMs: 0 } });
});
