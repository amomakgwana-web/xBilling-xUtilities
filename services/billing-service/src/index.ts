import express from "express";
import cors from "cors";
import morgan from "morgan";
import { accountsRouter } from "./routes/accounts.js";
import { invoicesRouter } from "./routes/invoices.js";
import { billingRunsRouter } from "./routes/billingRuns.js";

// Load this service's .env (if present) before reading process.env below.
// Real deployments set these vars through the platform instead of a
// checked-in file, so a missing .env is not an error.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fall back to whatever the environment already provides
}

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

app.listen(port, () => {
  console.log(`[billing-service] listening on :${port}`);
});
