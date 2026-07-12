import { z } from "zod";
import { StatusSchema } from "./common.js";

export const PaymentMethodIdSchema = z.enum([
  "eft",
  "card",
  "debi",
  "gpay",
  "apay",
  "samsung",
  "capitec",
  "wapay",
  "ussd",
]);
export type PaymentMethodId = z.infer<typeof PaymentMethodIdSchema>;

export const PaymentMethodSchema = z.object({
  id: PaymentMethodIdSchema,
  label: z.string(),
  provider: z.string(),
  status: StatusSchema,
  txDay: z.number(),
  revDay: z.number(),
});
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentTransactionSchema = z.object({
  ref: z.string(),
  accountNumber: z.string(),
  consumerName: z.string(),
  amount: z.number(),
  gateway: z.enum(["SwiftPay", "xPayments", "CapitecPay", "WhatsAppPay"]),
  method: PaymentMethodIdSchema,
  status: z.enum(["matched", "suspense", "failed"]),
  erpStatus: z.enum(["posted", "pending"]),
  createdAt: z.string(),
});
export type PaymentTransaction = z.infer<typeof PaymentTransactionSchema>;

export const DebiCheckMandateSchema = z.object({
  id: z.string(),
  accountNumber: z.string(),
  consumerName: z.string(),
  amount: z.number(),
  collectionDay: z.number(),
  status: z.enum(["active", "pending", "failed", "cancelled"]),
});
export type DebiCheckMandate = z.infer<typeof DebiCheckMandateSchema>;

export const PaymentInitiationRequestSchema = z.object({
  accountNumber: z.string(),
  amount: z.number().positive(),
  method: PaymentMethodIdSchema,
});
export type PaymentInitiationRequest = z.infer<typeof PaymentInitiationRequestSchema>;

export const PaymentPlanSchema = z.object({
  id: z.string(),
  accountNumber: z.string(),
  consumerName: z.string(),
  totalAmount: z.number(),
  installments: z.number(),
  installmentAmount: z.number(),
  startDate: z.string(),
  status: z.enum(["active", "completed", "cancelled"]),
  createdAt: z.string(),
});
export type PaymentPlan = z.infer<typeof PaymentPlanSchema>;
