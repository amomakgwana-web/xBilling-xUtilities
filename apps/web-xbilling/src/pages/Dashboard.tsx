import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Account, Invoice } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, SectionTitle, Badge, Btn, Spin, fmtR } from "@xplatform/ui-kit";
import { api } from "../api";
import { useAccount } from "../AccountContext";

export function Dashboard() {
  const { accountNumber } = useAccount();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Account>(`/billing/accounts/${accountNumber}`),
      api.get<Invoice[]>(`/billing/invoices?accountNumber=${accountNumber}`),
    ])
      .then(([acc, inv]) => {
        setAccount(acc);
        setInvoices(inv);
      })
      .finally(() => setLoading(false));
  }, [accountNumber]);

  if (loading || !account) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.g100 }}>
        <Spin /> Loading your account…
      </div>
    );
  }

  const latestInvoice = invoices[0];

  return (
    <div>
      <SectionTitle title={`Welcome back, ${account.consumerName.split(" ")[0]}`} sub={`Account ${account.accountNumber} · ${account.municipality}`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Current Balance" value={fmtR(account.balance)} sub={account.status === "paid" ? "Fully settled" : "Amount due"} accent={account.balance > 0 ? T.brand : T.green} icon={IC.billing} />
        <KpiCard label="Account Status" value={<Badge v={account.status} />} sub={`Tariff ${account.tariffCode}`} accent={T.cyan} icon={IC.shield} />
        <KpiCard label="Next Due Date" value={latestInvoice?.dueDate ?? "—"} sub={latestInvoice ? `${latestInvoice.billingPeriod} statement` : "No open invoices"} accent={T.amber} icon={IC.chart} />
      </div>

      {account.balance > 0 && (
        <Card s={{ marginBottom: 20, borderTop: `2px solid ${T.brand}` }}>
          <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 4 }}>You have an outstanding balance</div>
              <div style={{ fontSize: 12, color: T.g100 }}>Pay via EFT, card, Google Pay, Apple Pay, Capitec Pay or USSD *120#</div>
            </div>
            <Btn ch={<>{IC.pay} Pay {fmtR(account.balance)}</>} onClick={() => navigate("/pay")} />
          </div>
        </Card>
      )}

      <Card>
        <CH title="Recent Invoices" icon={IC.billing} />
        <div>
          {invoices.map((inv) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{inv.billingPeriod} statement</div>
                <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>Due {inv.dueDate} · {fmtR(inv.totalAmount)} total</div>
              </div>
              <Badge v={inv.status} />
            </div>
          ))}
          {invoices.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No invoices yet.</div>}
        </div>
      </Card>
    </div>
  );
}
