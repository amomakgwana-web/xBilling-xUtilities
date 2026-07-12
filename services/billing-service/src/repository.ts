import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type {
  Account,
  BankingDetails,
  BillingRun,
  Dispute,
  Invoice,
  Municipality,
  SubsidyApplication,
  Tariff,
} from "@xplatform/shared-types";
import { db } from "./db/client.js";
import {
  accounts,
  bankingDetails,
  billingRuns,
  disputes,
  invoiceLines,
  invoices,
  subsidyApplications,
  tariffs,
} from "./db/schema.js";

type AccountRow = typeof accounts.$inferSelect;
type BillingRunRow = typeof billingRuns.$inferSelect;
type InvoiceWithLines = typeof invoices.$inferSelect & {
  lines: (typeof import("./db/schema.js").invoiceLines.$inferSelect)[];
};

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    consumerName: row.consumerName,
    municipality: row.municipality as Municipality,
    erfNumber: row.erfNumber ?? undefined,
    balance: Number(row.balance),
    status: row.status as Account["status"],
    tariffCode: row.tariffCode,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toInvoice(row: InvoiceWithLines): Invoice {
  return {
    id: row.id,
    accountId: row.accountId,
    accountNumber: row.accountNumber,
    billingPeriod: row.billingPeriod,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    totalAmount: Number(row.totalAmount),
    amountPaid: Number(row.amountPaid),
    status: row.status as Invoice["status"],
    lines: row.lines.map((l) => ({
      description: l.description,
      category: l.category as Invoice["lines"][number]["category"],
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
    })),
  };
}

function toBillingRun(row: BillingRunRow): BillingRun {
  return {
    id: row.id,
    municipality: row.municipality as Municipality,
    billingPeriod: row.billingPeriod,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    accountsProcessed: row.accountsProcessed,
    totalBilled: Number(row.totalBilled),
    status: row.status as BillingRun["status"],
  };
}

export async function listAccounts(filters: { municipality?: string; status?: string }): Promise<Account[]> {
  const conditions = [];
  if (filters.municipality) conditions.push(eq(accounts.municipality, filters.municipality));
  if (filters.status) conditions.push(eq(accounts.status, filters.status));
  const rows = await db
    .select()
    .from(accounts)
    .where(conditions.length ? and(...conditions) : undefined);
  return rows.map(toAccount);
}

export async function getAccountByNumber(accountNumber: string): Promise<Account | null> {
  const rows = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber)).limit(1);
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function adjustAccountBalance(accountNumber: string, delta: number): Promise<void> {
  const account = await getAccountByNumber(accountNumber);
  if (!account) return;
  const balance = Math.max(0, account.balance - delta);
  await db
    .update(accounts)
    .set({ balance: String(balance), status: balance === 0 ? "paid" : "pending" })
    .where(eq(accounts.accountNumber, accountNumber));
}

export async function listInvoices(filters: { accountNumber?: string; status?: string }): Promise<Invoice[]> {
  const conditions = [];
  if (filters.accountNumber) conditions.push(eq(invoices.accountNumber, filters.accountNumber));
  if (filters.status) conditions.push(eq(invoices.status, filters.status));
  const rows = await db.query.invoices.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: { lines: true },
  });
  return rows.map(toInvoice);
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const row = await db.query.invoices.findFirst({ where: eq(invoices.id, id), with: { lines: true } });
  return row ? toInvoice(row) : null;
}

export async function applyPaymentToInvoice(id: string, amount: number): Promise<Invoice | null> {
  const invoice = await getInvoiceById(id);
  if (!invoice) return null;

  const amountPaid = Math.min(invoice.totalAmount, invoice.amountPaid + amount);
  const status = amountPaid >= invoice.totalAmount ? "paid" : "pending";
  await db.update(invoices).set({ amountPaid: String(amountPaid), status }).where(eq(invoices.id, id));
  await adjustAccountBalance(invoice.accountNumber, amount);

  return getInvoiceById(id);
}

/** The tariff row for `code` that was actually in force on `onDate` (YYYY-MM-DD). */
export async function getTariff(code: string, onDate: string): Promise<Tariff | null> {
  const rows = await db
    .select()
    .from(tariffs)
    .where(
      and(
        eq(tariffs.code, code),
        lte(tariffs.validFrom, onDate),
        or(isNull(tariffs.validTo), gte(tariffs.validTo, onDate)),
      ),
    )
    .orderBy(desc(tariffs.validFrom))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    code: row.code,
    description: row.description,
    electricityPerKwh: Number(row.electricityPerKwh),
    waterPerKl: Number(row.waterPerKl),
    refuseMonthly: Number(row.refuseMonthly),
    sewerMonthly: Number(row.sewerMonthly),
    vatRate: Number(row.vatRate),
    validFrom: row.validFrom,
    validTo: row.validTo ?? undefined,
  };
}

