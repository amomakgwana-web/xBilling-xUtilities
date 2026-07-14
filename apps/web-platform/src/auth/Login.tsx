import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { T, IC, Btn, Spin } from "@xplatform/ui-kit";
import { useAuth } from "./AuthContext";
import { PERSONA_META } from "./session";

/**
 * Provisioned demo identities (seeded in db/004_seed_real.sql). Real
 * municipal identities are created by an administrator — there is
 * deliberately no public self-signup on this platform.
 */
const DEMO_LOGINS = [
  { label: "Platform Operator", email: "operator@xplatform.co.za", password: "Operator!2026", accent: T.brand },
  { label: "Municipal Official", email: "official@ekurhuleni.gov.za", password: "Official!2026", accent: T.cyan },
  { label: "Citizen · Thandi Cele", email: "thandi.cele@example.co.za", password: "Citizen!2026", accent: T.green },
  { label: "Citizen · Naledi Mokoena", email: "naledi.mokoena@example.co.za", password: "Citizen!2026", accent: T.green },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await login(email, password);
      navigate(PERSONA_META[session.persona].home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 420, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          <span style={{ color: T.brand }}>{IC.layers}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: T.white, letterSpacing: "-.03em" }}>
            x<span style={{ color: T.brand }}>Platform</span>
          </span>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: T.g100, marginBottom: 26 }}>
          One console for xLayer, xBilling &amp; xUtilities
        </p>

        <form onSubmit={submit}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.g100, marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="you@municipality.gov.za"
            style={{ width: "100%", background: T.surf3, border: `1px solid ${T.g600}`, borderRadius: 8, padding: "11px 12px", color: T.white, fontSize: 13, fontFamily: "inherit", marginBottom: 14 }}
          />
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.g100, marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            style={{ width: "100%", background: T.surf3, border: `1px solid ${T.g600}`, borderRadius: 8, padding: "11px 12px", color: T.white, fontSize: 13, fontFamily: "inherit", marginBottom: 16 }}
          />

          {error && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
              {error}
            </div>
          )}

          <Btn ch={busy ? <><Spin s={12} c="rgba(255,255,255,.6)" /> Signing in…</> : "Sign in"} onClick={submit} disabled={busy || !email || !password} full />
        </form>

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.g200, marginBottom: 8, textAlign: "center" }}>
            Demo identities — click to fill
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DEMO_LOGINS.map((d) => (
              <button
                key={d.email}
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                  setError(null);
                }}
                style={{
                  padding: "9px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  background: T.surf2,
                  border: `1px solid ${T.g700}`,
                  color: T.white2,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: d.accent, marginRight: 7 }} />
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: T.g300, marginTop: 16 }}>
          Authenticated directly by Supabase Auth. Identities are provisioned — no self-signup.
        </p>
      </div>
    </div>
  );
}
