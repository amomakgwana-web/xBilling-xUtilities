import { supabase } from "./supabaseClient";

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * The db/012 RPC functions mostly `returns <schema>.<table>` — PostgREST
 * serialises that as the table's real (snake_case) column names, unlike the
 * camelCase public.* views reads go through (db/014). Rather than rewrite
 * every RPC's return shape, results get run through this once so every page
 * sees the same camelCase @xplatform/shared-types shapes regardless of
 * which path (view read vs. RPC write) produced them. Idempotent on
 * already-camelCase keys, so it's safe to apply to jsonb-returning RPCs too.
 */
export function camelizeKeys<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [toCamel(k), camelizeKeys(v)]),
    ) as T;
  }
  return value as T;
}

/** Unwraps a supabase-js `{ data, error }` result, throwing on error — same ergonomics as the old `api.get/post`. */
export async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data as T;
}

/** Calls a db/012 RPC function and camelizes its result. */
export async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return camelizeKeys<T>(data);
}

interface EdgeEnvelope<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

/** Invokes one of the two supabase/functions/* Edge Functions (ai-insight, campaign-send). */
export async function callEdgeFunction<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<EdgeEnvelope<T>>(fn, { body });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error?.message ?? `${fn} failed`);
  return data.data;
}
