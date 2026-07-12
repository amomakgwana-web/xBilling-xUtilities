import { useEffect, useState } from "react";
import type { Dispute, Invoice } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Input, Sel, Spin, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { api } from "../../api";
import { useAccount } from "../../AccountContext";

const REASONS = ["Incorrect meter reading", "Billed for wrong tariff", "Duplicate charge", "Payment not reflected", "Other"];

export function Disputes() {
  const { accountNumber } = useAccount();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState<string>(REASONS[0] ?? "Other");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Dispute[]>(`/billing/disputes?accountNumber=${accountNumber}`),
      api.get<Invoice[]>(`/billing/invoices?accountNumber=${accountNumber}`),
    ])
      .then(([d, inv]) => {
        setDisputes(d);
        setInvoices(inv);
        setInvoiceId((prev) => prev || inv[0]?.id || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load disputes"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accountNumber]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const dispute = await api.post<Dispute>("/billing/disputes", { accountNumber, invoiceId, reason, description });
      setDisputes((prev) => [dispute, ...prev]);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise dispute");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading disputes…" />;

  return (
    <div>
      <SectionTitle title="Billing Disputes" sub="Raise a query against an invoice on your account" />

      <Card s={{ marginBottom: 20, maxWidth: 520 }}>
        <CH title="Raise a Dispute" icon={IC.chat} />
        <div style={{ padding: "16px 18px" }}>
          <Sel
            label="Invoice"
            value={invoiceId}
            onChange={setInvoiceId}
            options={invoices.map((i) => ({ v: i.id, l: `${i.id} — ${fmtR(i.totalAmount)} (${i.status})` }))}
          />
          <Sel label="Reason" value={reason} onChange={setReason} options={REASONS} />
          <Input label="Description" value={description} onChange={setDescription} placeholder="Describe the issue in detail" />
          <Btn ch={submitting ? <><Spin s={12} /> Submitting…</> : "Submit Dispute"} onClick={submit} disabled={submitting || !invoiceId || !description} full />
          {error && (
            <div style={{ marginTop: 12, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
              {error}
            </div>
          )}
          {invoices.length === 0 && <div style={{ marginTop: 8, fontSize: 11, color: T.g200 }}>No invoices on this account yet.</div>}
        </div>
      </Card>

      <Card s={{ maxWidth: 520 }}>
        <CH title="Your Disputes" icon={IC.dash} />
        <div>
          {disputes.map((d) => (
            <div key={d.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{d.reason} · {d.invoiceId}</div>
                <Badge v={d.status} />
              </div>
              <div style={{ fontSize: 11, color: T.g200 }}>{d.description}</div>
              {d.resolutionNote && (
                <div style={{ marginTop: 6, fontSize: 11, color: T.g100, padding: "6px 8px", background: T.surf3, borderRadius: 6, border: `1px solid ${T.g700}` }}>
                  Municipality response: {d.resolutionNote}
                </div>
              )}
              <div style={{ fontSize: 10, color: T.g300, marginTop: 4 }}>Raised {d.createdAt.slice(0, 10)}</div>
            </div>
          ))}
          {disputes.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No disputes raised yet.</div>}
        </div>
      </Card>
    </div>
  );
}
