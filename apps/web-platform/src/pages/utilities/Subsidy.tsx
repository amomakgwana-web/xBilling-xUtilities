import { useEffect, useState } from "react";
import type { SubsidyApplication } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, TRow, SectionTitle, Badge, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap } from "../../lib/db";

export function Subsidy() {
  const [applications, setApplications] = useState<SubsidyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    unwrap<SubsidyApplication[]>(supabase.from("subsidy_applications").select("*").order("appliedAt", { ascending: false }))
      .then(setApplications)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subsidy applications"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading indigent subsidy applications…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const approved = applications.filter((a) => a.status === "approved");
  const avgSubsidy = approved.length ? Math.round(approved.reduce((sum, a) => sum + a.subsidyPercent, 0) / approved.length) : 0;

  return (
    <div>
      <SectionTitle title="Indigent Subsidy" sub="Household-income-based applications — automatically assessed on submission" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Applications" value={String(applications.length)} sub="All time" accent={T.brand} icon={IC.users} />
        <KpiCard label="Approved" value={String(approved.length)} sub={`${applications.length - approved.length} not eligible`} accent={T.green} icon={IC.check} />
        <KpiCard label="Avg Subsidy" value={`${avgSubsidy}%`} sub="Among approved households" accent={T.cyan} icon={IC.chart} />
      </div>

      <Card>
        <CH title="Applications" icon={IC.users} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TRow cols={["Application", "Account", "Household Income", "Household Size", "Subsidy", "Applied", "Status"]} />
            <tbody>
              {applications.map((a) => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{a.id}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200, fontFamily: "monospace" }}>{a.accountNumber}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>R{a.householdIncome.toLocaleString()}/mo</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{a.householdSize}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: T.white }}>{a.status === "approved" ? `${a.subsidyPercent}%` : "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{a.appliedAt.slice(0, 10)}</td>
                  <td style={{ padding: "10px 14px" }}><Badge v={a.status} /></td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 18, fontSize: 12, color: T.g200 }}>No subsidy applications yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
