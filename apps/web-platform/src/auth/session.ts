/**
 * One signed-in identity for the whole platform. The persona decides which
 * product areas are visible client-side; the JWT's coarser role
 * (consumer/admin) is what the gateway actually enforces per route.
 */
export type Persona = "citizen" | "official" | "operator";

export interface Session {
  token: string;
  persona: Persona;
  name: string;
  /** Citizens are bound to their own billing account for the whole session. */
  accountNumber?: string;
  /** Officials are bound to their own municipality for the whole session. */
  municipalityId?: string;
}

const KEY = "xplatform.session";

export function getSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

export const PERSONA_META: Record<Persona, { label: string; role: "consumer" | "admin"; home: string }> = {
  citizen: { label: "Citizen", role: "consumer", home: "/billing" },
  official: { label: "Municipal Official", role: "admin", home: "/utilities" },
  operator: { label: "Platform Operator", role: "admin", home: "/" },
};

/** Which personas may see each product area. Mirrored by gateway RBAC. */
export const AREA_ACCESS: Record<"xlayer" | "billing" | "utilities", Persona[]> = {
  xlayer: ["operator"],
  billing: ["citizen", "operator"],
  utilities: ["official", "operator"],
};
