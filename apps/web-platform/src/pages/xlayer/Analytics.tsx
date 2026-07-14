import { useEffect, useMemo, useState } from "react";
import type { Account, PaymentTransaction } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, SectionTitle, LoadingState, ErrorState, fmtR, fmtN } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap } from "../../lib/db";

function HBar({ label, value, max, accent, format }: { label: string; value: number; max: number; accent: string; format: (v: number) => string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.g100, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: T.white }}>{format(value)}</span>
      </div>
      <div style={{ height: 8, background: T.surf3, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function Sparkline({ points, accent }: { points: number[]; accent: string }) {
  const max = Math.max(1, ...points);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
      {points.map((p, i) => (
        <div
          key={i}
          title={String(p)}
          style={{ flex: 1, height: `${Math.max(4, Math.round((p / max) * 100))}%`, background: accent, borderRadius: "3px 3px 0 0", opacity: 0.55 + (i / points.length) * 0.45 }}
        />
      ))}
    </div>
  );
}

export function Analytics() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([unwrap<Account[]>(supabase.from("accounts").select("*")), unwrap<PaymentTransaction[]>(supabase.from("transactions").select("*"))])
      .then(([acc, tx]) => {
        setAccounts(acc);
        setTransactions(tx);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics data"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const gatewayMix = useMemo(() => {
    const byGateway = new Map<string, number>();
    for (const tx of transactions) byGateway.set(tx.gateway, (byGateway.get(tx.gateway) ?? 0) + tx.amount);
    return Array.from(byGateway.entries()).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const municipalityBook = useMemo(() => {
    const byMun = new Map<string, { balance: number; accounts: number }>();
    for (const a of accounts) {
      const entry = byMun.get(a.municipality) ?? { balance: 0, accounts: 0 };
      entry.balance += a.balance;
      entry.accounts += 1;
      byMun.set(a.municipality, entry);
    }
    return Array.from(byMun.entries()).sort((a, b) => b[1].balance - a[1].balance);
  }, [accounts]);

  const dailyVolume = useMemo(() => {
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const byDay = new Map(days.map((d) => [d, 0]));
    for (const tx of transactions) {
      const day = tx.createdAt.slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + tx.amount);
    }
    return days.map((d) => byDay.get(d) ?? 0);
  }, [transactions]);

  if (loading) return <LoadingState label="Loading platform analytics…" />;
  if (error && transactions.length === 0) return <ErrorState message={error} onRetry={load} />;

  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
  const avgTx = transactions.length ? totalVolume / transactions.length : 0;
  const matched = transactions.filter((t) => t.status === "matched").length;
  const matchRate = transactions.length ? Math.round((matched / transactions.length) * 100) : 0;
  const maxGateway = Math.max(1, ...gatewayMix.map(([, v]) => v));
  const maxMunBalance = Math.max(1, ...municipalityBook.map(([, v]) => v.balance));

  return (
    <div>
      <SectionTitle title="Analytics" sub="Platform-wide payment rail performance and municipality comparison" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Transaction Volume" value={fmtR(totalVolume)} sub={`${fmtN(transactions.length)} transactions`} accent={T.brand} icon={IC.pay} />
        <KpiCard label="Avg Transaction" value={fmtR(avgTx)} sub="Across all gateways" accent={T.green} icon={IC.chart} />
        <KpiCard label="Recon Match Rate" value={`${matchRate}%`} sub={`${matched}/${transactions.length} matched`} accent={T.cyan} icon={IC.recon} />
        <KpiCard label="Municipalities" value={String(municipalityBook.length)} sub={`${accounts.length} accounts total`} accent={T.amber} icon={IC.db} />
      </div>

      <Card s={{ marginBottom: 14 }}>
        <CH title="Daily Transaction Volume" sub="Last 14 days, all gateways" icon={IC.chart} />
        <div style={{ padding: "16px 18px" }}>
          <Sparkline points={dailyVolume} accent={T.brand} />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <CH title="Payment Gateway Mix" sub="Volume by gateway" icon={IC.pay} />
          <div style={{ padding: "16px 18px" }}>
            {gatewayMix.map(([gw, value]) => (
              <HBar key={gw} label={gw} value={value} max={maxGateway} accent={T.green} format={fmtR} />
            ))}
            {gatewayMix.length === 0 && <div style={{ fontSize: 12, color: T.g200 }}>No transaction data yet.</div>}
          </div>
        </Card>

        <Card>
          <CH title="Municipality Comparison" sub="Outstanding balance across the platform" icon={IC.db} />
          <div style={{ padding: "16px 18px" }}>
            {municipalityBook.map(([mun, data]) => (
              <HBar key={mun} label={`${mun} (${data.accounts})`} value={data.balance} max={maxMunBalance} accent={T.amber} format={fmtR} />
            ))}
            {municipalityBook.length === 0 && <div style={{ fontSize: 12, color: T.g200 }}>No account data yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
