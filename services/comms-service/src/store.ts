import type { Campaign, ChatSession } from "@xplatform/shared-types";

export const campaigns: Campaign[] = [
  { id: "CMP-001", name: "May 2026 Overdue Reminder", type: "SMS", status: "completed", sent: 18420, opened: null, clicked: 8210, paid: 3841, unpaid: 14579, createdAt: "2026-05-01", municipality: "Tshwane" },
  { id: "CMP-002", name: "Water Tariff Increase Notice", type: "Email", status: "completed", sent: 42100, opened: 31200, clicked: 18900, paid: 12400, unpaid: 29700, createdAt: "2026-04-15", municipality: "All" },
  { id: "CMP-003", name: "Final Demand — 90+ Days", type: "SMS", status: "running", sent: 4200, opened: null, clicked: 2100, paid: 840, unpaid: 3360, createdAt: "2026-05-18", municipality: "eThekwini" },
  { id: "CMP-004", name: "June Statement Dispatch", type: "Email", status: "scheduled", sent: 0, opened: 0, clicked: 0, paid: 0, unpaid: 0, createdAt: "2026-05-20", municipality: "CoJ" },
];

export const chatSessions: ChatSession[] = [
  { id: "CB-001", user: "Thandi Cele", accountNumber: "WE-2024-00421", intent: "payment_plan", resolved: true, escalated: false, createdAt: "2026-07-08T09:14:00.000Z" },
  { id: "CB-002", user: "W. Engelbrecht", accountNumber: "WE-2024-00887", intent: "meter_fault", resolved: false, escalated: true, createdAt: "2026-07-08T08:55:00.000Z" },
  { id: "CB-003", user: "Ravi Pillay", accountNumber: "ETH-2024-00566", intent: "dispute", resolved: true, escalated: false, createdAt: "2026-07-08T08:41:00.000Z" },
  { id: "CB-004", user: "Naledi Mokoena", accountNumber: "TSH-2025-00012", intent: "balance_query", resolved: true, escalated: false, createdAt: "2026-07-08T08:22:00.000Z" },
  { id: "CB-005", user: "Sipho Dlamini", accountNumber: "COJ-2024-01133", intent: "payment_options", resolved: true, escalated: false, createdAt: "2026-07-08T08:10:00.000Z" },
];

let campaignSeq = 5;
export function nextCampaignId(): string {
  return `CMP-${String(campaignSeq++).padStart(3, "0")}`;
}
