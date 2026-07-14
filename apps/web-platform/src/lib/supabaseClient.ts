import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set — see .env.example");
}

/**
 * The single Postgres client the whole app shares. There is no backend left
 * to trust: reads go straight to RLS-gated tables (db/011), writes go
 * through the SECURITY DEFINER RPC functions in db/012, and auth is
 * Supabase Auth's own session (JWT persisted in localStorage by this
 * client, refreshed automatically).
 */
export const supabase = createClient(url, anonKey);
