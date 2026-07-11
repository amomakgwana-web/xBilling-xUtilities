import { createContext, useContext, useState, type ReactNode } from "react";
import { clearSession, getSession, PERSONA_META, saveSession, type Persona, type Session } from "./session";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

interface AuthContextValue {
  session: Session | null;
  login: (persona: Persona, opts: { name: string; accountNumber?: string }) => Promise<Session>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getSession);

  const login = async (persona: Persona, opts: { name: string; accountNumber?: string }): Promise<Session> => {
    // Not via `api` — there is no token yet, and a 401 here must surface as a
    // form error, not a redirect loop back to /login.
    const res = await fetch(`${BASE_URL}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: PERSONA_META[persona].role,
        sub: opts.accountNumber ?? persona,
      }),
    });
    const body = (await res.json()) as { ok: boolean; data: { token: string }; error?: { message: string } };
    if (!body.ok) throw new Error(body.error?.message ?? "Sign-in failed");
    const next: Session = { token: body.data.token, persona, name: opts.name, accountNumber: opts.accountNumber };
    saveSession(next);
    setSession(next);
    return next;
  };

  const logout = () => {
    clearSession();
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
