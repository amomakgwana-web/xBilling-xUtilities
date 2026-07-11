import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const platformSchema = pgSchema("platform");

/** A municipal tenant — branding and contact details, referenced (as a
 * plain string, not an FK) by the `municipality` column every domain
 * service already carries on its own tables. */
export const municipalities = platformSchema.table("municipalities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  province: text("province").notNull(),
  brandColor: text("brand_color").notNull().default("#F05A00"),
  logoUrl: text("logo_url"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Platform identities. Municipal accounts are provisioned, not self-signup:
 * citizens are created alongside their billing account, staff by an admin.
 * `persona` drives which product areas the console shows AND, since
 * officials and operators share the coarser `role: "admin"` claim, is what
 * the gateway and services use to tell "this municipality only" apart from
 * "the whole platform" — `role` alone can't express that distinction.
 */
export const users = platformSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  persona: text("persona").notNull(), // citizen | official | operator
  role: text("role").notNull(), // consumer | admin
  accountNumber: text("account_number"), // citizens only — their own billing account
  municipalityId: text("municipality_id").references(() => municipalities.id), // officials only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
