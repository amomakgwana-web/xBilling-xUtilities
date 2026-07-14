import { useEffect, useState } from "react";
import type { Account, Invoice } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Spin, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap } from "../../lib/db";
import { useAccount } from "../../AccountContext";
import { downloadInvoicePdf } from "../../pdf";

type InvoiceLineRow = Invoice["lines"][number] & { invoiceId: string };

export function Invoices() {
  const { accountNumber } = useAccount();
  const [account, setAccount] = useState<Account | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      unwrap<Account>(supabase.from("accounts").select("*").eq("accountNumber", accountNumber).single()),
      unwrap<Omit<Invoice, "lines">[]>(
        supabase.from("invoices").select("*").eq("accountNumber", accountNumber).order("issueDate", { ascending: false }),
      ),
    ])
      .then(async ([acc, inv]) => {
        setAccount(acc);
        if (inv.length === 0) {
          setInvoices([]);
          return;
        }
        // The public.* views (db/014) have no PostgREST-visible foreign
        // keys to embed through, so line items are fetched separately and
        // grouped client-side.
        const lines = await unwrap<InvoiceLineRow[]>(
          supabase.from("invoice_lines").select("*").in("invoiceId", inv.map((i) => i.id)),
        );
        setInvoices(inv.map((i) => ({ ...i, lines: lines.filter((l) => l.invoiceId === i.id) })));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoices"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accountNumber]);

  const download = async (inv: Invoice) => {
    if (!account) return;
    setDownloading(inv.id);
    try {
      await downloadInvoicePdf(inv, account);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <LoadingState label="Loading invoices…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Invoices" sub="Full billing history and line-item breakdown" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <div
              onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
              style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
            >
              <span style={{ color: T.g200 }}>{IC.billing}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{inv.billingPeriod} statement</div>
                <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>
                  Issued {inv.issueDate} · Due {inv.dueDate}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.white }}>{fmtR(inv.totalAmount)}</div>
              <Badge v={inv.status} />
              <span style={{ color: T.g200 }}>{expanded === inv.id ? IC.chevD : IC.chevR}</span>
            </div>
            {expanded === inv.id && (
              <div style={{ borderTop: `1px solid ${T.g700}` }}>
                {inv.lines.map((line, i) => (
                  <div key={i} style={{ display: "flex", padding: "10px 18px", borderBottom: i < inv.lines.length - 1 ? `1px solid ${T.g700}` : undefined, fontSize: 12 }}>
                    <div style={{ flex: 1, color: T.white2 }}>{line.description}</div>
                    <div style={{ width: 100, textAlign: "right", color: T.g200 }}>{line.quantity} units</div>
                    <div style={{ width: 100, textAlign: "right", color: T.g200 }}>{fmtR(line.unitPrice)}</div>
                    <div style={{ width: 100, textAlign: "right", color: T.white, fontWeight: 700 }}>{fmtR(line.amount)}</div>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", padding: "10px 18px", background: T.surf3 }}>
                  <div style={{ flex: 1, fontSize: 12, color: T.g100 }}>Paid to date</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginRight: 16 }}>{fmtR(inv.amountPaid)}</div>
                  <Btn
                    ch={downloading === inv.id ? <><Spin s={12} /> Generating…</> : "Download PDF"}
                    sm
                    v="ghost"
                    onClick={() => download(inv)}
                    disabled={downloading === inv.id || !account}
                  />
                </div>
              </div>
            )}
          </Card>
        ))}
        {invoices.length === 0 && (
          <Card>
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: T.g200 }}>No invoices found for this account.</div>
          </Card>
        )}
      </div>
    </div>
  );
}
