import { Router } from "express";
import { createFault, dispatchFault, listFaults, resolveFault } from "../repository.js";

export const faultsRouter: Router = Router();

faultsRouter.get("/", async (_req, res) => {
  const faults = await listFaults();
  res.json({ ok: true, data: faults, meta: { service: "metering-service", tookMs: 0 } });
});

faultsRouter.post("/", async (req, res) => {
  const { serial, description, severity } = req.body ?? {};
  const fault = await createFault({
    serial,
    description: description ?? "Fault reported",
    severity: severity ?? "medium",
  });
  if (!fault) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Meter not found" } });
    return;
  }
  res.status(201).json({ ok: true, data: fault, meta: { service: "metering-service", tookMs: 0 } });
});

faultsRouter.post("/:id/dispatch", async (req, res) => {
  const fault = await dispatchFault(req.params.id);
  if (!fault) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Fault not found" } });
    return;
  }
  res.json({ ok: true, data: fault, meta: { service: "metering-service", tookMs: 0 } });
});

faultsRouter.post("/:id/resolve", async (req, res) => {
  const fault = await resolveFault(req.params.id);
  if (!fault) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Fault not found" } });
    return;
  }
  res.json({ ok: true, data: fault, meta: { service: "metering-service", tookMs: 0 } });
});
