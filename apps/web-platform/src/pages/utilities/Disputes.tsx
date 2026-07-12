import { useEffect, useState } from "react";
import type { Dispute } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, SectionTitle, Badge, Btn, Input, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { api } from "../../api";

export function Disputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<Dispute[]>("/billing/disputes")
      .then(setDisputes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load disputes"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const resolve = async (id: string, status: "resolved" | "rejected") => {
    const resolutionNote = notes[id]?.trim();
    if (!resolutionNote) return;
    setResolving(id);
    setError(null);
    try {
      const updated = await api.post<Dispute>(`/billing/disputes/${id}/resolve`, { status, resolutionNote });
      setDisputes((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve dispute");
    } finally {
      setResolving(null);
    }
  };

  if (loading) return <LoadingState label="Loading disputes…" />;
  if (error && disputes.length === 0) return <ErrorState message={error} onRetry={load} />;

  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "under_review");
  const closedDisputes = disputes.filter((d) => d.status === "resolved" || d.status === "rejected");

  return (
    <div>
      <SectionTitle title="Billing Disputes" sub="Citizen-raised queries against invoices — review and resolve" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Open" value={String(openDisputes.length)} sub="Awaiting resolution" accent={T.amber} icon={IC.chat} />
        <KpiCard label="Resolved" value={String(disputes.filter((d) => d.status === "resolved").length)} sub="All time" accent={T.green} icon={IC.check} />
        <KpiCard label="Rejected" value={String(disputes.filter((d) => d.status === "rejected").length)} sub="All time" accent={T.red} icon={IC.alert} />
      </div>

      <Card s={{ marginBottom: 20 }}>
        <CH title="Open Disputes" icon={IC.chat} accent={T.amber} />
        <div>
          {openDisputes.map((d) => (
            <div key={d.id} style={{ padding: "14px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{d.id} · {d.accountNumber} · {d.invoiceId}</div>
                <Badge v={d.status} />
              </div>
              <div style={{ fontSize: 11, color: T.g200, marginBottom: 2 }}>{d.reason}</div>
              <div style={{ fontSize: 12, color: T.white2, marginBottom: 10 }}>{d.description}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <Input label="" value={notes[d.id] ?? ""} onChange={(v) => setNotes((prev) => ({ ...prev, [d.id]: v }))} placeholder="Resolution note (required)" />
                </div>
                <Btn ch="Resolve" sm v="green" onClick={() => resolve(d.id, "resolved")} disabled={resolving === d.id || !notes[d.id]?.trim()} />
                <Btn ch="Reject" sm v="ghost" onClick={() => resolve(d.id, "rejected")} disabled={resolving === d.id || !notes[d.id]?.trim()} />
              </div>
            </div>
          ))}
          {openDisputes.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No open disputes.</div>}
        </div>
      </Card>

      <Card>
        <CH title="Closed Disputes" icon={IC.dash} />
        <div>
          {closedDisputes.map((d) => (
            <div key={d.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{d.id} · {d.accountNumber} · {d.invoiceId}</div>
                <Badge v={d.status} />
              </div>
              <div style={{ fontSize: 11, color: T.g200 }}>{d.resolutionNote}</div>
            </div>
          ))}
          {closedDisputes.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No closed disputes yet.</div>}
        </div>
      </Card>
    </div>
  );
}
