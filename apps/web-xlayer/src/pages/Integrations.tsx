import { useEffect, useState } from "react";
import type { ComplianceScore, Integration } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { api } from "../api";

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [score, setScore] = useState<ComplianceScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.get<Integration[]>("/compliance/integrations"), api.get<ComplianceScore>("/compliance/score")])
      .then(([i, s]) => {
        setIntegrations(i);
        setScore(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load integrations"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading integrations…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Integrations & Compliance" sub="Third-party registry · ISO 27001 · POPIA · PCI-DSS" />

      <Card s={{ marginBottom: 20 }}>
        <CH title="Compliance Score" icon={IC.shield} accent={T.amber} />
        <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: `100px repeat(${score?.frameworks.length ?? 1}, 1fr)`, gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: T.amber }}>{score?.score}/100</div>
          {score?.frameworks.map((f) => (
            <div key={f.name} style={{ background: T.surf3, borderRadius: 8, padding: 12, border: `1px solid ${T.g700}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.white, marginBottom: 4 }}>{f.name}</div>
              <div style={{ fontSize: 11, color: T.g200, marginBottom: 8 }}>Audited {f.lastAuditedAt}</div>
              <Badge v={f.status === "compliant" ? "good" : f.status === "in_progress" ? "review" : "flagged"} label={f.status.replace("_", " ")} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CH title="Third-Party Integration Registry" sub={`${integrations.length} configured`} icon={IC.plug} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
          {integrations.map((i) => (
            <div key={i.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${T.g700}`, borderRight: `1px solid ${T.g700}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{i.name}</div>
                <Badge v={i.status} />
              </div>
              <div style={{ fontSize: 11, color: T.g200, marginBottom: 4 }}>{i.category}</div>
              <div style={{ fontSize: 10, color: T.g300, fontFamily: "monospace", marginBottom: 6 }}>{i.endpoint}</div>
              <div style={{ fontSize: 11, color: T.white3, lineHeight: 1.4 }}>{i.description}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
