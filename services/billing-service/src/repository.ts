import { and, eq } from "drizzle-orm";
import type { Account, BillingRun, Invoice, Municipality, Tariff } from "@xplatform/shared-types";
import { db } from "./db/client.js";
import { accounts, billingRuns, invoiceLines, invoices, tariffs } from "./db/schema.js";

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

export async function getTariff(code: string): Promise<Tariff | null> {
  const rows = await db.select().from(tariffs).where(eq(tariffs.code, code)).limit(1);
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