/** Invoice + lines + balance increase, atomically — one billed account per transaction. */
export async function createInvoiceWithLines(
  invoice: Omit<Invoice, "lines">,
  lines: Invoice["lines"],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoice.id,
      accountId: invoice.accountId,
      accountNumber: invoice.accountNumber,
      billingPeriod: invoice.billingPeriod,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      totalAmount: String(invoice.totalAmount),
      amountPaid: String(invoice.amountPaid),
      status: invoice.status,
    });
    if (lines.length) {
      await tx.insert(invoiceLines).values(
        lines.map((l) => ({
          invoiceId: invoice.id,
          description: l.description,
          category: l.category,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          amount: String(l.amount),
        })),
      );
    }
    const accountRows = await tx.select().from(accounts).where(eq(accounts.accountNumber, invoice.accountNumber)).limit(1);
    if (accountRows[0]) {
      const balance = Number(accountRows[0].balance) + invoice.totalAmount;
      await tx
        .update(accounts)
        .set({ balance: String(balance), status: balance > 0 ? "pending" : accountRows[0].status })
        .where(eq(accounts.accountNumber, invoice.accountNumber));
    }
  });
}

export async function listBillingRuns(): Promise<BillingRun[]> {
  const rows = await db.select().from(billingRuns).orderBy(billingRuns.startedAt);
  return rows.map(toBillingRun).reverse();
}

let runSeq = 100;
export function nextRunId(municipality: string, billingPeriod: string): string {
  const n = runSeq++;
  return `BJ-${billingPeriod}-${String(n).padStart(3, "0")}-${municipality.slice(0, 3).toUpperCase()}`;
}

export async function createBillingRun(run: BillingRun): Promise<void> {
  await db.insert(billingRuns).values({
    id: run.id,
    municipality: run.municipality,
    billingPeriod: run.billingPeriod,
    startedAt: new Date(run.startedAt),
    completedAt: run.completedAt ? new Date(run.completedAt) : null,
    accountsProcessed: run.accountsProcessed,
    totalBilled: String(run.totalBilled),
    status: run.status,
  });
}

export async function completeBillingRun(
  id: string,
  update: { completedAt: string; accountsProcessed: number; totalBilled: number; status: BillingRun["status"] },
): Promise<void> {
  await db
    .update(billingRuns)
    .set({
      completedAt: new Date(update.completedAt),
      accountsProcessed: update.accountsProcessed,
      totalBilled: String(update.totalBilled),
      status: update.status,
    })
    .where(eq(billingRuns.id, id));
}

function maskAccountNumber(raw: string): string {
  return raw.length <= 4 ? raw : `••••${raw.slice(-4)}`;
}

