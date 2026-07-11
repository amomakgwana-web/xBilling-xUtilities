import { z } from "zod";
import { MunicipalitySchema, StatusSchema } from "./common.js";

export const AccountSchema = z.object({
  id: z.string(),
  accountNumber: z.string(),
  consumerName: z.string(),
  municipality: MunicipalitySchema,
  erfNumber: z.string().optional(),
  balance: z.number(),
  status: StatusSchema,
  tariffCode: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  createdAt: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

export const TariffSchema = z.object({
  code: z.string(),
  description: z.string(),
  electricityPerKwh: z.number(),
  waterPerKl: z.number(),
  refuseMonthly: z.number(),
  sewerMonthly: z.number(),
  vatRate: z.number(),
});
export type Tariff = z.infer<typeof TariffSchema>;

export const InvoiceLineSchema = z.object({
  description: z.string(),
  category: z.enum(["water", "electricity", "sewer", "refuse", "rates", "levy", "other"]),
  quantity: z.number(),
  unitPrice: z.number(),
  amount: z.number(),
});
export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;

export const InvoiceSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountNumber: z.string(),
  billingPeriod: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  lines: z.array(InvoiceLineSchema),
  totalAmount: z.number(),
  amountPaid: z.number(),
  status: StatusSchema,
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const BillingRunSchema = z.object({
  id: z.string(),
  municipality: MunicipalitySchema,
  billingPeriod: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  accountsProcessed: z.number(),
  totalBilled: z.number(),
  status: StatusSchema,
});
export type BillingRun = z.infer<typeof BillingRunSchema>;
