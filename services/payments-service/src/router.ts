import { Router } from "express";
import { methodsRouter } from "./routes/methods.js";
import { reconRouter } from "./routes/recon.js";
import { debicheckRouter } from "./routes/debicheck.js";
import { initiateRouter } from "./routes/initiate.js";

/**
 * Composed router for this domain, with no side effects (no app.listen()).
 * Used by services/cpanel-server to mount all domains under one process for
 * hosts that can't run 6 separate long-lived Node services (e.g. shared
 * cPanel hosting). `src/index.ts` still boots this service standalone for
 * environments (Railway, docker-compose) that can run it as its own process.
 */
export const paymentsRouter: Router = Router();
paymentsRouter.use("/methods", methodsRouter);
paymentsRouter.use("/recon", reconRouter);
paymentsRouter.use("/debicheck", debicheckRouter);
paymentsRouter.use("/initiate", initiateRouter);
