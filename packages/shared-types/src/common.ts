import { z } from "zod";

export const MunicipalitySchema = z.enum([
  "Tshwane",
  "eThekwini",
  "CoJ",
  "Ekurhuleni",
]);
export type Municipality = z.infer<typeof MunicipalitySchema>;

export const StatusSchema = z.enum([
  "live",
  "matched",
  "posted",
  "completed",
  "delivered",
  "good",
  "normal",
  "approved",
  "active",
  "paid",
  "suspense",
  "pending",
  "running",
  "alert",
  "review",
  "scheduled",
  "queued",
  "fault",
  "failed",
  "overdue",
  "disconnected",
  "unpaid",
  "flagged",
  "draft",
  "connected",
]);
export type Status = z.infer<typeof StatusSchema>;

/** Envelope every service response is wrapped in, so the gateway and
 * frontends can rely on one shape regardless of which downstream answered. */
export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  meta?: {
    service: string;
    tookMs: number;
    mocked?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

export function ok<T>(data: T, meta?: ApiEnvelope<T>["meta"]): ApiEnvelope<T> {
  return { ok: true, data, meta };
}

export function fail(code: string, message: string): ApiEnvelope<null> {
  return { ok: false, data: null, error: { code, message } };
}
