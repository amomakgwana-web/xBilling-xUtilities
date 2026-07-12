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

/** Never carries the secret itself — only its prefix, for telling keys apart
 * in a list. The full key is returned exactly once, from the create call. */
export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  revokedAt: z.string().optional(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const ApiKeyCreatedSchema = ApiKeySchema.extend({
  /** The plaintext secret — shown once, never persisted or returned again. */
  key: z.string(),
});
export type ApiKeyCreated = z.infer<typeof ApiKeyCreatedSchema>;
