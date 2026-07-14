/**
 * One signed-in identity for the whole platform. The persona decides which
 * product areas are visible client-side; Postgres RLS policies (db/011) and
 * the RPC functions (db/012) are what actually enforce it server-side, both
 * keyed off the same custom claims (persona/accountNumber/municipalityId)
 * the Auth Hook injects into every JWT Supabase issues.
 */
export type Persona = "citizen" | "official" | "operator";

export interface Session {
  persona: Persona;
  name: string;
  /** Citizens are bound to their own billing account for the whole session. */
  accountNumber?: string;
  /** Officials are bound to their own municipality for the whole session. */
  municipalityId?: string;
}

export const PERSONA_META: Record<Persona, { label: string; role: "consumer" | "admin"; home: string }> = {
  citizen: { label: "Citizen", role: "consumer", home: "/billing" },
  official: { label: "Municipal Official", role: "admin", home: "/utilities" },
  operator: { label: "Platform Operator", role: "admin", home: "/" },
};

/** Which personas may see each product area. Mirrored by RLS + RPC checks. */
export const AREA_ACCESS: Record<"xlayer" | "billing" | "utilities", Persona[]> = {
  xlayer: ["operator"],
  billing: ["citizen", "operator"],
  utilities: ["official", "operator"],
};

/**
 * Decodes the custom claims (public.custom_access_token_hook, db/010 +
 * db/013) out of a Supabase access token into the Session shape the rest of
 * the app already expects. No signature verification here — that's
 * Supabase's job when it issued the token; this only ever runs against a
 * token this same client received directly from supabase.auth.
 */
export function sessionFromJwt(accessToken: string): Session | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as Record<string, unknown>;
    const persona = claims.persona as Persona | undefined;
    if (!persona || !(persona in PERSONA_META)) return null;
    return {
      persona,
      name: typeof claims.name === "string" ? claims.name : (claims.email as string) ?? "Unknown",
      accountNumber: typeof claims.accountNumber === "string" ? claims.accountNumber : undefined,
      municipalityId: typeof claims.municipalityId === "string" ? claims.municipalityId : undefined,
    };
  } catch {
    return null;
  }
}
