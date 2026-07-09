import { Router } from "express";
import { accountsRouter } from "./routes/accounts.js";
import { invoicesRouter } from "./routes/invoices.js";
import { billingRunsRouter } from "./routes/billingRuns.js";

/**
 * Composed router for this domain, with no side effects (no app.listen()).
 * Used by services/cpanel-server to mount all domains under one process for
 * hosts that can't run 6 separate long-lived Node services (e.g. shared
 * cPanel hosting). `src/index.ts` still boots this service standalone for
 * environments (Railway, docker-compose) that can run it as its own process.
 */
export const billingRouter: Router = Router();
billingRouter.use("/accounts", accountsRouter);
billingRouter.use("/invoices", invoicesRouter);
billingRouter.use("/billing-runs", billingRunsRouter);
