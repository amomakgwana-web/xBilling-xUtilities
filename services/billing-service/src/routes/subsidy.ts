import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { callerFrom, forbidForeignAccount, officialMunicipalityScope } from "../identity.js";
import { applyForSubsidy, listSubsidyApplications } from "../repository.js";

export const subsidyRouter: Router = Router();

subsidyRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const caller = callerFrom(req);
    const scope = officialMunicipalityScope(req);
    const { accountNumber, municipality } = req.query;
    const result = await listSubsidyApplications({
      accountNumber:
        caller.role === "consumer" ? caller.accountNumber : typeof accountNumber === "string" ? accountNumber : undefined,
      municipality: caller.role === "consumer" ? undefined : (scope ?? (typeof municipality === "string" ? municipality : undefined)),
    });
    res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
  }),
);

subsidyRouter.post(
  "/apply",
  asyncHandler(async (req, res) => {
    const { accountNumber, householdIncome, householdSize } = req.body ?? {};
    if (!accountNumber || householdIncome === undefined || !householdSize) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "accountNumber, householdIncome and householdSize are required" } });
      return;
    }
    if (forbidForeignAccount(req, res, accountNumber)) return;

    const income = Number(householdIncome);
    const size = Number(householdSize);
    if (!Number.isFinite(income) || income < 0 || !Number.isInteger(size) || size < 1) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "householdIncome must be >= 0 and householdSize a positive integer" } });
      return;
    }

    const application = await applyForSubsidy({ accountNumber, householdIncome: income, householdSize: size });
    res.status(201).json({ ok: true, data: application, meta: { service: "billing-service", tookMs: 0 } });
  }),
);
