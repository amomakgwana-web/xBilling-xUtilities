import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { T, IC } from "@xplatform/ui-kit";
import { DEMO_ACCOUNTS, useAccount } from "./AccountContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: IC.dash, end: true },
  { to: "/invoices", label: "Invoices", icon: IC.billing },
  { to: "/pay", label: "Pay Now", icon: IC.pay },
];

export function Shell({ children }: { children: ReactNode }) {
  const { accountNumber, setAccountNumber } = useAccount();
  return (
    <div style={{ minHeight: "100vh", background: T.black }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 28px",
          borderBottom: `1px solid ${T.g700}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.brand }}>{IC.billing}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.white, letterSpacing: "-.02em" }}>xBilling</span>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 14px",
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
          </nav>
        </div>
        <select
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          style={{ background: T.surf3, border: `1px solid ${T.g600}`, borderRadius: 7, padding: "7px 10px", color: T.white, fontSize: 12 }}
        >
          {DEMO_ACCOUNTS.map((a) => (
            <option key={a.accountNumber} value={a.accountNumber}>
              {a.name} · {a.accountNumber}
            </option>
          ))}
        </select>
      </header>
      <main style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
