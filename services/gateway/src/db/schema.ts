import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const platformSchema = pgSchema("platform");

/**
 * Platform identities. Municipal accounts are provisioned, not self-signup:
 * citizens are created alongside their billing account, staff by an admin.
 * `persona` drives which product areas the console shows; `role` is the
 * coarser claim the gateway enforces per proxied domain.
 */
export const users = platformSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  persona: text("persona").notNull(), // citizen | official | operator
  role: text("role").notNull(), // consumer | admin
  accountNumber: text("account_number"), // citizens only — their own billing account
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
