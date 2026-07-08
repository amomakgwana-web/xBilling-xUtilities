import { Router } from "express";
import type { BillingRun, Municipality } from "@xplatform/shared-types";
import { billingRuns, nextRunId } from "../store.js";

export const billingRunsRouter: Router = Router();

billingRunsRouter.get("/", (_req, res) => {
  res.json({ ok: true, data: billingRuns, meta: { service: "billing-service", tookMs: 0 } });
});

billingRunsRouter.post("/", (req, res) => {
  const municipality: Municipality = req.body?.municipality ?? "Tshwane";
  const billingPeriod = req.body?.billingPeriod ?? new Date().toISOString().slice(0, 7);
  const run: BillingRun = {
    id: nextRunId(municipality, billingPeriod),
    municipality,
    billingPeriod,
    startedAt: new Date().toISOString(),
    completedAt: null,
    accountsProcessed: 0,
    totalBilled: 0,
    status: "running",
  };
  billingRuns.unshift(run);

  // Simulate an async billing run completing shortly after.
  setTimeout(() => {
    run.completedAt = new Date().toISOString();
    run.accountsProcessed = Math.floor(40000 + Math.random() * 90000);
    run.totalBilled = Math.round(run.accountsProcessed * (1200 + Math.random() * 400));
    run.status = "completed";
  }, 4000);

  res.status(202).json({ ok: true, data: run, meta: { service: "billing-service", tookMs: 0 } });
});
