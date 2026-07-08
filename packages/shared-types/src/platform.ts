import { z } from "zod";

export const ServiceHealthSchema = z.object({
  name: z.string(),
  url: z.string(),
  status: z.enum(["live", "degraded", "down"]),
  uptime: z.string(),
  latencyMs: z.number().optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const PlatformStatusSchema = z.object({
  services: z.array(ServiceHealthSchema),
  checkedAt: z.string(),
});
export type PlatformStatus = z.infer<typeof PlatformStatusSchema>;
