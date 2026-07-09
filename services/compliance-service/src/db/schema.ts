import { pgSchema, text, integer, date, bigint } from "drizzle-orm/pg-core";

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
