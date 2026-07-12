import { Router } from "express";
import { callerFrom, forbidForeignAccount, officialMunicipalityScope } from "../identity.js";
import { applyPaymentToInvoice, getInvoiceById, listInvoices } from "../repository.js";

export const invoicesRouter: Router = Router();

invoicesRouter.get("/", async (req, res) => {
  const caller = callerFrom(req);
  const scope = officialMunicipalityScope(req);
  const { accountNumber, status } = req.query;
  const result = await listInvoices({
    // Consumers always get their own invoices, whatever the query says.
    accountNumber:
      caller.role === "consumer" ? caller.accountNumber : typeof accountNumber === "string" ? accountNumber : undefined,
    status: typeof status === "string" ? status : undefined,
    // An official's own municipality always wins — the same boundary
    // already enforced on accounts and meters (this route was the one gap:
    // an official could otherwise read invoices for any citizen on the
    // platform, not just their own book).
    municipality: caller.role === "consumer" ? undefined : scope,
  });
  res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
});

invoicesRouter.get("/:id", async (req, res) => {
  const invoice = await getInvoiceById(req.params.id);
  if (!invoice) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Invoice not found" } });
    return;
  }
  if (forbidForeignAccount(req, res, invoice.accountNumber)) return;
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
