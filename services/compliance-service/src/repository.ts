import { and, eq } from "drizzle-orm";
import type { ComplianceScore, Integration, IntegrationCategory } from "@xplatform/shared-types";
import { db } from "./db/client.js";
import { frameworks, integrations, score } from "./db/schema.js";

type IntegrationRow = typeof integrations.$inferSelect;

function toIntegration(row: IntegrationRow): Integration {
  return {
    id: row.id,
    name: row.name,
    category: row.category as IntegrationCategory,
    status: row.status as Integration["status"],
    endpoint: row.endpoint,
    description: row.description,
  };
}

export async function listIntegrations(filters: { category?: string; status?: string }): Promise<Integration[]> {
  const conditions = [];
  if (filters.category) conditions.push(eq(integrations.category, filters.category));
  if (filters.status) conditions.push(eq(integrations.status, filters.status));
  const rows = await db
    .select()
    .from(integrations)
    .where(conditions.length ? and(...conditions) : undefined);
  return rows.map(toIntegration);
}

export async function getComplianceScore(): Promise<ComplianceScore> {
  const [scoreRow, frameworkRows] = await Promise.all([
    db.select().from(score).where(eq(score.id, 1)).limit(1),
    db.select().from(frameworks),
  ]);

  return {
    score: scoreRow[0]?.score ?? 0,
    frameworks: frameworkRows.map((f) => ({
      name: f.name as ComplianceScore["frameworks"][number]["name"],
      status: f.status as ComplianceScore["frameworks"][number]["status"],
      lastAuditedAt: f.lastAuditedAt,
    })),
  };
}
