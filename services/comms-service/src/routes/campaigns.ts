import { Router } from "express";
import type { Campaign } from "@xplatform/shared-types";
import { MacroCommAdapter } from "@xplatform/integrations";
import { campaigns, nextCampaignId } from "../store.js";

export const campaignsRouter: Router = Router();
const macrocomm = new MacroCommAdapter();

campaignsRouter.get("/", (_req, res) => {
  res.json({ ok: true, data: campaigns, meta: { service: "comms-service", tookMs: 0 } });
});

campaignsRouter.post("/", async (req, res) => {
  const { name, type, municipality, recipients = [] } = req.body ?? {};
  if (!name || !type) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "name and type are required" } });
    return;
  }

  const campaign: Campaign = {
    id: nextCampaignId(),
    name,
    type,
    status: "scheduled",
    sent: 0,
    opened: type === "Email" ? 0 : null,
    clicked: 0,
    paid: 0,
    unpaid: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    municipality: municipality ?? "All",
  };
  campaigns.unshift(campaign);

  if (recipients.length > 0) {
    const batch =
      type === "SMS"
        ? await macrocomm.sendBulkSms(recipients, req.body?.message ?? "")
        : await macrocomm.sendBulkEmail(recipients, req.body?.subject ?? "", req.body?.html ?? "");
    campaign.status = "running";
    campaign.sent = batch.queued;
  }

  res.status(201).json({ ok: true, data: campaign, meta: { service: "comms-service", tookMs: 0 } });
});
