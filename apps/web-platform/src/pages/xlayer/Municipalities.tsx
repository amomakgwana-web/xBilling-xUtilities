import { useEffect, useState } from "react";
import { T, IC, Card, CH, SectionTitle, Btn, Input, Spin, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap, callRpc } from "../../lib/db";

interface Municipality {
  id: string;
  name: string;
  province: string;
  brandColor: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export function Municipalities() {
  const [rows, setRows] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Municipality>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    unwrap<Municipality[]>(supabase.from("municipalities").select("*"))
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load municipalities"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startEdit = (m: Municipality) => {
    setEditing(m.id);
    setDraft(m);
  };

  const save = async (id: string) => {
    setSaving(true);
    try {
      const updated = await callRpc<Municipality>("edit_municipality", {
        p_id: id,
        p_patch: {
          name: draft.name,
          province: draft.province,
          brandColor: draft.brandColor,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
        },
      });
      setRows((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading municipalities…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Municipalities" sub="Tenant management · branding, contact details, and the scope each official's account is bound to" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {rows.map((m) => {
          const isEditing = editing === m.id;
          return (
            <Card key={m.id}>
              <CH
                title={m.name}
                sub={m.province}
                icon={IC.db}
                accent={m.brandColor}
                right={
                  !isEditing && (
                    <Btn ch="Edit" sm v="ghost" onClick={() => startEdit(m)} />
                  )
                }
              />
              <div style={{ padding: "16px 18px" }}>
                {isEditing ? (
                  <>
                    <Input label="Official name" value={draft.name ?? ""} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                    <Input label="Province" value={draft.province ?? ""} onChange={(v) => setDraft((d) => ({ ...d, province: v }))} />
                    <Input label="Brand colour" value={draft.brandColor ?? ""} onChange={(v) => setDraft((d) => ({ ...d, brandColor: v }))} placeholder="#F05A00" />
                    <Input label="Contact email" value={draft.contactEmail ?? ""} onChange={(v) => setDraft((d) => ({ ...d, contactEmail: v }))} />
                    <Input label="Contact phone" value={draft.contactPhone ?? ""} onChange={(v) => setDraft((d) => ({ ...d, contactPhone: v }))} />
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <Btn ch={saving ? <Spin s={12} /> : "Save"} onClick={() => save(m.id)} disabled={saving} />
                      <Btn ch="Cancel" v="ghost" onClick={() => setEditing(null)} disabled={saving} />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: m.brandColor, display: "inline-block", border: `1px solid ${T.g600}` }} />
                      <span style={{ fontSize: 11, color: T.g200, fontFamily: "monospace" }}>{m.brandColor}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.g100 }}>{m.contactEmail ?? "No contact email set"}</div>
                    <div style={{ fontSize: 12, color: T.g100, marginTop: 2 }}>{m.contactPhone ?? "No contact phone set"}</div>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
