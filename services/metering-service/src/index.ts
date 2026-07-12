import express from "express";
import cors from "cors";
import morgan from "morgan";
import { metersRouter } from "./routes/meters.js";
import { faultsRouter } from "./routes/faults.js";

const app = express();
const port = Number(process.env.PORT ?? 4003);

app.use(cors({ origin: (process.env.CORS_ORIGIN ?? "*").split(",") }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, data: { service: "metering-service", status: "live" } });
});

app.use("/meters", metersRouter);
app.use("/faults", faultsRouter);

// Safety net: any error forwarded via next(err) — including from asyncHandler
// on the vended-tokens route — lands here as a clean 500 instead of crashing
// the process, the same fix applied to the gateway, billing-service and
// payments-service.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[metering-service] unhandled route error:", err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, data: null, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  }
});

app.listen(port, () => {
  console.log(`[metering-service] listening on :${port}`);
});
