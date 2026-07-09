import { Router } from "express";
import { MeterReadingIngestSchema, TokenVendRequestSchema } from "@xplatform/shared-types";
import { ConlogAdapter } from "@xplatform/integrations";
import { getMeterBySerial, listMeters, updateMeterReading } from "../repository.js";

export const metersRouter: Router = Router();
const conlog = new ConlogAdapter();

metersRouter.get("/", async (req, res) => {
  const { municipality, status } = req.query;
  const result = await listMeters({
    municipality: typeof municipality === "string" ? municipality : undefined,
    status: typeof status === "string" ? status : undefined,
  });
  res.json({ ok: true, data: result, meta: { service: "metering-service", tookMs: 0 } });
});

metersRouter.post("/ingest", async (req, res) => {
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
  const result = await conlog.vendToken(parsed.data);
  res.json({ ok: true, data: result, meta: { service: "metering-service", tookMs: 0 } });
});
