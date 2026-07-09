import { Router } from "express";
import { integrationsRouter } from "./routes/integrations.js";
import { scoreRouter } from "./routes/score.js";
import { kycRouter } from "./routes/kyc.js";

/**
 * Composed router for this domain, with no side effects (no app.listen()).
 * Used by services/cpanel-server to mount all domains under one process for
 * hosts that can't run 6 separate long-lived Node services (e.g. shared
 * cPanel hosting). `src/index.ts` still boots this service standalone for
 * environments (Railway, docker-compose) that can run it as its own process.
 */
export const complianceRouter: Router = Router();
complianceRouter.use("/integrations", integrationsRouter);
complianceRouter.use("/score", scoreRouter);
complianceRouter.use("/kyc", kycRouter);
