import { useEffect, useState } from "react";
import type { MeterFault } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { api } from "../api";

export function Faults() {
  const [faults, setFaults] = useState<MeterFault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    return api
      .get<MeterFault[]>("/metering/faults")
      .then(setFaults)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load faults"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const dispatch = async (id: string) => {
    await api.post(`/metering/faults/${id}/dispatch`);
    setFaults((prev) => prev.map((f) => (f.id === id ? { ...f, status: "dispatched" } : f)));
  };

  const resolve = async (id: string) => {
    await api.post(`/metering/faults/${id}/resolve`);
    setFaults((prev) => prev.map((f) => (f.id === id ? { ...f, status: "resolved" } : f)));
  };

  if (loading) return <LoadingState label="Loading faults…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Fault Management" sub="Reported meter anomalies and technician dispatch" />
      <Card>
        <CH title="All Faults" icon={IC.alert} accent={T.red} />
        <div>
          {faults.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <span style={{ color: f.severity === "high" ? T.red : f.severity === "medium" ? T.amber : T.g200 }}>{IC.alert}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.white, fontFamily: "monospace" }}>{f.serial}</div>
                <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>{f.description}</div>
                <div style={{ fontSize: 10, color: T.g300, marginTop: 2 }}>Reported {new Date(f.reportedAt).toLocaleString()}</div>
              </div>
              <Badge v={f.status === "reported" ? "alert" : f.status === "dispatched" ? "pending" : "completed"} label={f.status} />
              {f.status === "reported" && <Btn ch="Dispatch" sm v="ghost" onClick={() => dispatch(f.id)} />}
              {f.status === "dispatched" && <Btn ch="Mark Resolved" sm v="green" onClick={() => resolve(f.id)} />}
            </div>
          ))}
          {faults.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No faults reported.</div>}
        </div>
      </Card>
    </div>
  );
}
