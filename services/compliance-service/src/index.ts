import express from "express";
import cors from "cors";
import morgan from "morgan";
import { integrationsRouter } from "./routes/integrations.js";
import { scoreRouter } from "./routes/score.js";
import { kycRouter } from "./routes/kyc.js";

const app = express();
const port = Number(process.env.PORT ?? 4005);

app.use(cors({ origin: (process.env.CORS_ORIGIN ?? "*").split(",") }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, data: { service: "compliance-service", status: "live" } });
});

app.use("/integrations", integrationsRouter);
app.use("/score", scoreRouter);
app.use("/kyc", kycRouter);

app.listen(port, () => {
  console.log(`[compliance-service] listening on :${port}`);
});
