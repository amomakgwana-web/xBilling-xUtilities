import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { forbidNonOperators } from "../identity.js";
import { createTariff, listTariffs } from "../repository.js";

export const tariffsRouter: Router = Router();

// The tariff book applies across every municipality — officials read it
// (their accounts' invoices depend on it) but only operators may change it.
tariffsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await listTariffs();
    res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
  }),
);

tariffsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (forbidNonOperators(req, res)) return;

    const { code, description, electricityPerKwh, waterPerKl, refuseMonthly, sewerMonthly, vatRate, validFrom } = req.body ?? {};
    if (!code || !description || !validFrom) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "code, description and validFrom are required" } });
      return;
    }
    const numbers = { electricityPerKwh, waterPerKl, refuseMonthly, sewerMonthly, vatRate: vatRate ?? 0.15 };
    for (const [key, value] of Object.entries(numbers)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: `${key} must be a non-negative number` } });
        return;
      }
    }
    if (Number.isNaN(Date.parse(validFrom))) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "validFrom must be a valid date" } });
      return;
    }

    const tariff = await createTariff({ code, description, validFrom, ...numbers });
    res.status(201).json({ ok: true, data: tariff, meta: { service: "billing-service", tookMs: 0 } });
  }),
);
