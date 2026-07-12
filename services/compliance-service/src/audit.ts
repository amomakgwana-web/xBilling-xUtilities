import { createHash } from "node:crypto";
import { desc } from "drizzle-orm";
import { db } from "./db/client.js";
import { auditEvents } from "./db/schema.js";

export interface AuditEventInput {
  actor: string;
  actorName?: string;
  role?: string;
  action: string;
  target?: string | null;
}

export interface AuditEvent extends AuditEventInput {
  id: number;
  prevHash: string;
  hash: string;
  createdAt: string;
}

const GENESIS = "0".repeat(64);

function toEvent(row: typeof auditEvents.$inferSelect): AuditEvent {
  return {
    id: row.id,
    actor: row.actor,
    actorName: row.actorName ?? undefined,
    role: row.role ?? undefined,
    action: row.action,
    target: row.target,
    prevHash: row.prevHash,
    hash: row.hash,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function appendAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
  // Serialised via a transaction: the chain only stays intact if reads of the
  // previous head and the insert happen atomically.
  const inserted = await db.transaction(async (tx) => {
    const last = await tx.select().from(auditEvents).orderBy(desc(auditEvents.id)).limit(1);
    const prevHash = last[0]?.hash ?? GENESIS;
    const createdAt = new Date();
    const hash = createHash("sha256")
      .update([prevHash, input.actor, input.role ?? "", input.action, input.target ?? "", createdAt.toISOString()].join("|"))
      .digest("hex");
    const rows = await tx
      .insert(auditEvents)
      .values({
        actor: input.actor,
        actorName: input.actorName,
        role: input.role,
        action: input.action,
        target: input.target ?? null,
        prevHash,
        hash,
        createdAt,
      })
      .returning();
    return rows[0]!;
  });
  return toEvent(inserted);
}

export async function listAuditEvents(limit: number): Promise<AuditEvent[]> {
  const rows = await db.select().from(auditEvents).orderBy(desc(auditEvents.id)).limit(limit);
  return rows.map(toEvent);
}

/** Recompute the chain oldest→newest; returns the first broken row id, or null if intact. */
export async function verifyAuditChain(): Promise<{ intact: boolean; brokenAtId: number | null; events: number }> {
  const rows = await db.select().from(auditEvents).orderBy(auditEvents.id);
  let prevHash = GENESIS;
  for (const row of rows) {
    const expected = createHash("sha256")
      .update([prevHash, row.actor, row.role ?? "", row.action, row.target ?? "", row.createdAt.toISOString()].join("|"))
      .digest("hex");
    if (row.prevHash !== prevHash || row.hash !== expected) {
      return { intact: false, brokenAtId: row.id, events: rows.length };
    }
    prevHash = row.hash;
  }
  return { intact: true, brokenAtId: null, events: rows.length };
}
