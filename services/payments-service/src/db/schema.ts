import { pgSchema, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";

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
