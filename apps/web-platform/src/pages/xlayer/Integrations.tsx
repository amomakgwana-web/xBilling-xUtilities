import { useEffect, useState } from "react";
import type { ApiKey, ApiKeyCreated, ComplianceScore, Integration } from "@xplatform/shared-types";
import { T, IC, Card, CH, Tab, TRow, SectionTitle, Badge, Btn, Input, Spin, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap, callRpc } from "../../lib/db";

function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<ApiKeyCreated | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    unwrap<ApiKey[]>(supabase.from("api_keys").select("*").order("createdAt", { ascending: false }))
      .then(setKeys)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load API keys"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    setJustCreated(null);
    try {
      const created = await callRpc<ApiKeyCreated>("create_api_key", { p_name: name });
      setKeys((prev) => [created, ...prev]);
      setJustCreated(created);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      const updated = await callRpc<ApiKey>("revoke_api_key", { p_id: id });
      setKeys((prev) => prev.map((k) => (k.id === id ? updated : k)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setRevoking(null);
    }
  };

  if (loading) return <LoadingState label="Loading API keys…" />;

  return (
    <div>
      <Card s={{ marginBottom: 20, maxWidth: 520 }}>
        <CH title="Generate a Key" icon={IC.key} />
        <div style={{ padding: "16px 18px" }}>
          <Input label="Name" value={name} onChange={setName} placeholder="e.g. Billing export job" />
          <Btn ch={creating ? <><Spin s={12} /> Generating…</> : "Generate Key"} onClick={create} disabled={creating || !name.trim()} full />
          {justCreated && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: T.greenBg, border: `1px solid ${T.green}40`, borderRadius: 7 }}>
              <div style={{ fontSize: 11, color: T.greenT, marginBottom: 6 }}>Copy this now — it will not be shown again.</div>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: T.white, wordBreak: "break-all" }}>{justCreated.key}</div>
            </div>
          )}
          {error && (
            <div style={{ marginTop: 12, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
              {error}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CH title="Active & Revoked Keys" sub={`${keys.length} total`} icon={IC.key} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TRow cols={["Name", "Prefix", "Created By", "Created", "Status", ""]} />
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>{k.name}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{k.keyPrefix}…</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{k.createdBy}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{k.createdAt.slice(0, 10)}</td>
                  <td style={{ padding: "10px 14px" }}><Badge v={k.revokedAt ? "cancelled" : "active"} label={k.revokedAt ? "Revoked" : "Active"} /></td>
                  <td style={{ padding: "10px 14px" }}>
                    {!k.revokedAt && (
                      <Btn ch={revoking === k.id ? <Spin s={12} /> : "Revoke"} sm v="ghost" onClick={() => revoke(k.id)} disabled={revoking === k.id} />
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 18, fontSize: 12, color: T.g200 }}>No API keys yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function Integrations() {
  const [tab, setTab] = useState("registry");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [score, setScore] = useState<ComplianceScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      unwrap<Integration[]>(supabase.from("integrations").select("*")),
      unwrap<{ score: number }>(supabase.from("compliance_score").select("score").single()),
      unwrap<ComplianceScore["frameworks"]>(supabase.from("frameworks").select("*")),
    ])
      .then(([i, scoreRow, frameworks]) => {
        setIntegrations(i);
        setScore({ score: scoreRow.score, frameworks });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load integrations"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <SectionTitle title="Integrations & Compliance" sub="Third-party registry · ISO 27001 · POPIA · PCI-DSS · API key management" />

      <Tab
        tabs={[
          { id: "registry", label: "Registry & Compliance", icon: IC.plug },
          { id: "keys", label: "API Keys", icon: IC.key },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "registry" &&
        (loading ? (
          <LoadingState label="Loading integrations…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
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
          </>
        ))}

      {tab === "keys" && <ApiKeys />}
    </div>
  );
}
