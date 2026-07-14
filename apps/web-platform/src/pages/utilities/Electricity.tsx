import { useEffect, useMemo, useState } from "react";
import type { VendedToken } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, TRow, SectionTitle, LoadingState, ErrorState, fmtN, fmtR } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap } from "../../lib/db";

export function Electricity() {
  const [tokens, setTokens] = useState<VendedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    unwrap<VendedToken[]>(supabase.from("vended_tokens").select("*").order("vendedAt", { ascending: false }))
      .then(setTokens)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load token history"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const today = new Date().toISOString().slice(0, 10);
  const vendedToday = useMemo(() => tokens.filter((t) => t.vendedAt.slice(0, 10) === today), [tokens, today]);

  if (loading) return <LoadingState label="Loading prepaid token history…" />;
  if (error && tokens.length === 0) return <ErrorState message={error} onRetry={load} />;

  const totalRevenue = tokens.reduce((sum, t) => sum + t.amount, 0);
  const totalUnits = tokens.reduce((sum, t) => sum + t.units, 0);

  return (
    <div>
      <SectionTitle title="Electricity" sub="Prepaid STS token vend history across all meters" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Tokens Vended" value={String(tokens.length)} sub={`${vendedToday.length} today`} accent={T.brand} icon={IC.bolt} />
        <KpiCard label="Prepaid Revenue" value={fmtR(totalRevenue)} sub="All time" accent={T.green} icon={IC.billing} />
        <KpiCard label="Units Sold" value={`${fmtN(Math.round(totalUnits))} kWh`} sub="All time" accent={T.cyan} icon={IC.bolt} />
        <KpiCard label="Avg Purchase" value={tokens.length ? fmtR(totalRevenue / tokens.length) : "—"} sub="Per token" accent={T.amber} icon={IC.chart} />
      </div>

      <Card>
        <CH title="Vend History" sub="Newest first" icon={IC.bolt} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TRow cols={["Meter", "Account", "Token", "Amount", "Units", "Vended At"]} />
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{t.serial}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200, fontFamily: "monospace" }}>{t.accountNumber}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.white2, fontFamily: "monospace" }}>{t.token}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: T.white }}>{fmtR(t.amount)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{t.units} kWh</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{new Date(t.vendedAt).toLocaleString()}</td>
                </tr>
              ))}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 18, fontSize: 12, color: T.g200 }}>No prepaid tokens vended yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
