import { Router } from "express";
import { meterFaults, meters, nextFaultId } from "../store.js";

export const faultsRouter: Router = Router();

faultsRouter.get("/", (_req, res) => {
  res.json({ ok: true, data: meterFaults, meta: { service: "metering-service", tookMs: 0 } });
});

faultsRouter.post("/", (req, res) => {
  const { serial, description, severity } = req.body ?? {};
  const meter = meters.find((m) => m.serial === serial);
  if (!meter) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Meter not found" } });
    return;
  }
  const fault = {
    id: nextFaultId(),
    meterId: meter.id,
    serial: meter.serial,
    description: description ?? "Fault reported",
    severity: severity ?? "medium",
    status: "reported" as const,
    reportedAt: new Date().toISOString(),
  };
  meterFaults.unshift(fault);
  meter.status = "fault";
  res.status(201).json({ ok: true, data: fault, meta: { service: "metering-service", tookMs: 0 } });
});

faultsRouter.post("/:id/dispatch", (req, res) => {
  const fault = meterFaults.find((f) => f.id === req.params.id);
  if (!fault) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Fault not found" } });
    return;
  }
  fault.status = "dispatched";
  res.json({ ok: true, data: fault, meta: { service: "metering-service", tookMs: 0 } });
});

faultsRouter.post("/:id/resolve", (req, res) => {
  const fault = meterFaults.find((f) => f.id === req.params.id);
  if (!fault) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Fault not found" } });
    return;
  }
  fault.status = "resolved";
  const meter = meters.find((m) => m.id === fault.meterId);
  if (meter) meter.status = "normal";
  res.json({ ok: true, data: fault, meta: { service: "metering-service", tookMs: 0 } });
});
