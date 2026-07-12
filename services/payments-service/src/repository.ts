import { desc, eq } from "drizzle-orm";
import type { DebiCheckMandate, PaymentMethod, PaymentMethodId, PaymentPlan, PaymentTransaction } from "@xplatform/shared-types";
import { db } from "./db/client.js";
import { debiCheckMandates, paymentMethods, paymentPlans, transactions } from "./db/schema.js";

type PaymentMethodRow = typeof paymentMethods.$inferSelect;
type TransactionRow = typeof transactions.$inferSelect;
type MandateRow = typeof debiCheckMandates.$inferSelect;
type PaymentPlanRow = typeof paymentPlans.$inferSelect;

function toMethod(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id as PaymentMethodId,
    label: row.label,
    provider: row.provider,
    status: row.status as PaymentMethod["status"],
    txDay: row.txDay,
    revDay: Number(row.revDay),
  };
}

function toTransaction(row: TransactionRow): PaymentTransaction {
  return {
    ref: row.ref,
    accountNumber: row.accountNumber,
    consumerName: row.consumerName,
    amount: Number(row.amount),
    gateway: row.gateway as PaymentTransaction["gateway"],
    method: row.method as PaymentMethodId,
    status: row.status as PaymentTransaction["status"],
    erpStatus: row.erpStatus as PaymentTransaction["erpStatus"],
    createdAt: row.createdAt.toISOString(),
  };
}

function toMandate(row: MandateRow): DebiCheckMandate {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    consumerName: row.consumerName,
    amount: Number(row.amount),
    collectionDay: row.collectionDay,
    status: row.status as DebiCheckMandate["status"],
  };
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const rows = await db.select().from(paymentMethods);
  return rows.map(toMethod);
}

export async function listTransactions(): Promise<PaymentTransaction[]> {
  const rows = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
  return rows.map(toTransaction);
}

export async function resolveTransaction(ref: string): Promise<PaymentTransaction | null> {
  const rows = await db
    .update(transactions)
    .set({ status: "matched", erpStatus: "posted" })
    .where(eq(transactions.ref, ref))
    .returning();
  return rows[0] ? toTransaction(rows[0]) : null;
}

export async function insertTransaction(tx: PaymentTransaction): Promise<void> {
  await db.insert(transactions).values({
    ref: tx.ref,
    accountNumber: tx.accountNumber,
    consumerName: tx.consumerName,
    amount: String(tx.amount),
    gateway: tx.gateway,
    method: tx.method,
    status: tx.status,
    erpStatus: tx.erpStatus,
    createdAt: new Date(tx.createdAt),
  });
}

export async function listDebiCheckMandates(): Promise<DebiCheckMandate[]> {
  const rows = await db.select().from(debiCheckMandates);
  return rows.map(toMandate);
}

function toPaymentPlan(row: PaymentPlanRow): PaymentPlan {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    consumerName: row.consumerName,
    totalAmount: Number(row.totalAmount),
    installments: row.installments,
    installmentAmount: Number(row.installmentAmount),
    startDate: row.startDate,
    status: row.status as PaymentPlan["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

let planSeq = 100;

export async function listPaymentPlans(filters: { accountNumber?: string }): Promise<PaymentPlan[]> {
  const rows = filters.accountNumber
    ? await db.select().from(paymentPlans).where(eq(paymentPlans.accountNumber, filters.accountNumber)).orderBy(desc(paymentPlans.createdAt))
    : await db.select().from(paymentPlans).orderBy(desc(paymentPlans.createdAt));
  return rows.map(toPaymentPlan);
}

export async function createPaymentPlan(input: {
  accountNumber: string;
  consumerName: string;
  totalAmount: number;
  installments: number;
}): Promise<PaymentPlan> {
  const id = `PLN-${planSeq++}`;
  const installmentAmount = Math.round((input.totalAmount / input.installments) * 100) / 100;
  const rows = await db
    .insert(paymentPlans)
    .values({
      id,
      accountNumber: input.accountNumber,
      consumerName: input.consumerName,
      totalAmount: String(input.totalAmount),
      installments: input.installments,
      installmentAmount: String(installmentAmount),
      startDate: new Date().toISOString().slice(0, 10),
      status: "active",
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create payment plan");
  return toPaymentPlan(row);
}
