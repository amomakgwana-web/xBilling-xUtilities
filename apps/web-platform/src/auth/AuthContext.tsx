import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { sessionFromJwt, type Session } from "./session";

interface AuthContextValue {
  session: Session | null;
  /** True until the initial supabase.auth.getSession() call resolves — avoids a login-page flash on reload while a valid session is still being restored. */
  loading: boolean;
  login: (email: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? sessionFromJwt(data.session.access_token) : null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ? sessionFromJwt(next.access_token) : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<Session> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const next = data.session ? sessionFromJwt(data.session.access_token) : null;
    if (!next) {
      // Either the Custom Access Token Hook isn't enabled in the Supabase
      // dashboard yet (Authentication -> Hooks), or this identity has no
      // platform.users row linked via auth_user_id — either way, a token
      // with no persona claim can't route anywhere in this app.
      await supabase.auth.signOut();
      throw new Error("Signed in, but no platform role was found on this account. Is the Custom Access Token Hook enabled?");
    }
    setSession(next);
    return next;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
