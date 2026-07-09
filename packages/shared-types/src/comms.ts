import { z } from "zod";
import { MunicipalitySchema, StatusSchema } from "./common.js";

export const CampaignTypeSchema = z.enum(["SMS", "Email"]);
export type CampaignType = z.infer<typeof CampaignTypeSchema>;

export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: CampaignTypeSchema,
  status: StatusSchema,
  sent: z.number(),
  opened: z.number().nullable(),
  clicked: z.number(),
  paid: z.number(),
  unpaid: z.number(),
  createdAt: z.string(),
  municipality: z.union([MunicipalitySchema, z.literal("All")]),
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const ChatSessionSchema = z.object({
  id: z.string(),
  user: z.string(),
  accountNumber: z.string(),
  intent: z.enum([
    "payment_plan",
    "meter_fault",
    "dispute",
    "balance_query",
    "payment_options",
  ]),
  resolved: z.boolean(),
  escalated: z.boolean(),
  createdAt: z.string(),
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;
