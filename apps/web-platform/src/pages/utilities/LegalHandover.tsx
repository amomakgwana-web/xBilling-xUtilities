import { useEffect, useState } from "react";
import type { Account } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, TRow, SectionTitle, Badge, Btn, Spin, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { api } from "../../api";

export function LegalHandover() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<Account[]>("/billing/accounts?status=handover")
      .then(setAccounts)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load handover book"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const pullBack = async (accountNumber: string) => {
    setPulling(accountNumber);
    try {
      await api.post(`/billing/accounts/${accountNumber}/handover`);
      setAccounts((prev) => prev.filter((a) => a.accountNumber !== accountNumber));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pull account back");
    } finally {
      setPulling(null);
    }
  };

  if (loading) return <LoadingState label="Loading legal & handover book…" />;
  if (error && accounts.length === 0) return <ErrorState message={error} onRetry={load} />;

  const totalOwed = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div>
      <SectionTitle title="Legal & Handover" sub="Accounts escalated to debt collection — flagged from the Arrears workbench" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Accounts in Handover" value={String(accounts.length)} sub="Escalated for legal action" accent={T.red} icon={IC.alert} />
        <KpiCard label="Total Owed" value={fmtR(totalOwed)} sub="Across accounts in handover" accent={T.brand} icon={IC.billing} />
      </div>

      <Card>
        <CH title="Handover Book" icon={IC.alert} accent={T.red} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TRow cols={["Account", "Consumer", "Municipality", "Balance", "Status", ""]} />
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{a.accountNumber}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>{a.consumerName}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{a.municipality}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: T.white }}>{fmtR(a.balance)}</td>
                  <td style={{ padding: "10px 14px" }}><Badge v={a.status} /></td>
                  <td style={{ padding: "10px 14px" }}>
                    <Btn ch={pulling === a.accountNumber ? <Spin s={12} /> : "Pull back"} sm v="ghost" onClick={() => pullBack(a.accountNumber)} disabled={pulling === a.accountNumber} />
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 18, fontSize: 12, color: T.g200 }}>No accounts currently in legal/handover.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
