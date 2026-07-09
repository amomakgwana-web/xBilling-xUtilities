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

app.listen(port, () => {
  console.log(`[metering-service] listening on :${port}`);
});
