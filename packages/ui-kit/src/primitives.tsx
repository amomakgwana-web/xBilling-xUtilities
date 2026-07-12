import type { CSSProperties, ReactNode } from "react";
import { T } from "./tokens.js";

export function Spin({ s = 14, c = T.brand }: { s?: number; c?: string }) {
  return (
    <div
      style={{
        width: s,
        height: s,
        border: `2px solid ${c}33`,
        borderTopColor: c,
        borderRadius: "50%",
        animation: "spin .65s linear infinite",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.g100, padding: "20px 0" }}>
      <Spin /> {label}
    </div>
  );
}

/** Shown in place of a page/section when its data fetch fails — e.g. the API
 * is unreachable in a deployed environment. Always gives the visitor a way
 * forward instead of a silent, permanent spinner. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        background: T.redBg,
        border: `1px solid ${T.red}40`,
        borderRadius: 10,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.redT, marginBottom: 4 }}>Couldn't load this page</div>
        <div style={{ fontSize: 12, color: T.white3 }}>{message}</div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: "transparent",
            border: `1px solid ${T.red}60`,
            color: T.redT,
            borderRadius: 7,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

const BADGE_MAP: Record<string, [string, string, string, string]> = {
  live: [T.greenBg, T.greenT, T.green, "Live"],
  matched: [T.greenBg, T.greenT, T.green, "Matched"],
  posted: [T.greenBg, T.greenT, T.green, "Posted"],
  completed: [T.greenBg, T.greenT, T.green, "Completed"],
  delivered: [T.greenBg, T.greenT, T.green, "Delivered"],
  good: [T.greenBg, T.greenT, T.green, "Good"],
  normal: [T.greenBg, T.greenT, T.green, "Normal"],
  approved: [T.greenBg, T.greenT, T.green, "Approved"],
  active: [T.greenBg, T.greenT, T.green, "Active"],
  paid: [T.greenBg, T.greenT, T.green, "Paid"],
  connected: [T.greenBg, T.greenT, T.green, "Connected"],
  suspense: [T.amberBg, T.amberT, T.amber, "Suspense"],
  pending: [T.amberBg, T.amberT, T.amber, "Pending"],
  running: [T.amberBg, T.amberT, T.amber, "Running"],
  alert: [T.amberBg, T.amberT, T.amber, "Alert"],
  review: [T.amberBg, T.amberT, T.amber, "Review"],
  scheduled: [T.amberBg, T.amberT, T.amber, "Scheduled"],
  queued: [T.amberBg, T.amberT, T.amber, "Queued"],
  fault: [T.redBg, T.redT, T.red, "Fault"],
  failed: [T.redBg, T.redT, T.red, "Failed"],
  overdue: [T.redBg, T.redT, T.red, "Overdue"],
  disconnected: [T.redBg, T.redT, T.red, "Disconnected"],
  unpaid: [T.redBg, T.redT, T.red, "Unpaid"],
  flagged: [T.redBg, T.redT, T.red, "Flagged"],
  rejected: [T.redBg, T.redT, T.red, "Rejected"],
  cancelled: [T.redBg, T.redT, T.red, "Cancelled"],
  open: [T.amberBg, T.amberT, T.amber, "Open"],
  under_review: [T.amberBg, T.amberT, T.amber, "Under Review"],
  resolved: [T.greenBg, T.greenT, T.green, "Resolved"],
  draft: ["#1a1a1a", "#888", "#555", "Draft"],
};

export function Badge({ v, label }: { v: string; label?: string }) {
  const [bg, tColor, brd, lbl] = BADGE_MAP[v] ?? [T.g700, T.g100, T.g400, v];
  return (
    <span
      style={{
        background: bg,
        color: tColor,
        border: `1px solid ${brd}30`,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        letterSpacing: ".03em",
      }}
    >
      {label ?? lbl}
    </span>
  );
}

export function Card({ children, s = {} }: { children: ReactNode; s?: CSSProperties }) {
  return (
    <div style={{ background: T.surf, border: `1px solid ${T.g700}`, borderRadius: 10, overflow: "hidden", ...s }}>
      {children}
    </div>
  );
}

export function CH({
  title,
  sub,
  right,
  icon,
  accent,
  pad = true,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  pad?: boolean;
}) {
  return (
    <div
      style={{
        padding: pad ? "13px 18px" : "10px 16px",
        borderBottom: `1px solid ${T.g700}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        borderTop: accent ? `2px solid ${accent}` : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
        {icon && <span style={{ color: T.g200, flexShrink: 0 }}>{icon}</span>}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.white, letterSpacing: "-.01em" }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {right && <div style={{ flexShrink: 0, display: "flex", gap: 6, alignItems: "center" }}>{right}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent = T.brand,
  delta,
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
  delta?: number;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surf,
        border: `1px solid ${T.g700}`,
        borderRadius: 10,
        padding: "16px 18px",
        borderTop: `2px solid ${accent}`,
        cursor: onClick ? "pointer" : "default",
        transition: "all .15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.g100, textTransform: "uppercase", letterSpacing: ".1em" }}>
          {label}
        </div>
        {icon && <span style={{ color: accent, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.white, letterSpacing: "-.02em", lineHeight: 1, marginBottom: 5 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.g100 }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{ fontSize: 11, color: delta > 0 ? T.green : T.red, marginTop: 3, fontWeight: 600 }}>
          {delta > 0 ? `+${delta}%` : `${delta}%`} vs last cycle
        </div>
      )}
    </div>
  );
}

export type BtnVariant = "primary" | "secondary" | "ghost" | "dark" | "danger" | "green";

export function Btn({
  ch,
  onClick,
  v = "primary",
  disabled = false,
  sm = false,
  full = false,
  s = {},
  type = "button",
}: {
  ch: ReactNode;
  onClick?: () => void;
  v?: BtnVariant;
  disabled?: boolean;
  sm?: boolean;
  full?: boolean;
  s?: CSSProperties;
  type?: "button" | "submit";
}) {
  const styles: Record<BtnVariant, CSSProperties> = {
    primary: { background: T.brand, color: "#fff", border: `1px solid ${T.brand}` },
    secondary: { background: "transparent", color: T.white3, border: `1px solid ${T.g500}` },
    ghost: { background: "transparent", color: T.brand, border: `1px solid ${T.brand}40` },
    dark: { background: T.g700, color: T.white2, border: `1px solid ${T.g500}` },
    danger: { background: T.redBg, color: T.red, border: `1px solid ${T.red}40` },
    green: { background: T.greenBg, color: T.green, border: `1px solid ${T.green}40` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        justifyContent: "center",
        padding: sm ? "5px 11px" : "8px 15px",
        borderRadius: 7,
        fontSize: sm ? 11 : 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
        width: full ? "100%" : undefined,
        transition: "all .12s",
        letterSpacing: ".02em",
        ...styles[v],
        ...s,
      }}
    >
      {ch}
    </button>
  );
}

export function Tab({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: T.surf3,
        borderRadius: 8,
        padding: 3,
        border: `1px solid ${T.g700}`,
        width: "fit-content",
        marginBottom: 20,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            background: active === t.id ? T.brand : "transparent",
            color: active === t.id ? "#fff" : T.g100,
            transition: "all .12s",
            fontFamily: "inherit",
            letterSpacing: ".02em",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TRow({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: T.surf3 }}>
        {cols.map((c, i) => (
          <th
            key={i}
            style={{
              padding: "9px 14px",
              textAlign: "left",
              fontSize: 10,
              fontWeight: 700,
              color: T.g100,
              textTransform: "uppercase",
              letterSpacing: ".07em",
              borderBottom: `1px solid ${T.g700}`,
              whiteSpace: "nowrap",
            }}
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: T.g100, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
          {label}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: T.surf3,
          border: `1px solid ${T.g600}`,
          borderRadius: 7,
          padding: "9px 12px",
          color: T.white,
          fontSize: 12,
          fontFamily: mono ? "monospace" : "inherit",
          outline: "none",
        }}
      />
    </div>
  );
}

export function Sel({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { v: string; l: string })[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: T.g100, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
          {label}
        </div>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          background: T.surf3,
          border: `1px solid ${T.g600}`,
          borderRadius: 7,
          padding: "9px 12px",
          color: T.white,
          fontSize: 12,
          fontFamily: "inherit",
          outline: "none",
          appearance: "none",
          cursor: "pointer",
        }}
      >
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.v;
          const lbl = typeof o === "string" ? o : o.l;
          return (
            <option key={val} value={val} style={{ background: T.surf3 }}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function LiveDot({ color = T.green }: { color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: "pulse 2s ease-in-out infinite",
        flexShrink: 0,
      }}
    />
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: T.white, letterSpacing: "-.025em", lineHeight: 1, marginBottom: 5 }}>
        {title}
      </h2>
      {sub && <p style={{ fontSize: 12, color: T.g100 }}>{sub}</p>}
    </div>
  );
}
