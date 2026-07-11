import { useEffect, useMemo, useState } from "react";
import type { Account, Campaign, Invoice } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, TRow, SectionTitle, Badge, Btn, Spin, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { api } from "../../api";

const BUCKETS = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

function bucketFor(daysOverdue: number): (typeof BUCKETS)[number] {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1–30 days";
  if (daysOverdue <= 60) return "31–60 days";
  if (daysOverdue <= 90) return "61–90 days";
  return "90+ days";
}

export function Arrears() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Campaign | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.get<Account[]>("/billing/accounts"), api.get<Invoice[]>("/billing/invoices")])
      .then(([acc, inv]) => {
        setAccounts(acc);
        setInvoices(inv);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load arrears data"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const rows = useMemo(() => {
    const today = Date.now();
    return accounts
      .filter((a) => a.balance > 0)
      .map((a) => {
        const open = invoices.filter((i) => i.accountNumber === a.accountNumber && i.status !== "paid");
        const earliestDue = open.length ? Math.min(...open.map((i) => new Date(i.dueDate).getTime())) : undefined;
        const daysOverdue = earliestDue !== undefined ? Math.floor((today - earliestDue) / 86_400_000) : 0;
        return { ...a, daysOverdue, bucket: bucketFor(daysOverdue) };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [accounts, invoices]);

  const totalBook = rows.reduce((sum, r) => sum + r.balance, 0);
  const overdue = rows.filter((r) => r.daysOverdue > 0);

  const sendReminders = async () => {
    setSending(true);
    try {
      const campaign = await api.post<Campaign>("/comms/campaigns", {
        name: `Arrears reminder — ${new Date().toISOString().slice(0, 10)}`,
        type: "SMS",
        municipality: "All",
        // Real MSISDNs from the billing accounts — live SMS when the comms
        // gateway has BulkSMS credentials, mock queue otherwise.
        recipients: rows.map((r) => r.phone ?? r.accountNumber),
        message: "Your municipal account is in arrears. Pay via the xBilling portal, EFT or USSD *120# to avoid interruption.",
      });
      setSent(campaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reminder campaign");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState label="Loading arrears book…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SectionTitle title="Arrears" sub="Ageing across the debtor book · SMS reminders via xCentral" />
        <Btn
          ch={sending ? <><Spin s={12} c="rgba(255,255,255,.6)" /> Sending…</> : <>{IC.campaign} SMS all in arrears ({rows.length})</>}
          onClick={sendReminders}
          disabled={sending || rows.length === 0}
          v="dark"
        />
      </div>

      {sent && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: T.greenBg, border: `1px solid ${T.green}40`, borderRadius: 8, fontSize: 12, color: T.greenT }}>
          Campaign “{sent.name}” created — {sent.sent} SMS queued via MacroComm.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Arrears Book" value={fmtR(totalBook)} sub={`${rows.length} accounts owing`} accent={T.brand} icon={IC.billing} />
        <KpiCard label="Past Due" value={String(overdue.length)} sub="Accounts beyond due date" accent={T.red} icon={IC.alert} />
        <KpiCard label="Oldest Debt" value={rows[0] ? `${Math.max(rows[0].daysOverdue, 0)} days` : "—"} sub={rows[0] ? `${rows[0].consumerName} · ${rows[0].accountNumber}` : "Book is clean"} accent={T.amber} icon={IC.chart} />
      </div>

      <Card>
        <CH title="Accounts in Arrears" sub="Sorted by age of oldest unpaid invoice" icon={IC.alert} accent={T.amber} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TRow cols={["Account", "Consumer", "Municipality", "Tariff", "Balance", "Days Overdue", "Ageing", "Status"]} />
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{r.accountNumber}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>{r.consumerName}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{r.municipality}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{r.tariffCode}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: T.white }}>{fmtR(r.balance)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: r.daysOverdue > 0 ? T.redT : T.g200 }}>{Math.max(r.daysOverdue, 0)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: r.bucket === "Current" ? T.g200 : T.amberT }}>{r.bucket}</td>
                  <td style={{ padding: "10px 14px" }}><Badge v={r.status} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 18, fontSize: 12, color: T.g200 }}>No accounts in arrears — the whole book is settled.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
