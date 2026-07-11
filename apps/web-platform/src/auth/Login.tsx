import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { T, IC, Btn, Spin } from "@xplatform/ui-kit";
import { DEMO_ACCOUNTS } from "../AccountContext";
import { useAuth } from "./AuthContext";
import { PERSONA_META, type Persona } from "./session";

const PERSONAS: Array<{ id: Persona; title: string; desc: string; icon: keyof typeof IC; accent: string }> = [
  { id: "operator", title: "Platform Operator", desc: "xLayer command centre, payments ops, campaigns, integrations — plus every product area", icon: "layers", accent: T.brand },
  { id: "official", title: "Municipal Official", desc: "xUtilities operations — meters, token vending, fault dispatch", icon: "bolt", accent: T.cyan },
  { id: "citizen", title: "Citizen", desc: "xBilling self-service — statements, invoices and payments for your own account", icon: "billing", accent: T.green },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona>("operator");
  const [accountNumber, setAccountNumber] = useState(DEMO_ACCOUNTS[0]!.accountNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const account = DEMO_ACCOUNTS.find((a) => a.accountNumber === accountNumber);
      const name =
        persona === "citizen" ? (account?.name ?? "Citizen") : persona === "official" ? "Ops Official" : "Platform Operator";
      const session = await login(persona, {
        name,
        accountNumber: persona === "citizen" ? accountNumber : undefined,
      });
      navigate(PERSONA_META[session.persona].home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 440, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          <span style={{ color: T.brand }}>{IC.layers}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: T.white, letterSpacing: "-.03em" }}>
            x<span style={{ color: T.brand }}>Platform</span>
          </span>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: T.g100, marginBottom: 26 }}>
          One console for xLayer, xBilling &amp; xUtilities — sign in as
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {PERSONAS.map((p) => {
            const active = persona === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: active ? `${p.accent}14` : T.surf2,
                  border: `1px solid ${active ? p.accent : T.g700}`,
                }}
              >
                <span style={{ color: p.accent, marginTop: 2 }}>{IC[p.icon]}</span>
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 3 }}>{p.title}</span>
                  <span style={{ display: "block", fontSize: 11, color: T.g100, lineHeight: 1.5 }}>{p.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        {persona === "citizen" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.g100, marginBottom: 6 }}>Your account</label>
            <select
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              style={{ width: "100%", background: T.surf3, border: `1px solid ${T.g600}`, borderRadius: 8, padding: "10px 12px", color: T.white, fontSize: 13, fontFamily: "inherit" }}
            >
              {DEMO_ACCOUNTS.map((a) => (
                <option key={a.accountNumber} value={a.accountNumber}>
                  {a.name} · {a.accountNumber}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
            {error}
          </div>
        )}

        <Btn ch={busy ? <><Spin s={12} c="rgba(255,255,255,.6)" /> Signing in…</> : "Sign in"} onClick={submit} disabled={busy} full />
        <p style={{ textAlign: "center", fontSize: 10, color: T.g300, marginTop: 14 }}>
          Dev-mode sign-in — issues a short-lived JWT from the gateway. Swap for a real IdP in production.
        </p>
      </div>
    </div>
  );
}
