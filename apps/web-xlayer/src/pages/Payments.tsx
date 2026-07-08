import { useEffect, useState } from "react";
import type { DebiCheckMandate, PaymentMethod, PaymentTransaction } from "@xplatform/shared-types";
import { T, IC, Card, CH, Tab, TRow, SectionTitle, Badge, Btn, Spin, fmtN, fmtR } from "@xplatform/ui-kit";
import { api } from "../api";

export function Payments() {
  const [tab, setTab] = useState("methods");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [recon, setRecon] = useState<PaymentTransaction[]>([]);
  const [mandates, setMandates] = useState<DebiCheckMandate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<PaymentMethod[]>("/payments/methods"),
      api.get<PaymentTransaction[]>("/payments/recon"),
      api.get<DebiCheckMandate[]>("/payments/debicheck/mandates"),
    ])
      .then(([m, r, d]) => {
        setMethods(m);
        setRecon(r);
        setMandates(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const resolve = async (ref: string) => {
    await api.post(`/payments/recon/${ref}/resolve`);
    setRecon((prev) => prev.map((r) => (r.ref === ref ? { ...r, status: "matched", erpStatus: "posted" } : r)));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.g100 }}>
        <Spin /> Loading payments…
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Payment Management" sub="SwiftPay · DebiCheck · Capitec Pay · WhatsApp Pay · ISO 20022 recon" />
      <Tab
        tabs={[
          { id: "methods", label: "Payment Methods", icon: IC.pay },
          { id: "recon", label: "Reconciliation", icon: IC.recon },
          { id: "debi", label: "DebiCheck", icon: IC.billing },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "methods" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {methods.map((p) => (
            <Card key={p.id} s={{ borderTop: `2px solid ${p.status === "active" ? T.green : p.status === "review" ? T.amber : T.g500}` }}>
              <div style={{ padding: "15px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 2 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: T.g200 }}>{p.provider}</div>
                  </div>
                  <Badge v={p.status} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div style={{ background: T.surf3, borderRadius: 6, padding: 8, border: `1px solid ${T.g700}` }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.white }}>{fmtN(p.txDay)}</div>
                    <div style={{ fontSize: 10, color: T.g100, marginTop: 1 }}>Txns Today</div>
                  </div>
                  <div style={{ background: T.surf3, borderRadius: 6, padding: 8, border: `1px solid ${T.g700}` }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.brand }}>{p.revDay > 0 ? fmtR(p.revDay) : "—"}</div>
                    <div style={{ fontSize: 10, color: T.g100, marginTop: 1 }}>Revenue Today</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "recon" && (
        <Card>
          <CH
            title="ISO 20022 Reconciliation"
            sub="Today · all gateways"
            icon={IC.recon}
            right={<div style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>{recon.filter((r) => r.status === "matched").length}/{recon.length} matched</div>}
          />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TRow cols={["Reference", "Account", "Consumer", "Amount", "Gateway", "Method", "ERP Status", "Status", "Action"]} />
              <tbody>
                {recon.map((r) => (
                  <tr key={r.ref} style={{ borderBottom: `1px solid ${T.g700}` }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{r.ref}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200, fontFamily: "monospace" }}>{r.accountNumber}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>{r.consumerName}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: T.white }}>{fmtR(r.amount)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{r.gateway}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200, textTransform: "uppercase" }}>{r.method}</td>
                    <td style={{ padding: "10px 14px" }}><Badge v={r.erpStatus} /></td>
                    <td style={{ padding: "10px 14px" }}><Badge v={r.status} /></td>
                    <td style={{ padding: "10px 14px" }}>{r.status === "suspense" && <Btn ch="Resolve" onClick={() => resolve(r.ref)} sm v="ghost" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "debi" && (
        <Card>
          <CH title="DebiCheck Mandate Management" sub="PASA · NAEDO · RMS" icon={IC.billing} accent={T.blue} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TRow cols={["Mandate", "Account", "Consumer", "Amount", "Collection Day", "Status"]} />
              <tbody>
                {mandates.map((m) => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{m.id}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200, fontFamily: "monospace" }}>{m.accountNumber}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>{m.consumerName}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: T.white }}>{fmtR(m.amount)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{m.collectionDay} of month</td>
                    <td style={{ padding: "10px 14px" }}><Badge v={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
