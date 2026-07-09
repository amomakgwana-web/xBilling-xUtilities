import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required — see .env.example (Supabase project 'xBilling', schema 'comms')");
}

const queryClient = postgres(process.env.DATABASE_URL, { max: 5 });
export const db = drizzle(queryClient, { schema });
