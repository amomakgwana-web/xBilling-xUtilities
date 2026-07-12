import { useEffect, useMemo, useState } from "react";
import type { Tariff } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Input, Sel, Spin, TRow, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { api } from "../../api";

const KNOWN_CODES = ["RES-STD", "RES-PREM", "COM-STD"];

function emptyDraft() {
  return {
    code: KNOWN_CODES[0] ?? "",
    description: "",
    electricityPerKwh: "",
    waterPerKl: "",
    refuseMonthly: "",
    sewerMonthly: "",
    vatRate: "0.15",
    validFrom: new Date().toISOString().slice(0, 10),
  };
}

export function Tariffs() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<Tariff[]>("/billing/tariffs")
      .then(setTariffs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tariffs"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const today = new Date().toISOString().slice(0, 10);
  const current = useMemo(() => {
    const byCode = new Map<string, Tariff>();
    for (const t of tariffs) {
      if (t.validFrom > today) continue;
      if (t.validTo && t.validTo < today) continue;
      const existing = byCode.get(t.code);
      if (!existing || t.validFrom > existing.validFrom) byCode.set(t.code, t);
    }
    return byCode;
  }, [tariffs, today]);

  const applyKnownCode = (code: string) => {
    const existing = current.get(code);
    setDraft((d) => ({
      ...d,
      code,
      description: existing?.description ?? d.description,
      electricityPerKwh: existing ? String(existing.electricityPerKwh) : d.electricityPerKwh,
      waterPerKl: existing ? String(existing.waterPerKl) : d.waterPerKl,
      refuseMonthly: existing ? String(existing.refuseMonthly) : d.refuseMonthly,
      sewerMonthly: existing ? String(existing.sewerMonthly) : d.sewerMonthly,
      vatRate: existing ? String(existing.vatRate) : d.vatRate,
    }));
  };

  const schedule = async () => {
    setSaving(true);
    setError(null);
    try {
      const tariff = await api.post<Tariff>("/billing/tariffs", {
        code: draft.code,
        description: draft.description,
        electricityPerKwh: Number(draft.electricityPerKwh),
        waterPerKl: Number(draft.waterPerKl),
        refuseMonthly: Number(draft.refuseMonthly),
        sewerMonthly: Number(draft.sewerMonthly),
        vatRate: Number(draft.vatRate),
        validFrom: draft.validFrom,
      });
      setTariffs((prev) => [tariff, ...prev]);
      setDraft(emptyDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule tariff change");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading tariff book…" />;
  if (error && tariffs.length === 0) return <ErrorState message={error} onRetry={load} />;

  const numbersValid = ["electricityPerKwh", "waterPerKl", "refuseMonthly", "sewerMonthly", "vatRate"].every(
    (k) => draft[k as keyof typeof draft] !== "" && Number.isFinite(Number(draft[k as keyof typeof draft])),
  );

  return (
    <div>
      <SectionTitle title="Tariff Book" sub="Platform-wide rates — effective-dated, so a change never rewrites what a past invoice was billed at" />

      <Card s={{ marginBottom: 20, maxWidth: 560 }}>
        <CH title="Schedule a Rate Change" sub="Applies from the date below; the current rate stays in force until then" icon={IC.chart} />
        <div style={{ padding: "16px 18px" }}>
          <Sel label="Tariff code" value={draft.code} onChange={applyKnownCode} options={KNOWN_CODES} />
          <Input label="Description" value={draft.description} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} placeholder="e.g. Residential standard" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Electricity (R/kWh)" value={draft.electricityPerKwh} onChange={(v) => setDraft((d) => ({ ...d, electricityPerKwh: v }))} type="number" />
            <Input label="Water (R/kl)" value={draft.waterPerKl} onChange={(v) => setDraft((d) => ({ ...d, waterPerKl: v }))} type="number" />
            <Input label="Refuse (R/mo)" value={draft.refuseMonthly} onChange={(v) => setDraft((d) => ({ ...d, refuseMonthly: v }))} type="number" />
            <Input label="Sewer (R/mo)" value={draft.sewerMonthly} onChange={(v) => setDraft((d) => ({ ...d, sewerMonthly: v }))} type="number" />
            <Input label="VAT rate" value={draft.vatRate} onChange={(v) => setDraft((d) => ({ ...d, vatRate: v }))} type="number" />
            <Input label="Effective from" value={draft.validFrom} onChange={(v) => setDraft((d) => ({ ...d, validFrom: v }))} type="date" />
          </div>
          <Btn
            ch={saving ? <><Spin s={12} /> Scheduling…</> : "Schedule Rate Change"}
            onClick={schedule}
            disabled={saving || !draft.description || !numbersValid || !draft.validFrom}
            full
          />
          {error && (
            <div style={{ marginTop: 12, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
              {error}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CH title="Effective-Dating History" sub="Every rate ever in force, newest first" icon={IC.db} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TRow cols={["Code", "Description", "Electricity", "Water", "Refuse", "Sewer", "VAT", "Valid From", "Valid To", ""]} />
            <tbody>
              {tariffs.map((t) => {
                const isCurrent = current.get(t.code)?.id === t.id;
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{t.code}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>{t.description}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{fmtR(t.electricityPerKwh)}/kWh</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{fmtR(t.waterPerKl)}/kl</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{fmtR(t.refuseMonthly)}/mo</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{fmtR(t.sewerMonthly)}/mo</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{(t.vatRate * 100).toFixed(0)}%</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{t.validFrom}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{t.validTo ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>{isCurrent && <Badge v="active" label="Current" />}</td>
                  </tr>
                );
              })}
              {tariffs.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 18, fontSize: 12, color: T.g200 }}>No tariffs on file.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
