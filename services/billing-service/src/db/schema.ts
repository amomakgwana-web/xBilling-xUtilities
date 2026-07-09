import { relations } from "drizzle-orm";
import { pgSchema, text, numeric, timestamp, date, integer, bigint } from "drizzle-orm/pg-core";

export const billingSchema = pgSchema("billing");

// numeric() columns are string-typed in this drizzle-orm version (avoids
// float precision loss); converted to/from number in repository.ts.
export const accounts = billingSchema.table("accounts", {
  id: text("id").primaryKey(),
  accountNumber: text("account_number").notNull().unique(),
  consumerName: text("consumer_name").notNull(),
  municipality: text("municipality").notNull(),
  erfNumber: text("erf_number"),
  balance: numeric("balance").notNull().default("0"),
  status: text("status").notNull(),
  tariffCode: text("tariff_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = billingSchema.table("invoices", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  accountNumber: text("account_number").notNull(),
  billingPeriod: text("billing_period").notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  totalAmount: numeric("total_amount").notNull(),
  amountPaid: numeric("amount_paid").notNull().default("0"),
  status: text("status").notNull(),
});

export const invoiceLines = billingSchema.table("invoice_lines", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  category: text("category").notNull(),
  quantity: numeric("quantity").notNull(),
  unitPrice: numeric("unit_price").notNull(),
  amount: numeric("amount").notNull(),
});

export const invoicesRelations = relations(invoices, ({ many }) => ({
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
}));

export const billingRuns = billingSchema.table("billing_runs", {
  id: text("id").primaryKey(),
  municipality: text("municipality").notNull(),
  billingPeriod: text("billing_period").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  accountsProcessed: integer("accounts_processed").notNull().default(0),
  totalBilled: numeric("total_billed").notNull().default("0"),
  status: text("status").notNull(),
});
