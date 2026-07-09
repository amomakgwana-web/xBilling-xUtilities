import { Router } from "express";
import { campaignsRouter } from "./routes/campaigns.js";
import { chatbotRouter } from "./routes/chatbot.js";
import { insightRouter } from "./routes/insight.js";

/**
 * Composed router for this domain, with no side effects (no app.listen()).
 * Used by services/cpanel-server to mount all domains under one process for
 * hosts that can't run 6 separate long-lived Node services (e.g. shared
 * cPanel hosting). `src/index.ts` still boots this service standalone for
 * environments (Railway, docker-compose) that can run it as its own process.
 */
export const commsRouter: Router = Router();
commsRouter.use("/campaigns", campaignsRouter);
commsRouter.use("/chatbot", chatbotRouter);
commsRouter.use("/insight", insightRouter);
