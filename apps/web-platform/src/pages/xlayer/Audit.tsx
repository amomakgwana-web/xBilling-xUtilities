import { useEffect, useState } from "react";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, LiveDot, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap, callRpc } from "../../lib/db";

interface AuditEvent {
  id: number;
  actor: string;
  actorName?: string;
  role?: string;
  action: string;
  target?: string | null;
  prevHash: string;
  hash: string;
  createdAt: string;
}

interface ChainStatus {
  intact: boolean;
  brokenAtId: number | null;
  events: number;
}

export function Audit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      unwrap<AuditEvent[]>(supabase.from("audit_events").select("*").order("id", { ascending: false }).limit(100)),
      callRpc<ChainStatus>("verify_audit_chain"),
    ])
      .then(([e, c]) => {
        setEvents(e);
        setChain(c);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audit trail"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const reverify = async () => {
    setVerifying(true);
    try {
      setChain(await callRpc<ChainStatus>("verify_audit_chain"));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <LoadingState label="Loading audit trail…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SectionTitle title="Audit Trail" sub="Hash-chained, tamper-evident log of every mutating platform action" />
        <Btn ch={verifying ? "Verifying…" : "Re-verify chain"} onClick={reverify} disabled={verifying} v="dark" />
      </div>

      {chain && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: chain.intact ? T.greenBg : T.redBg,
            border: `1px solid ${chain.intact ? T.green : T.red}40`,
          }}
        >
          <LiveDot color={chain.intact ? T.green : T.red} />
          <span style={{ fontSize: 12, fontWeight: 700, color: chain.intact ? T.greenT : T.redT }}>
            {chain.intact
              ? `Chain intact — ${chain.events} events, every hash verified against its predecessor`
              : `CHAIN BROKEN at event #${chain.brokenAtId} — records were altered after the fact`}
          </span>
        </div>
      )}

      <Card>
        <CH title="Events" sub="Most recent first" icon={IC.shield} accent={T.purple} />
        <div>
          {events.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <div style={{ fontSize: 10, color: T.g300, fontFamily: "monospace", width: 36 }}>#{e.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.white, fontFamily: "monospace" }}>{e.action}</div>
                <div style={{ fontSize: 10, color: T.g200, marginTop: 2 }}>
                  {e.actorName ?? e.actor}
                  {e.role ? ` · ${e.role}` : ""}
                  {e.target ? ` · ${e.target}` : ""} · {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
              <div style={{ fontSize: 10, color: T.purpleT, fontFamily: "monospace" }} title={`hash ${e.hash}\nprev ${e.prevHash}`}>
                {e.hash.slice(0, 12)}…
              </div>
            </div>
          ))}
          {events.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No events yet — perform any mutating action and it will land here.</div>}
        </div>
      </Card>
    </div>
  );
}
