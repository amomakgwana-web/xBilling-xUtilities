import express from "express";
import cors from "cors";
import morgan from "morgan";
import { campaignsRouter } from "./routes/campaigns.js";
import { chatbotRouter } from "./routes/chatbot.js";
import { insightRouter } from "./routes/insight.js";

// Load this service's .env (if present) before reading process.env below.
// Real deployments set these vars through the platform instead of a
// checked-in file, so a missing .env is not an error.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fall back to whatever the environment already provides
}

const app = express();
const port = Number(process.env.PORT ?? 4004);

app.use(cors({ origin: (process.env.CORS_ORIGIN ?? "*").split(",") }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, data: { service: "comms-service", status: "live" } });
});

app.use("/campaigns", campaignsRouter);
app.use("/chatbot", chatbotRouter);
app.use("/insight", insightRouter);

app.listen(port, () => {
  console.log(`[comms-service] listening on :${port}`);
});
