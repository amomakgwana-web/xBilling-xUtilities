import { z } from "zod";
import { MunicipalitySchema, StatusSchema } from "./common.js";

export const MeterTypeSchema = z.enum(["prepaid_electricity", "conventional_electricity", "water"]);
export type MeterType = z.infer<typeof MeterTypeSchema>;

export const MeterSchema = z.object({
  id: z.string(),
  serial: z.string(),
  accountNumber: z.string(),
  municipality: MunicipalitySchema,
  type: MeterTypeSchema,
  lastReading: z.number(),
  lastReadingAt: z.string(),
  status: StatusSchema,
});
export type Meter = z.infer<typeof MeterSchema>;

export const MeterFaultSchema = z.object({
  id: z.string(),
  meterId: z.string(),
  serial: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  status: z.enum(["reported", "dispatched", "resolved"]),
  reportedAt: z.string(),
});
export type MeterFault = z.infer<typeof MeterFaultSchema>;

export const MeterReadingIngestSchema = z.object({
  serial: z.string(),
  reading: z.number(),
  readAt: z.string(),
});
export type MeterReadingIngest = z.infer<typeof MeterReadingIngestSchema>;

export const TokenVendRequestSchema = z.object({
  serial: z.string(),
  amount: z.number().positive(),
});
export type TokenVendRequest = z.infer<typeof TokenVendRequestSchema>;
