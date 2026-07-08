import { Router } from "express";
import { MeterReadingIngestSchema, TokenVendRequestSchema } from "@xplatform/shared-types";
import { ConlogAdapter } from "@xplatform/integrations";
import { meters } from "../store.js";

export const metersRouter: Router = Router();
const conlog = new ConlogAdapter();

metersRouter.get("/", (req, res) => {
  const { municipality, status } = req.query;
  let result = meters;
  if (municipality) result = result.filter((m) => m.municipality === municipality);
  if (status) result = result.filter((m) => m.status === status);
  res.json({ ok: true, data: result, meta: { service: "metering-service", tookMs: 0 } });
});

metersRouter.post("/ingest", (req, res) => {
  const parsed = MeterReadingIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: parsed.error.message } });
    return;
  }
  const meter = meters.find((m) => m.serial === parsed.data.serial);
  if (!meter) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Meter not found" } });
    return;
  }
  meter.lastReading = parsed.data.reading;
  meter.lastReadingAt = parsed.data.readAt;
  res.json({ ok: true, data: meter, meta: { service: "metering-service", tookMs: 0 } });
});

metersRouter.post("/vend-token", async (req, res) => {
  const parsed = TokenVendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: parsed.error.message } });
    return;
  }
  const result = await conlog.vendToken(parsed.data);
  res.json({ ok: true, data: result, meta: { service: "metering-service", tookMs: 0 } });
});
