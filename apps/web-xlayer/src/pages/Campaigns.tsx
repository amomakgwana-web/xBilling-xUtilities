import { useEffect, useState } from "react";
import type { Campaign } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Input, Sel, Spin, LoadingState, ErrorState, fmtN } from "@xplatform/ui-kit";
import { api } from "../api";

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"SMS" | "Email">("SMS");
  const [draft, setDraft] = useState<{ text: string; mocked: boolean } | null>(null);
  const [drafting, setDrafting] = useState(false);

  const load = () => {
    setError(null);
    return api
      .get<Campaign[]>("/comms/campaigns")
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const createCampaign = async () => {
    if (!name.trim()) return;
    await api.post("/comms/campaigns", { name, type, municipality: "All" });
    setName("");
    await load();
  };

  const draftSms = async () => {
    setDrafting(true);
    const result = await api.post<{ text: string; mocked: boolean }>("/comms/insight/draft-sms", {
      brief: name || "Final demand for overdue accounts 90+ days",
    });
    setDraft(result);
    setDrafting(false);
  };

  if (loading) return <LoadingState label="Loading campaigns…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Campaign Manager" sub="xCentral · bulk SMS &amp; email dispatch" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        <Card>
          <CH title="All Campaigns" icon={IC.campaign} />
          <div>
            {campaigns.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${T.g700}` }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.type === "SMS" ? T.green : T.cyan, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>
                    {fmtN(c.sent)} sent · {fmtN(c.paid)} paid · {fmtN(c.unpaid)} unpaid · {c.municipality}
                  </div>
                </div>
                <Badge v={c.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CH title="New Campaign" icon={IC.plus} />
          <div style={{ padding: "16px 18px" }}>
            <Input label="Campaign Name" value={name} onChange={setName} placeholder="e.g. June Overdue Reminder" />
            <Sel label="Channel" value={type} onChange={(v) => setType(v as "SMS" | "Email")} options={["SMS", "Email"]} />
            <Btn ch="Create Campaign" onClick={createCampaign} full />
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.g700}` }}>
              <Btn ch={drafting ? <><Spin s={12} /> Drafting…</> : <>{IC.eye} AI Draft SMS Copy</>} onClick={draftSms} disabled={drafting} v="dark" full />
              {draft && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: T.surf3, border: `1px solid ${T.g700}`, borderRadius: 7, fontSize: 12, color: T.white2, fontFamily: "monospace" }}>
                  {draft.text}
                  {draft.mocked && <div style={{ marginTop: 6, fontSize: 10, color: T.g200, fontStyle: "italic" }}>(canned — set ANTHROPIC_API_KEY for live drafting)</div>}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
