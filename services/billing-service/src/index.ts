import express from "express";
import cors from "cors";
import morgan from "morgan";
import { accountsRouter } from "./routes/accounts.js";
import { invoicesRouter } from "./routes/invoices.js";
import { billingRunsRouter } from "./routes/billingRuns.js";
import { bankingRouter } from "./routes/banking.js";
import { disputesRouter } from "./routes/disputes.js";
import { subsidyRouter } from "./routes/subsidy.js";

const app = express();
const port = Number(process.env.PORT ?? 4001);

app.use(cors({ origin: (process.env.CORS_ORIGIN ?? "*").split(",") }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, data: { service: "billing-service", status: "live" } });
});

app.use("/accounts", accountsRouter);
app.use("/invoices", invoicesRouter);
app.use("/billing-runs", billingRunsRouter);
app.use("/banking", bankingRouter);
app.use("/disputes", disputesRouter);
app.use("/subsidy", subsidyRouter);

// Safety net: any error forwarded via next(err) — including from asyncHandler
// on every route above — lands here as a clean 500 instead of crashing the
// process, the same fix applied to the gateway after a real crash there.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[billing-service] unhandled route error:", err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, data: null, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  }
});

app.listen(port, () => {
  console.log(`[billing-service] listening on :${port}`);
});
