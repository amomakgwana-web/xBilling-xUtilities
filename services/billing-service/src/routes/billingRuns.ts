import { Router } from "express";
import type { BillingRun, Municipality } from "@xplatform/shared-types";
import { completeBillingRun, createBillingRun, listBillingRuns, nextRunId } from "../repository.js";

export const billingRunsRouter: Router = Router();

billingRunsRouter.get("/", async (_req, res) => {
  const runs = await listBillingRuns();
  res.json({ ok: true, data: runs, meta: { service: "billing-service", tookMs: 0 } });
});

billingRunsRouter.post("/", async (req, res) => {
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
  await createBillingRun(run);

  // Simulate an async billing run completing shortly after.
  setTimeout(() => {
    const accountsProcessed = Math.floor(40000 + Math.random() * 90000);
    const totalBilled = Math.round(accountsProcessed * (1200 + Math.random() * 400));
    completeBillingRun(run.id, {
      completedAt: new Date().toISOString(),
      accountsProcessed,
      totalBilled,
      status: "completed",
    }).catch((err) => console.error("[billing-service] failed to complete billing run", err));
  }, 4000);

  res.status(202).json({ ok: true, data: run, meta: { service: "billing-service", tookMs: 0 } });
});
