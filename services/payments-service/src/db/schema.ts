import { pgSchema, text, numeric, integer, timestamp, date } from "drizzle-orm/pg-core";

export const paymentsSchema = pgSchema("payments");

// numeric() columns are string-typed in this drizzle-orm version (avoids
// float precision loss); converted to/from number in repository.ts.
export const paymentMethods = paymentsSchema.table("payment_methods", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  txDay: integer("tx_day").notNull().default(0),
  revDay: numeric("rev_day").notNull().default("0"),
});

export const transactions = paymentsSchema.table("transactions", {
  ref: text("ref").primaryKey(),
  accountNumber: text("account_number").notNull(),
  consumerName: text("consumer_name").notNull(),
  amount: numeric("amount").notNull(),
  gateway: text("gateway").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull(),
  erpStatus: text("erp_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const debiCheckMandates = paymentsSchema.table("debicheck_mandates", {
  id: text("id").primaryKey(),
  accountNumber: text("account_number").notNull(),
  consumerName: text("consumer_name").notNull(),
  amount: numeric("amount").notNull(),
  collectionDay: integer("collection_day").notNull(),
  status: text("status").notNull(),
});

/**
 * Self-service instalment plan against an account's outstanding balance.
 * Auto-activated on creation — the platform has no approval-queue UI
 * anywhere else either (payments settle immediately, subsidy auto-computes),
 * so a pending-review step here would be a workflow this system can't
 * actually act on yet.
 */
export const paymentPlans = paymentsSchema.table("payment_plans", {
  id: text("id").primaryKey(),
  accountNumber: text("account_number").notNull(),
  consumerName: text("consumer_name").notNull(),
  totalAmount: numeric("total_amount").notNull(),
  installments: integer("installments").notNull(),
  installmentAmount: numeric("installment_amount").notNull(),
  startDate: date("start_date").notNull(),
  status: text("status").notNull(), // active | completed | cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
