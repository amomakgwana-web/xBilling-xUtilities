import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { callerFrom, forbidConsumers, forbidForeignAccount, officialMunicipalityScope } from "../identity.js";
import { createDispute, getAccountByNumber, getDisputeById, getInvoiceById, listDisputes, resolveDispute } from "../repository.js";

export const disputesRouter: Router = Router();

disputesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const caller = callerFrom(req);
    const scope = officialMunicipalityScope(req);
    const { accountNumber, municipality } = req.query;
    const result = await listDisputes({
      accountNumber:
        caller.role === "consumer" ? caller.accountNumber : typeof accountNumber === "string" ? accountNumber : undefined,
      municipality: caller.role === "consumer" ? undefined : (scope ?? (typeof municipality === "string" ? municipality : undefined)),
    });
    res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
  }),
);

disputesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { accountNumber, invoiceId, reason, description } = req.body ?? {};
    if (!accountNumber || !invoiceId || !reason || !description) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "accountNumber, invoiceId, reason and description are required" } });
      return;
    }
    if (forbidForeignAccount(req, res, accountNumber)) return;

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice || invoice.accountNumber !== accountNumber) {
      res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Invoice not found on this account" } });
      return;
    }

    const dispute = await createDispute({ accountNumber, invoiceId, reason, description });
    res.status(201).json({ ok: true, data: dispute, meta: { service: "billing-service", tookMs: 0 } });
  }),
);

disputesRouter.post(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    if (forbidConsumers(req, res)) return;
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "id is required" } });
      return;
    }
    const { status, resolutionNote } = req.body ?? {};
    if (!["resolved", "rejected"].includes(status) || !resolutionNote) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "status (resolved|rejected) and resolutionNote are required" } });
      return;
    }

    const dispute = await getDisputeById(id);
    if (!dispute) {
      res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Dispute not found" } });
      return;
    }

    const scope = officialMunicipalityScope(req);
    if (scope) {
      const account = await getAccountByNumber(dispute.accountNumber);
      if (!account || account.municipality !== scope) {
        res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: "This dispute belongs to another municipality" } });
        return;
      }
    }

    const updated = await resolveDispute(id, { status, resolutionNote });
    res.json({ ok: true, data: updated, meta: { service: "billing-service", tookMs: 0 } });
  }),
);
