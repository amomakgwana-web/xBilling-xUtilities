import { pgSchema, text, integer, date, bigint, jsonb, timestamp } from "drizzle-orm/pg-core";

export const complianceSchema = pgSchema("compliance");

export const integrations = complianceSchema.table("integrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  endpoint: text("endpoint").notNull(),
  description: text("description").notNull(),
});

export const score = complianceSchema.table("score", {
  id: integer("id").primaryKey().default(1),
  score: integer("score").notNull(),
});

export const frameworks = complianceSchema.table("frameworks", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  lastAuditedAt: date("last_audited_at").notNull(),
});

/** Every KYC verification ever run — POPIA requires this record to exist. */
export const kycChecks = complianceSchema.table("kyc_checks", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  idNumber: text("id_number").notNull(),
  erfNumber: text("erf_number"),
  requestedBy: text("requested_by").notNull(),
  outcome: text("outcome").notNull(), // verified | review
  detail: jsonb("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tamper-evident platform audit log: each row's hash covers its content plus
 * the previous row's hash, so any retroactive edit breaks the chain.
 */
export const auditEvents = complianceSchema.table("audit_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  actor: text("actor").notNull(),
  actorName: text("actor_name"),
  role: text("role"),
  action: text("action").notNull(),
  target: text("target"),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
