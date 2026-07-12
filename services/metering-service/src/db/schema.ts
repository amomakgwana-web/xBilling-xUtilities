import { pgSchema, text, numeric, timestamp, bigint } from "drizzle-orm/pg-core";

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

/**
 * Full reading history — the billing engine derives consumption from the
 * delta between the two most recent readings per meter.
 */
export const meterReadings = meteringSchema.table("readings", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  meterId: text("meter_id")
    .notNull()
    .references(() => meters.id),
  serial: text("serial").notNull(),
  reading: numeric("reading").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
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

/** Persisted record of every prepaid token issued — the vend route used to
 * generate a token and hand it back without keeping any trace of it. */
export const vendedTokens = meteringSchema.table("vended_tokens", {
  id: text("id").primaryKey(),
  meterId: text("meter_id")
    .notNull()
    .references(() => meters.id),
  serial: text("serial").notNull(),
  accountNumber: text("account_number").notNull(),
  amount: numeric("amount").notNull(),
  units: numeric("units").notNull(),
  token: text("token").notNull(),
  vendedAt: timestamp("vended_at", { withTimezone: true }).notNull().defaultNow(),
});
