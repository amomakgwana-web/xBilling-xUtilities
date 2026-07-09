import { pgSchema, text, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";

export const commsSchema = pgSchema("comms");

export const campaigns = commsSchema.table("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  sent: integer("sent").notNull().default(0),
  opened: integer("opened"),
  clicked: integer("clicked").notNull().default(0),
  paid: integer("paid").notNull().default(0),
  unpaid: integer("unpaid").notNull().default(0),
  createdAt: date("created_at").notNull().defaultNow(),
  municipality: text("municipality").notNull(),
});

export const chatSessions = commsSchema.table("chat_sessions", {
  id: text("id").primaryKey(),
  userName: text("user_name").notNull(),
  accountNumber: text("account_number").notNull(),
  intent: text("intent").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  escalated: boolean("escalated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