function toBankingDetails(row: typeof bankingDetails.$inferSelect, accountNumber: string): BankingDetails {
  return {
    accountNumber,
    bankName: row.bankName,
    accountHolder: row.accountHolder,
    maskedAccountNumber: maskAccountNumber(row.accountNumber),
    branchCode: row.branchCode,
    accountType: row.accountType as BankingDetails["accountType"],
    debitDay: row.debitDay,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getBankingDetails(accountNumber: string): Promise<BankingDetails | null> {
  const account = await getAccountByNumber(accountNumber);
  if (!account) return null;
  const rows = await db.select().from(bankingDetails).where(eq(bankingDetails.accountId, account.id)).limit(1);
  return rows[0] ? toBankingDetails(rows[0], accountNumber) : null;
}

/**
 * `input.accountNumber` (the bank account number) is optional so the "keep
 * my existing bank account, just update the branch code" edit path doesn't
 * force the citizen to retype a number the API never echoes back in full.
 * Omitting it on a first-time save is rejected by the route before this is
 * called, since there's nothing to keep yet.
 */
export async function upsertBankingDetails(
  accountNumber: string,
  input: { bankName: string; accountHolder: string; accountNumber?: string; branchCode: string; accountType: string; debitDay: number },
): Promise<BankingDetails | null> {
  const account = await getAccountByNumber(accountNumber);
  if (!account) return null;

  if (input.accountNumber) {
    const rows = await db
      .insert(bankingDetails)
      .values({
        accountId: account.id,
        bankName: input.bankName,
        accountHolder: input.accountHolder,
        accountNumber: input.accountNumber,
        branchCode: input.branchCode,
        accountType: input.accountType,
        debitDay: input.debitDay,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: bankingDetails.accountId,
        set: {
          bankName: input.bankName,
          accountHolder: input.accountHolder,
          accountNumber: input.accountNumber,
          branchCode: input.branchCode,
          accountType: input.accountType,
          debitDay: input.debitDay,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0] ? toBankingDetails(rows[0], accountNumber) : null;
  }

  const rows = await db
    .update(bankingDetails)
    .set({
      bankName: input.bankName,
      accountHolder: input.accountHolder,
      branchCode: input.branchCode,
      accountType: input.accountType,
      debitDay: input.debitDay,
      updatedAt: new Date(),
    })
    .where(eq(bankingDetails.accountId, account.id))
    .returning();
  return rows[0] ? toBankingDetails(rows[0], accountNumber) : null;
}

function toDispute(row: typeof disputes.$inferSelect): Dispute {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    invoiceId: row.invoiceId,
    reason: row.reason,
    description: row.description,
    status: row.status as Dispute["status"],
    resolutionNote: row.resolutionNote ?? undefined,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : undefined,
  };
}

let disputeSeq = 100;
export async function listDisputes(filters: { accountNumber?: string; municipality?: string }): Promise<Dispute[]> {
  if (filters.municipality && !filters.accountNumber) {
    // Disputes don't carry municipality directly — resolve via the account.
    const scoped = await listAccounts({ municipality: filters.municipality });
    const accountNumbers = new Set(scoped.map((a) => a.accountNumber));
    const rows = await db.select().from(disputes).orderBy(desc(disputes.createdAt));
    return rows.map(toDispute).filter((d) => accountNumbers.has(d.accountNumber));
  }
  const rows = await db
    .select()
    .from(disputes)
    .where(filters.accountNumber ? eq(disputes.accountNumber, filters.accountNumber) : undefined)
    .orderBy(desc(disputes.createdAt));
  return rows.map(toDispute);
}

export async function createDispute(input: {
  accountNumber: string;
  invoiceId: string;
  reason: string;
  description: string;
}): Promise<Dispute> {
  const id = `DSP-${disputeSeq++}`;
  const rows = await db
    .insert(disputes)
    .values({
      id,
      accountNumber: input.accountNumber,
      invoiceId: input.invoiceId,
      reason: input.reason,
      description: input.description,
      status: "open",
    })
    .returning();
  return toDispute(rows[0]!);
}

export async function resolveDispute(
  id: string,
  update: { status: "resolved" | "rejected"; resolutionNote: string },
): Promise<Dispute | null> {
  const rows = await db
    .update(disputes)
    .set({ status: update.status, resolutionNote: update.resolutionNote, resolvedAt: new Date() })
    .where(eq(disputes.id, id))
    .returning();
  return rows[0] ? toDispute(rows[0]) : null;
}

export async function getDisputeById(id: string): Promise<Dispute | null> {
  const rows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  return rows[0] ? toDispute(rows[0]) : null;
}

/**
 * Simplified indigent-relief tiers based on declared household income.
 * Real municipal policy indexes this against the state old-age pension and
 * a means test — this is a defensible demo approximation, not a citation.
 */
function calculateSubsidyPercent(householdIncome: number): number {
  if (householdIncome <= 3500) return 100;
  if (householdIncome <= 5500) return 50;
  if (householdIncome <= 7000) return 25;
  return 0;
}

function toSubsidyApplication(row: typeof subsidyApplications.$inferSelect): SubsidyApplication {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    householdIncome: Number(row.householdIncome),
    householdSize: row.householdSize,
    subsidyPercent: Number(row.subsidyPercent),
    status: row.status as SubsidyApplication["status"],
    appliedAt: row.appliedAt.toISOString(),
  };
}

let subsidySeq = 100;
export async function applyForSubsidy(input: {
  accountNumber: string;
  householdIncome: number;
  householdSize: number;
}): Promise<SubsidyApplication> {
  const subsidyPercent = calculateSubsidyPercent(input.householdIncome);
  const rows = await db
    .insert(subsidyApplications)
    .values({
      id: `SUB-${subsidySeq++}`,
      accountNumber: input.accountNumber,
      householdIncome: String(input.householdIncome),
      householdSize: input.householdSize,
      subsidyPercent: String(subsidyPercent),
      status: subsidyPercent > 0 ? "approved" : "rejected",
    })
    .returning();
  return toSubsidyApplication(rows[0]!);
}

export async function listSubsidyApplications(filters: { accountNumber?: string; municipality?: string }): Promise<SubsidyApplication[]> {
  if (filters.municipality && !filters.accountNumber) {
    const scoped = await listAccounts({ municipality: filters.municipality });
    const accountNumbers = new Set(scoped.map((a) => a.accountNumber));
    const rows = await db.select().from(subsidyApplications).orderBy(desc(subsidyApplications.appliedAt));
    return rows.map(toSubsidyApplication).filter((s) => accountNumbers.has(s.accountNumber));
  }
  const rows = await db
    .select()
    .from(subsidyApplications)
    .where(filters.accountNumber ? eq(subsidyApplications.accountNumber, filters.accountNumber) : undefined)
    .orderBy(desc(subsidyApplications.appliedAt));
  return rows.map(toSubsidyApplication);
}
