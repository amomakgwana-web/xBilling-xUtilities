import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { T, IC, LiveDot } from "@xplatform/ui-kit";

const NAV = [
  { to: "/", label: "Dashboard", icon: IC.dash, end: true },
  { to: "/meters", label: "Meters", icon: IC.meter },
  { to: "/faults", label: "Faults", icon: IC.alert },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.black }}>
      <aside style={{ width: 220, borderRight: `1px solid ${T.g700}`, padding: "20px 14px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 24 }}>
          <span style={{ color: T.brand }}>{IC.bolt}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.white, letterSpacing: "-.02em" }}>xUtilities</span>
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 12px",
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
        <div style={{ marginTop: "auto", padding: "10px 8px", display: "flex", alignItems: "center", gap: 8 }}>
          <LiveDot color={T.green} />
          <span style={{ fontSize: 10, color: T.g100 }}>Metering feed live</span>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 28, overflowX: "hidden" }}>{children}</main>
    </div>
  );
}
