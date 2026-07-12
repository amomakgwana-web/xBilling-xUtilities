import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { forbidForeignAccount } from "../identity.js";
import { getBankingDetails, upsertBankingDetails } from "../repository.js";

function requireAccountNumber(req: Request, res: Response): string | undefined {
  const accountNumber = req.params.accountNumber;
  if (!accountNumber) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "accountNumber is required" } });
    return undefined;
  }
  return accountNumber;
}

export const bankingRouter: Router = Router();

// Banking details are citizen-only, own-account-only — no staff view exists
// for this data at all, not even for operators, since there's no operational
// reason for anyone but the account holder to see a bank account number.
bankingRouter.get("/:accountNumber", asyncHandler(async (req, res) => {
  const accountNumber = requireAccountNumber(req, res);
  if (!accountNumber) return;
  if (forbidForeignAccount(req, res, accountNumber)) return;
  const details = await getBankingDetails(accountNumber);
  if (!details) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "No banking details on file" } });
    return;
  }
  res.json({ ok: true, data: details, meta: { service: "billing-service", tookMs: 0 } });
}));

bankingRouter.put("/:accountNumber", asyncHandler(async (req, res) => {
  const accountNumber = requireAccountNumber(req, res);
  if (!accountNumber) return;
  if (forbidForeignAccount(req, res, accountNumber)) return;

  const { bankName, accountHolder, accountNumber: bankAccountNumber, branchCode, accountType, debitDay } = req.body ?? {};
  if (!bankName || !accountHolder || !branchCode || !accountType || !debitDay) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "bankName, accountHolder, branchCode, accountType and debitDay are required" } });
    return;
  }
  if (!["cheque", "savings"].includes(accountType)) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "accountType must be cheque or savings" } });
    return;
  }
  const day = Number(debitDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "debitDay must be 1-31" } });
    return;
  }
  if (!bankAccountNumber) {
    const existing = await getBankingDetails(accountNumber);
    if (!existing) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "accountNumber is required for a first-time save" } });
      return;
    }
  }

  const details = await upsertBankingDetails(accountNumber, {
    bankName,
    accountHolder,
    accountNumber: bankAccountNumber || undefined,
    branchCode,
    accountType,
    debitDay: day,
  });
  if (!details) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Account not found" } });
    return;
  }
  res.json({ ok: true, data: details, meta: { service: "billing-service", tookMs: 0 } });
}));
