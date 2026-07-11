import { Router } from "express";
import type { BillingRun, Invoice, Municipality } from "@xplatform/shared-types";
import { forbidConsumers } from "../identity.js";
import {
  completeBillingRun,
  createBillingRun,
  createInvoiceWithLines,
  getTariff,
  listAccounts,
  listBillingRuns,
  listInvoices,
  nextRunId,
} from "../repository.js";

export const billingRunsRouter: Router = Router();

const METERING_URL = process.env.METERING_SERVICE_URL ?? "http://localhost:4003";

interface MeterConsumption {
  serial: string;
  accountNumber: string;
  type: string;
  consumption: number;
}

billingRunsRouter.get("/", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const runs = await listBillingRuns();
  res.json({ ok: true, data: runs, meta: { service: "billing-service", tookMs: 0 } });
});

/**
 * The real billing engine: pulls per-meter consumption from metering-service
 * (delta of the two most recent readings), prices it with the account's
 * tariff, adds fixed refuse/sewer charges and 15% VAT, and writes the
 * invoice + lines + balance in one transaction per account. Accounts already
 * invoiced for the period are skipped, so a re-run cannot double-bill.
 */
billingRunsRouter.post("/", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const municipality: Municipality = req.body?.municipality ?? "Tshwane";
  const billingPeriod: string = req.body?.billingPeriod ?? new Date().toISOString().slice(0, 7);

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

  try {
    const [accounts, consumptionRes] = await Promise.all([
      listAccounts({ municipality }),
      fetch(`${METERING_URL}/meters/consumption?municipality=${encodeURIComponent(municipality)}`).then(
        (r) => r.json() as Promise<{ ok: boolean; data: MeterConsumption[] }>,
      ),
    ]);
    const consumption = consumptionRes.ok ? consumptionRes.data : [];

    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 24 * 86_400_000).toISOString().slice(0, 10);
    let accountsProcessed = 0;
    let totalBilled = 0;

    for (const account of accounts) {
      const existing = await listInvoices({ accountNumber: account.accountNumber });
      if (existing.some((inv) => inv.billingPeriod === billingPeriod)) continue;

      const tariff = await getTariff(account.tariffCode);
      if (!tariff) continue;

      const lines: Invoice["lines"] = [];
      for (const mc of consumption.filter((c) => c.accountNumber === account.accountNumber)) {
        if (mc.consumption <= 0) continue;
        if (mc.type === "water") {
          lines.push({
            description: `Water consumption (${mc.serial})`,
            category: "water",
            quantity: mc.consumption,
            unitPrice: tariff.waterPerKl,
            amount: round2(mc.consumption * tariff.waterPerKl),
          });
        } else {
          // Prepaid electricity is paid at vend time; only conventional
          // meters are billed on the statement.
          if (mc.type === "prepaid_electricity") continue;
          lines.push({
            description: `Electricity consumption (${mc.serial})`,
            category: "electricity",
            quantity: mc.consumption,
            unitPrice: tariff.electricityPerKwh,
            amount: round2(mc.consumption * tariff.electricityPerKwh),
          });
        }
      }
      lines.push({ description: "Refuse removal", category: "refuse", quantity: 1, unitPrice: tariff.refuseMonthly, amount: tariff.refuseMonthly });
      lines.push({ description: "Sewerage", category: "sewer", quantity: 1, unitPrice: tariff.sewerMonthly, amount: tariff.sewerMonthly });

      const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
      const vat = round2(subtotal * tariff.vatRate);
      lines.push({ description: `VAT @ ${Math.round(tariff.vatRate * 100)}%`, category: "other", quantity: 1, unitPrice: vat, amount: vat });
      const total = round2(subtotal + vat);

      await createInvoiceWithLines(
        {
          id: `INV-${billingPeriod}-${account.accountNumber}`,
          accountId: account.id,
          accountNumber: account.accountNumber,
          billingPeriod,
          issueDate,
          dueDate,
          totalAmount: total,
          amountPaid: 0,
          status: "pending",
        },
        lines,
      );
      accountsProcessed++;
      totalBilled = round2(totalBilled + total);
    }

    await completeBillingRun(run.id, {
      completedAt: new Date().toISOString(),
      accountsProcessed,
      totalBilled,
      status: "completed",
    });

    res.status(201).json({
      ok: true,
      data: { ...run, completedAt: new Date().toISOString(), accountsProcessed, totalBilled, status: "completed" },
      meta: { service: "billing-service", tookMs: 0 },
    });
  } catch (err) {
    await completeBillingRun(run.id, {
      completedAt: new Date().toISOString(),
      accountsProcessed: 0,
      totalBilled: 0,
      status: "failed",
    });
    res.status(502).json({
      ok: false,
      data: null,
      error: { code: "BILLING_RUN_FAILED", message: err instanceof Error ? err.message : "Billing run failed" },
    });
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
