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
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Municipal tariff book — rates the billing engine applies per account.
 * Effective-dated: a code has one row per period it was in force, so a rate
 * change never rewrites the story of what an old invoice was actually
 * billed at. `validTo` null means "still in force".
 */
export const tariffs = billingSchema.table("tariffs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  electricityPerKwh: numeric("electricity_per_kwh").notNull(),
  waterPerKl: numeric("water_per_kl").notNull(),
  refuseMonthly: numeric("refuse_monthly").notNull(),
  sewerMonthly: numeric("sewer_monthly").notNull(),
  vatRate: numeric("vat_rate").notNull().default("0.15"),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
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

/**
 * One row per account. `accountNumber` is stored in full for the demo
 * payment simulation to key off of — a real deployment would tokenize this
 * at the payment processor and never persist a raw account number here.
 * The API layer masks it to the last 4 digits in every response.
 */
export const bankingDetails = billingSchema.table("banking_details", {
  accountId: text("account_id")
    .primaryKey()
    .references(() => accounts.id),
  bankName: text("bank_name").notNull(),
  accountHolder: text("account_holder").notNull(),
  accountNumber: text("account_number").notNull(),
  branchCode: text("branch_code").notNull(),
  accountType: text("account_type").notNull(), // cheque | savings
  debitDay: integer("debit_day").notNull(), // 1-31
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disputes = billingSchema.table("disputes", {
  id: text("id").primaryKey(),
  accountNumber: text("account_number").notNull(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(), // open | under_review | resolved | rejected
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

/**
 * Indigent subsidy is self-service and fully auto-computed against a
 * declared household income — see repository.ts for the tiers. There is no
 * approval workflow to build a reviewer screen for; officials get read-only
 * visibility into what was granted.
 */
export const subsidyApplications = billingSchema.table("subsidy_applications", {
  id: text("id").primaryKey(),
  accountNumber: text("account_number").notNull(),
  householdIncome: numeric("household_income").notNull(),
  householdSize: integer("household_size").notNull(),
  subsidyPercent: numeric("subsidy_percent").notNull(),
  status: text("status").notNull(), // approved | rejected
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

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
