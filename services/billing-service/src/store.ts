import type { Account, BillingRun, Invoice } from "@xplatform/shared-types";

export const accounts: Account[] = [
  { id: "acc-1", accountNumber: "WE-2024-00421", consumerName: "Thandi Cele", municipality: "Ekurhuleni", erfNumber: "ERF-40421", balance: 2130.5, status: "overdue", tariffCode: "RES-STD", createdAt: "2024-02-11T00:00:00.000Z" },
  { id: "acc-2", accountNumber: "WE-2024-00887", consumerName: "W. Engelbrecht", municipality: "Ekurhuleni", erfNumber: "ERF-40887", balance: 1380.0, status: "pending", tariffCode: "RES-STD", createdAt: "2024-03-02T00:00:00.000Z" },
  { id: "acc-3", accountNumber: "ETH-2024-00566", consumerName: "Ravi Pillay", municipality: "eThekwini", erfNumber: "ERF-90566", balance: 0, status: "paid", tariffCode: "RES-PREM", createdAt: "2024-01-19T00:00:00.000Z" },
  { id: "acc-4", accountNumber: "TSH-2025-00012", consumerName: "Naledi Mokoena", municipality: "Tshwane", erfNumber: "ERF-10012", balance: 640.25, status: "pending", tariffCode: "RES-STD", createdAt: "2025-01-05T00:00:00.000Z" },
  { id: "acc-5", accountNumber: "COJ-2024-01133", consumerName: "Sipho Dlamini", municipality: "CoJ", erfNumber: "ERF-71133", balance: 0, status: "paid", tariffCode: "COM-STD", createdAt: "2024-06-30T00:00:00.000Z" },
  { id: "acc-6", accountNumber: "EKR-4401-209", consumerName: "T. Dlamini", municipality: "Ekurhuleni", erfNumber: "ERF-44209", balance: 0, status: "paid", tariffCode: "RES-STD", createdAt: "2024-05-14T00:00:00.000Z" },
];

export const invoices: Invoice[] = [
  {
    id: "inv-1001",
    accountId: "acc-1",
    accountNumber: "WE-2024-00421",
    billingPeriod: "2026-05",
    issueDate: "2026-05-01",
    dueDate: "2026-05-25",
    lines: [
      { description: "Electricity consumption", category: "electricity", quantity: 420, unitPrice: 2.35, amount: 987.0 },
      { description: "Water consumption", category: "water", quantity: 18, unitPrice: 28.5, amount: 513.0 },
      { description: "Refuse removal", category: "refuse", quantity: 1, unitPrice: 210.5, amount: 210.5 },
      { description: "Sewerage", category: "sewer", quantity: 1, unitPrice: 420.0, amount: 420.0 },
    ],
    totalAmount: 2130.5,
    amountPaid: 0,
    status: "overdue",
  },
  {
    id: "inv-1002",
    accountId: "acc-2",
    accountNumber: "WE-2024-00887",
    billingPeriod: "2026-05",
    issueDate: "2026-05-01",
    dueDate: "2026-05-25",
    lines: [
      { description: "Electricity consumption", category: "electricity", quantity: 310, unitPrice: 2.35, amount: 728.5 },
      { description: "Water consumption", category: "water", quantity: 12, unitPrice: 28.5, amount: 342.0 },
      { description: "Refuse removal", category: "refuse", quantity: 1, unitPrice: 210.5, amount: 210.5 },
      { description: "Sewerage", category: "sewer", quantity: 1, unitPrice: 99.0, amount: 99.0 },
    ],
    totalAmount: 1380.0,
    amountPaid: 0,
    status: "pending",
  },
  {
    id: "inv-1003",
    accountId: "acc-4",
    accountNumber: "TSH-2025-00012",
    billingPeriod: "2026-05",
    issueDate: "2026-05-01",
    dueDate: "2026-05-25",
    lines: [
      { description: "Water consumption", category: "water", quantity: 9, unitPrice: 28.5, amount: 256.5 },
      { description: "Rates & taxes", category: "rates", quantity: 1, unitPrice: 383.75, amount: 383.75 },
    ],
    totalAmount: 640.25,
    amountPaid: 0,
    status: "pending",
  },
];

export const billingRuns: BillingRun[] = [
  { id: "BJ-2026-05-001", municipality: "Ekurhuleni", billingPeriod: "2026-05", startedAt: "2026-05-01T05:00:00.000Z", completedAt: "2026-05-01T05:42:11.000Z", accountsProcessed: 118420, totalBilled: 84210300, status: "completed" },
  { id: "BJ-2026-05-002", municipality: "Tshwane", billingPeriod: "2026-05", startedAt: "2026-05-01T07:00:00.000Z", completedAt: null, accountsProcessed: 62110, totalBilled: 41200000, status: "running" },
];

let invoiceSeq = 1004;
let runSeq = 3;

export function nextInvoiceId(): string {
  return `inv-${invoiceSeq++}`;
}

export function nextRunId(municipality: string, billingPeriod: string): string {
  const n = runSeq++;
  return `BJ-${billingPeriod}-${String(n).padStart(3, "0")}-${municipality.slice(0, 3).toUpperCase()}`;
}
