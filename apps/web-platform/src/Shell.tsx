import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { T, IC, LiveDot } from "@xplatform/ui-kit";
import { useAuth } from "./auth/AuthContext";
import { AREA_ACCESS, PERSONA_META } from "./auth/session";
import { DEMO_ACCOUNTS, useAccount } from "./AccountContext";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

interface NavSection {
  area: keyof typeof AREA_ACCESS;
  title: string;
  accent: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    area: "xlayer",
    title: "xLayer · Platform",
    accent: T.brand,
    items: [
      { to: "/", label: "Command Centre", icon: IC.dash, end: true },
      { to: "/payments", label: "Payments", icon: IC.pay },
      { to: "/campaigns", label: "Campaigns", icon: IC.campaign },
      { to: "/integrations", label: "Integrations", icon: IC.plug },
      { to: "/audit", label: "Audit Trail", icon: IC.shield },
      { to: "/municipalities", label: "Municipalities", icon: IC.db },
      { to: "/tariffs", label: "Tariff Book", icon: IC.chart },
      { to: "/analytics", label: "Analytics", icon: IC.chart },
    ],
  },
  {
    area: "billing",
    title: "xBilling · My Account",
    accent: T.green,
    items: [
      { to: "/billing", label: "Dashboard", icon: IC.dash, end: true },
      { to: "/billing/invoices", label: "Invoices", icon: IC.billing },
      { to: "/billing/pay", label: "Pay Now", icon: IC.pay },
      { to: "/billing/electricity", label: "Buy Electricity", icon: IC.bolt },
      { to: "/billing/plans", label: "Payment Plans", icon: IC.recon },
      { to: "/billing/subsidy", label: "Indigent Subsidy", icon: IC.users },
      { to: "/billing/disputes", label: "Disputes", icon: IC.chat },
      { to: "/billing/banking", label: "Banking Details", icon: IC.shield },
    ],
  },
  {
    area: "utilities",
    title: "xUtilities · Operations",
    accent: T.cyan,
    items: [
      { to: "/utilities", label: "Overview", icon: IC.dash, end: true },
      { to: "/utilities/meters", label: "Meters", icon: IC.meter },
      { to: "/utilities/electricity", label: "Electricity", icon: IC.bolt },
      { to: "/utilities/faults", label: "Faults", icon: IC.alert },
      { to: "/utilities/arrears", label: "Arrears", icon: IC.billing },
      { to: "/utilities/legal-handover", label: "Legal & Handover", icon: IC.alert },
      { to: "/utilities/subsidy", label: "Indigent Subsidy", icon: IC.users },
      { to: "/utilities/disputes", label: "Disputes", icon: IC.chat },
      { to: "/utilities/reports", label: "Reports", icon: IC.chart },
      { to: "/utilities/settings", label: "Settings", icon: IC.settings },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const { accountNumber, setAccountNumber, canSwitch } = useAccount();
  const navigate = useNavigate();
  if (!session) return null;

  const visible = SECTIONS.filter((s) => AREA_ACCESS[s.area].includes(session.persona));
  const showAccountPicker = canSwitch && AREA_ACCESS.billing.includes(session.persona);

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.black }}>
      <aside
        style={{
          width: 232,
          borderRight: `1px solid ${T.g700}`,
          padding: "20px 14px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 20 }}>
          <span style={{ color: T.brand }}>{IC.layers}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.white, letterSpacing: "-.02em" }}>
            x<span style={{ color: T.brand }}>Platform</span>
          </span>
        </div>

        {visible.map((section) => (
          <div key={section.area} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.g200, padding: "0 8px", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: section.accent, display: "inline-block" }} />
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 12px",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  color: isActive ? "#fff" : T.g100,
                  background: isActive ? T.brand : "transparent",
                })}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        {showAccountPicker && (
          <div style={{ padding: "0 4px", marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: T.g200, padding: "0 4px", marginBottom: 6 }}>
              Viewing account
            </div>
            <select
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              style={{ width: "100%", background: T.surf3, border: `1px solid ${T.g600}`, borderRadius: 7, padding: "7px 8px", color: T.white, fontSize: 11, fontFamily: "inherit" }}
            >
              {DEMO_ACCOUNTS.map((a) => (
                <option key={a.accountNumber} value={a.accountNumber}>
                  {a.name} · {a.accountNumber}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginTop: "auto" }}>
          <div style={{ padding: "10px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <LiveDot color={T.green} />
            <span style={{ fontSize: 10, color: T.g100 }}>All systems operational</span>
          </div>
          <div style={{ borderTop: `1px solid ${T.g700}`, paddingTop: 10, display: "flex", alignItems: "center", gap: 9, padding: "10px 8px 0" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: T.brandBg,
                border: `1px solid ${T.brandRim}`,
                color: T.brandL,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {session.name.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.name}</div>
              <div style={{ fontSize: 9, color: T.g200 }}>{PERSONA_META[session.persona].label}</div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              style={{ background: "transparent", border: `1px solid ${T.g600}`, color: T.g100, borderRadius: 6, padding: "5px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 28, overflowX: "hidden" }}>{children}</main>
    </div>
  );
}
