import { useEffect, useState } from "react";
import type { Account, PaymentMethod, PaymentTransaction } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Input, Sel, Spin, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap, callRpc } from "../../lib/db";
import { useAccount } from "../../AccountContext";

export function Pay() {
  const { accountNumber } = useAccount();
  const [account, setAccount] = useState<Account | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("card");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PaymentTransaction | { error: string } | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    setResult(null);
    Promise.all([
      unwrap<Account>(supabase.from("accounts").select("*").eq("accountNumber", accountNumber).single()),
      unwrap<PaymentMethod[]>(supabase.from("payment_methods").select("*")),
    ])
      .then(([acc, m]) => {
        setAccount(acc);
        setMethods(m);
        setAmount(acc.balance > 0 ? acc.balance.toFixed(2) : "");
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accountNumber]);

  const submit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const tx = await callRpc<PaymentTransaction>("initiate_payment", {
        p_account_number: accountNumber,
        p_amount: Number(amount),
        p_method: method,
      });
      setResult(tx);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Payment failed" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (loadError || !account) return <ErrorState message={loadError ?? "Account not found"} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Pay Now" sub={`Account ${account.accountNumber} · balance ${fmtR(account.balance)}`} />
      <div style={{ maxWidth: 480 }}>
        <Card>
          <CH title="Make a Payment" icon={IC.pay} />
          <div style={{ padding: "16px 18px" }}>
            <Input label="Amount (ZAR)" value={amount} onChange={setAmount} placeholder="0.00" type="number" />
            <Sel
              label="Payment Method"
              value={method}
              onChange={setMethod}
              options={methods.map((m) => ({ v: m.id, l: `${m.label}${m.status !== "active" ? ` (${m.status})` : ""}` }))}
            />
            <Btn ch={submitting ? <><Spin s={12} /> Processing…</> : <>{IC.pay} Pay {amount ? fmtR(Number(amount)) : ""}</>} onClick={submit} disabled={submitting || !amount} full />

            {result && "error" in result && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
                {result.error}
              </div>
            )}
            {result && "ref" in result && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: T.greenBg, border: `1px solid ${T.green}40`, borderRadius: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.greenT }}>Payment {result.status}</span>
                  <Badge v={result.status} />
                </div>
                <div style={{ fontSize: 11, color: T.g100, fontFamily: "monospace" }}>Ref: {result.ref}</div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
