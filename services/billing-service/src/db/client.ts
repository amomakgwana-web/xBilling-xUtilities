import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

// Load this service's .env (if present) before reading process.env below.
// Must happen here, not in index.ts — ESM imports (including this module,
// transitively via repository.ts) are evaluated before index.ts's own
// top-level code runs, so loading it there would be too late.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fall back to whatever the environment already provides
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required — see .env.example (Supabase project 'xBilling', schema 'billing')");
}

const queryClient = postgres(process.env.DATABASE_URL, { max: 5 });
export const db = drizzle(queryClient, { schema });
