import { useEffect, useState } from "react";
import { T, IC, Card, CH, SectionTitle, Btn, Input, Spin, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { api } from "../../api";

interface Municipality {
  id: string;
  name: string;
  province: string;
  brandColor: string;
  contactEmail?: string;
  contactPhone?: string;
}

export function Settings() {
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<Municipality[]>("/platform/municipalities")
      .then((rows) => {
        const own = rows[0] ?? null;
        setMunicipality(own);
        setEmail(own?.contactEmail ?? "");
        setPhone(own?.contactPhone ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your municipality"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!municipality) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.patch<Municipality>(`/platform/municipalities/${municipality.id}`, {
        contactEmail: email,
        contactPhone: phone,
      });
      setMunicipality(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!municipality) return <ErrorState message="No municipality is linked to your account." onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Settings" sub={`${municipality.name} · ${municipality.province}`} />

      <div style={{ maxWidth: 480 }}>
        <Card>
          <CH title="Public Contact Details" sub="Shown to citizens on statements and reminders" icon={IC.settings} accent={municipality.brandColor} />
          <div style={{ padding: "16px 18px" }}>
            <Input label="Contact email" value={email} onChange={setEmail} placeholder="billing@municipality.gov.za" />
            <Input label="Contact phone" value={phone} onChange={setPhone} placeholder="+27 11 999 0000" />
            <Btn ch={saving ? <><Spin s={12} c="rgba(255,255,255,.6)" /> Saving…</> : "Save"} onClick={save} disabled={saving} full />
            {saved && (
              <div style={{ marginTop: 12, padding: "9px 12px", background: T.greenBg, border: `1px solid ${T.green}40`, borderRadius: 7, fontSize: 12, color: T.greenT }}>
                Saved.
              </div>
            )}
          </div>
        </Card>
        <p style={{ fontSize: 11, color: T.g300, marginTop: 12 }}>
          Branding and naming are managed by the platform team — reach out via xLayer if these need to change.
        </p>
      </div>
    </div>
  );
}
