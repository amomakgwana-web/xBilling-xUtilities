import { createContext, useContext, useState, type ReactNode } from "react";
import { clearSession, getSession, saveSession, type Persona, type Session } from "./session";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

interface AuthContextValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<Session>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getSession);

  const login = async (email: string, password: string): Promise<Session> => {
    // Not via `api` — there is no token yet, and a 401 here must surface as a
    // form error, not a redirect loop back to /login.
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as {
      ok: boolean;
      data: { token: string; user: { name: string; email: string; persona: Persona; accountNumber?: string } };
      error?: { message: string };
    };
    if (!body.ok) throw new Error(body.error?.message ?? "Sign-in failed");
    const next: Session = {
      token: body.data.token,
      persona: body.data.user.persona,
      name: body.data.user.name,
      accountNumber: body.data.user.accountNumber,
    };
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
