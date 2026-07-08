import express from "express";
import cors from "cors";
import morgan from "morgan";
import { methodsRouter } from "./routes/methods.js";
import { reconRouter } from "./routes/recon.js";
import { debicheckRouter } from "./routes/debicheck.js";
import { initiateRouter } from "./routes/initiate.js";

// Load this service's .env (if present) before reading process.env below.
// Real deployments set these vars through the platform instead of a
// checked-in file, so a missing .env is not an error.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fall back to whatever the environment already provides
}

const app = express();
const port = Number(process.env.PORT ?? 4002);

app.use(cors({ origin: (process.env.CORS_ORIGIN ?? "*").split(",") }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, data: { service: "payments-service", status: "live" } });
});

app.use("/methods", methodsRouter);
app.use("/recon", reconRouter);
app.use("/debicheck", debicheckRouter);
app.use("/initiate", initiateRouter);

app.listen(port, () => {
  console.log(`[payments-service] listening on :${port}`);
});
