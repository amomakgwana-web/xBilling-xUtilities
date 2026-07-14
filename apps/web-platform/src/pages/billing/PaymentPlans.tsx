import { useEffect, useState } from "react";
import type { Account, PaymentPlan } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Sel, Spin, LoadingState, ErrorState, fmtR } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap, callRpc } from "../../lib/db";
import { useAccount } from "../../AccountContext";

const TERMS = [3, 6, 12];

export function PaymentPlans() {
  const { accountNumber } = useAccount();
  const [account, setAccount] = useState<Account | null>(null);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState(String(TERMS[1]));
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      unwrap<Account>(supabase.from("accounts").select("*").eq("accountNumber", accountNumber).single()),
      unwrap<PaymentPlan[]>(supabase.from("payment_plans").select("*").eq("accountNumber", accountNumber).order("createdAt", { ascending: false })),
    ])
      .then(([acc, p]) => {
        setAccount(acc);
        setPlans(p);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load payment plans"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accountNumber]);

  const create = async () => {
    if (!account) return;
    setCreating(true);
    setError(null);
    try {
      const plan = await callRpc<PaymentPlan>("create_payment_plan", {
        p_account_number: accountNumber,
        p_consumer_name: account.consumerName,
        p_total_amount: account.balance,
        p_installments: Number(term),
      });
      setPlans((prev) => [plan, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment plan");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingState label="Loading payment plans…" />;
  if (error && !account) return <ErrorState message={error} onRetry={load} />;

  const activePlan = plans.find((p) => p.status === "active");

  return (
    <div>
      <SectionTitle title="Payment Plans" sub="Spread your outstanding balance into equal monthly instalments" />

      {!activePlan && account && account.balance > 0 && (
        <Card s={{ marginBottom: 20 }}>
          <CH title="Set Up a Plan" sub={`Outstanding balance ${fmtR(account.balance)}`} icon={IC.billing} />
          <div style={{ padding: "16px 18px" }}>
            <Sel label="Instalments" value={term} onChange={setTerm} options={TERMS.map((t) => ({ v: String(t), l: `${t} months — ${fmtR(account.balance / t)}/mo` }))} />
            <Btn ch={creating ? <><Spin s={12} /> Creating…</> : "Start Payment Plan"} onClick={create} disabled={creating} full />
            {error && (
              <div style={{ marginTop: 12, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
                {error}
              </div>
            )}
          </div>
        </Card>
      )}

      {!activePlan && account && account.balance === 0 && (
        <Card s={{ marginBottom: 20 }}>
          <div style={{ padding: 20, fontSize: 12, color: T.g200 }}>Your account is fully settled — no plan needed.</div>
        </Card>
      )}

      <Card>
        <CH title="History" icon={IC.dash} />
        <div>
          {plans.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{fmtR(p.totalAmount)} over {p.installments} months</div>
                <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>{fmtR(p.installmentAmount)}/mo · started {p.startDate}</div>
              </div>
              <Badge v={p.status} />
            </div>
          ))}
          {plans.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No payment plans yet.</div>}
        </div>
      </Card>
    </div>
  );
}
