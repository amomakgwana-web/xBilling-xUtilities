import { desc, eq } from "drizzle-orm";
import type { Campaign, ChatSession } from "@xplatform/shared-types";
import { db } from "./db/client.js";
import { campaigns, chatSessions } from "./db/schema.js";

type CampaignRow = typeof campaigns.$inferSelect;
type ChatSessionRow = typeof chatSessions.$inferSelect;

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Campaign["type"],
    status: row.status as Campaign["status"],
    sent: row.sent,
    opened: row.opened,
    clicked: row.clicked,
    paid: row.paid,
    unpaid: row.unpaid,
    createdAt: row.createdAt,
    municipality: row.municipality as Campaign["municipality"],
  };
}

function toChatSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    user: row.userName,
    accountNumber: row.accountNumber,
    intent: row.intent as ChatSession["intent"],
    resolved: row.resolved,
    escalated: row.escalated,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  return rows.map(toCampaign);
}

let campaignSeq = 100;
export function nextCampaignId(): string {
  return `CMP-${String(campaignSeq++).padStart(3, "0")}`;
}

export async function createCampaign(campaign: Campaign): Promise<void> {
  await db.insert(campaigns).values({
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    status: campaign.status,
    sent: campaign.sent,
    opened: campaign.opened,
    clicked: campaign.clicked,
    paid: campaign.paid,
    unpaid: campaign.unpaid,
    createdAt: campaign.createdAt,
    municipality: campaign.municipality,
  });
}

export async function markCampaignSent(id: string, sent: number): Promise<void> {
  await db.update(campaigns).set({ status: "running", sent }).where(eq(campaigns.id, id));
}

export async function listChatSessions(): Promise<ChatSession[]> {
  const rows = await db.select().from(chatSessions);
  return rows.map(toChatSession);
}

export async function getChatStats(): Promise<{ total: number; resolved: number; escalated: number }> {
  const rows = await db.select().from(chatSessions);
  return {
    total: rows.length,
    resolved: rows.filter((r) => r.resolved).length,
    escalated: rows.filter((r) => r.escalated).length,
  };
}
