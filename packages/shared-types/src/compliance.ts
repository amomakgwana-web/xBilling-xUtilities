import { z } from "zod";
import { StatusSchema } from "./common.js";

export const IntegrationCategorySchema = z.enum([
  "Metering",
  "Compliance",
  "Comms",
  "Finance",
  "Payments",
  "Identity",
  "Credit",
  "Infra",
]);
export type IntegrationCategory = z.infer<typeof IntegrationCategorySchema>;

export const IntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: IntegrationCategorySchema,
  status: StatusSchema,
  endpoint: z.string(),
  description: z.string(),
});
export type Integration = z.infer<typeof IntegrationSchema>;

export const KycCheckSchema = z.object({
  provider: z.enum(["HANIS", "SARS", "TransUnion", "DeedsRegistry"]),
  idNumber: z.string(),
  result: z.enum(["verified", "flagged", "not_found"]),
  checkedAt: z.string(),
});
export type KycCheck = z.infer<typeof KycCheckSchema>;

export const ComplianceScoreSchema = z.object({
  score: z.number().min(0).max(100),
  frameworks: z.array(
    z.object({
      name: z.enum(["ISO27001", "POPIA", "PCI-DSS"]),
      status: z.enum(["compliant", "in_progress", "non_compliant"]),
      lastAuditedAt: z.string(),
    }),
  ),
});
export type ComplianceScore = z.infer<typeof ComplianceScoreSchema>;
