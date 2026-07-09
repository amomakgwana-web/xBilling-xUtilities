import { pgSchema, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const meteringSchema = pgSchema("metering");

// numeric() columns are string-typed in this drizzle-orm version (avoids
// float precision loss); converted to/from number in repository.ts.
export const meters = meteringSchema.table("meters", {
  id: text("id").primaryKey(),
  serial: text("serial").notNull().unique(),
  accountNumber: text("account_number").notNull(),
  municipality: text("municipality").notNull(),
  type: text("type").notNull(),
  lastReading: numeric("last_reading").notNull().default("0"),
  lastReadingAt: timestamp("last_reading_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(),
});

export const meterFaults = meteringSchema.table("meter_faults", {
  id: text("id").primaryKey(),
  meterId: text("meter_id")
    .notNull()
    .references(() => meters.id),
  serial: text("serial").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
});
