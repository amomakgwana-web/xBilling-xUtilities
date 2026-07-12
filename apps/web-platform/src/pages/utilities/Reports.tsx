import { useEffect, useMemo, useState } from "react";
import type { Account, Dispute, Invoice, SubsidyApplication } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, SectionTitle, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { api } from "../../api";

function Bar({ label, value, max, accent, format }: { label: string; value: number; max: number; accent: string; format?: (v: number) => string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.g100, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: T.white }}>{format ? format(value) : value}</span>
      </div>
      <div style={{ height: 8, background: T.surf3, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function Reports() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subsidy, setSubsidy] = useState<SubsidyApplication[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Account[]>("/billing/accounts"),
      api.get<Invoice[]>("/billing/invoices"),
      api.get<SubsidyApplication[]>("/billing/subsidy"),
      api.get<Dispute[]>("/billing/disputes"),
    ])
      .then(([acc, inv, sub, dis]) => {
        setAccounts(acc);
        setInvoices(inv);
        setSubsidy(sub);
        setDisputes(dis);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report data"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const revenueByMunicipality = useMemo(() => {
    const byMun = new Map<string, number>();
    for (const inv of invoices) {
      const account = accounts.find((a) => a.accountNumber === inv.accountNumber);
      const key = account?.municipality ?? "Unknown";
      byMun.set(key, (byMun.get(key) ?? 0) + inv.amountPaid);
    }
    return Array.from(byMun.entries()).sort((a, b) => b[1] - a[1]);
  }, [invoices, accounts]);

  const totalRevenue = invoices.reduce((sum, i) => sum + i.amountPaid, 0);
  const totalOutstanding = accounts.reduce((sum, a) => sum + a.balance, 0);
  const inArrears = accounts.filter((a) => a.balance > 0).length;
  const approvedSubsidy = subsidy.filter((s) => s.status === "approved");
  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "under_review");
  const maxMunRevenue = Math.max(1, ...revenueByMunicipality.map(([, v]) => v));

  const invoiceStatusCounts = useMemo(() => {
    const counts = { paid: 0, pending: 0, overdue: 0, other: 0 };
    for (const inv of invoices) {
      if (inv.status === "paid") counts.paid++;
      else if (inv.status === "overdue") counts.overdue++;
      else if (inv.status === "pending") counts.pending++;
      else counts.other++;
    }
    return counts;
  }, [invoices]);

  if (loading) return <LoadingState label="Loading reports…" />;
  if (error && accounts.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Reports" sub="Revenue, arrears, subsidy uptake and dispute volume — scoped to your municipality" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Revenue Collected" value={fmtR(totalRevenue)} sub={`${invoices.length} invoices`} accent={T.green} icon={IC.billing} />
        <KpiCard label="Outstanding" value={fmtR(totalOutstanding)} sub={`${inArrears} accounts owing`} accent={T.red} icon={IC.alert} />
        <KpiCard label="Subsidy Granted" value={String(approvedSubsidy.length)} sub={`${subsidy.length} applications total`} accent={T.brand} icon={IC.users} />
        <KpiCard label="Open Disputes" value={String(openDisputes.length)} sub={`${disputes.length} raised total`} accent={T.amber} icon={IC.chat} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <CH title="Revenue by Municipality" sub="Amount paid across all invoices" icon={IC.chart} />
          <div style={{ padding: "16px 18px" }}>
            {revenueByMunicipality.map(([mun, value]) => (
              <Bar key={mun} label={mun} value={value} max={maxMunRevenue} accent={T.brand} format={fmtR} />
            ))}
            {revenueByMunicipality.length === 0 && <div style={{ fontSize: 12, color: T.g200 }}>No invoice data yet.</div>}
          </div>
        </Card>

        <Card>
          <CH title="Invoice Status Mix" icon={IC.billing} />
          <div style={{ padding: "16px 18px" }}>
            <Bar label="Paid" value={invoiceStatusCounts.paid} max={invoices.length || 1} accent={T.green} />
            <Bar label="Pending" value={invoiceStatusCounts.pending} max={invoices.length || 1} accent={T.amber} />
            <Bar label="Overdue" value={invoiceStatusCounts.overdue} max={invoices.length || 1} accent={T.red} />
            <div style={{ fontSize: 10, color: T.g300, marginTop: 4 }}>Bars show invoice count, not amount, on the same 0–{invoices.length} scale.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
