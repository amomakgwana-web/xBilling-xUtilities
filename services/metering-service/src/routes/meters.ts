import { Router } from "express";
import { MeterReadingIngestSchema, TokenVendRequestSchema } from "@xplatform/shared-types";
import { ConlogAdapter } from "@xplatform/integrations";
import { asyncHandler } from "../asyncHandler.js";
import { callerFrom, forbidConsumers, forbidForeignAccount, officialMunicipalityScope } from "../identity.js";
import {
  consumptionByMunicipality,
  getMeterBySerial,
  listMeters,
  listVendedTokens,
  recordVendedToken,
  updateMeterReading,
} from "../repository.js";

export const metersRouter: Router = Router();
const conlog = new ConlogAdapter();

metersRouter.get("/", async (req, res) => {
  const caller = callerFrom(req);
  const scope = officialMunicipalityScope(req);
  const { municipality, status } = req.query;
  const result = await listMeters({
    municipality: scope ?? (typeof municipality === "string" ? municipality : undefined),
    status: typeof status === "string" ? status : undefined,
  });
  // Consumers only ever see the meters on their own account.
  const visible = caller.role === "consumer" ? result.filter((m) => m.accountNumber === caller.accountNumber) : result;
  res.json({ ok: true, data: visible, meta: { service: "metering-service", tookMs: 0 } });
});

/** Consumption per meter for a billing run — staff/service only. */
metersRouter.get("/consumption", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const municipality = typeof req.query.municipality === "string" ? req.query.municipality : undefined;
  const result = await consumptionByMunicipality(municipality);
  res.json({ ok: true, data: result, meta: { service: "metering-service", tookMs: 0 } });
});

/** Prepaid token vend history — citizens see their own account only. */
metersRouter.get(
  "/vended-tokens",
  asyncHandler(async (req, res) => {
    const caller = callerFrom(req);
    const scope = officialMunicipalityScope(req);
    const { accountNumber } = req.query;
    const result = await listVendedTokens({
      accountNumber:
        caller.role === "consumer" ? caller.accountNumber : typeof accountNumber === "string" ? accountNumber : undefined,
      municipality: caller.role === "consumer" ? undefined : scope,
    });
    res.json({ ok: true, data: result, meta: { service: "metering-service", tookMs: 0 } });
  }),
);

metersRouter.post("/ingest", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const parsed = MeterReadingIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: parsed.error.message } });
    return;
  }
  const meter = await updateMeterReading(parsed.data.serial, parsed.data.reading, parsed.data.readAt);
  if (!meter) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Meter not found" } });
    return;
  }
  res.json({ ok: true, data: meter, meta: { service: "metering-service", tookMs: 0 } });
});

metersRouter.post("/vend-token", async (req, res) => {
  const parsed = TokenVendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: parsed.error.message } });
    return;
  }
  const meter = await getMeterBySerial(parsed.data.serial);
  if (!meter) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Meter not found" } });
    return;
  }
  if (forbidForeignAccount(req, res, meter.accountNumber)) return;
  const result = await conlog.vendToken(parsed.data);
  await recordVendedToken({
    meterId: meter.id,
    serial: meter.serial,
    accountNumber: meter.accountNumber,
    amount: parsed.data.amount,
    units: result.units,
    token: result.token,
  });
  res.json({ ok: true, data: result, meta: { service: "metering-service", tookMs: 0 } });
});
