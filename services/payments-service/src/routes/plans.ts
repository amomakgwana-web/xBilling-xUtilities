import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { callerFrom, forbidForeignAccount } from "../identity.js";
import { createPaymentPlan, listPaymentPlans } from "../repository.js";

export const plansRouter: Router = Router();

plansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const caller = callerFrom(req);
    const { accountNumber } = req.query;
    const result = await listPaymentPlans({
      accountNumber: caller.role === "consumer" ? caller.accountNumber : typeof accountNumber === "string" ? accountNumber : undefined,
    });
    res.json({ ok: true, data: result, meta: { service: "payments-service", tookMs: 0 } });
  }),
);

plansRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { accountNumber, consumerName, totalAmount, installments } = req.body ?? {};
    if (!accountNumber || !consumerName || totalAmount === undefined || !installments) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "accountNumber, consumerName, totalAmount and installments are required" } });
      return;
    }
    if (forbidForeignAccount(req, res, accountNumber)) return;

    const amount = Number(totalAmount);
    const term = Number(installments);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(term) || term < 1) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "totalAmount must be > 0 and installments a positive integer" } });
      return;
    }

    const existing = await listPaymentPlans({ accountNumber });
    if (existing.some((p) => p.status === "active")) {
      res.status(409).json({ ok: false, data: null, error: { code: "PLAN_EXISTS", message: "An active payment plan already exists for this account" } });
      return;
    }

    const plan = await createPaymentPlan({ accountNumber, consumerName, totalAmount: amount, installments: term });
    res.status(201).json({ ok: true, data: plan, meta: { service: "payments-service", tookMs: 0 } });
  }),
);
