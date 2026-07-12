import { useEffect, useState } from "react";
import type { SubsidyApplication } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Input, Spin, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { api } from "../../api";
import { useAccount } from "../../AccountContext";

export function IndigentSubsidy() {
  const { accountNumber } = useAccount();
  const [applications, setApplications] = useState<SubsidyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [householdIncome, setHouseholdIncome] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [applying, setApplying] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<SubsidyApplication[]>(`/billing/subsidy?accountNumber=${accountNumber}`)
      .then(setApplications)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subsidy applications"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accountNumber]);

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const application = await api.post<SubsidyApplication>("/billing/subsidy/apply", {
        accountNumber,
        householdIncome: Number(householdIncome),
        householdSize: Number(householdSize),
      });
      setApplications((prev) => [application, ...prev]);
      setHouseholdIncome("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <LoadingState label="Loading indigent subsidy…" />;

  const latest = applications[0];

  return (
    <div>
      <SectionTitle title="Indigent Subsidy" sub="Household-income-based support toward your municipal account" />

      <Card s={{ marginBottom: 20, maxWidth: 480 }}>
        <CH title="Apply" icon={IC.users} />
        <div style={{ padding: "16px 18px" }}>
          <Input label="Monthly household income (R)" value={householdIncome} onChange={setHouseholdIncome} type="number" placeholder="e.g. 4500" />
          <Input label="Household size" value={householdSize} onChange={setHouseholdSize} type="number" />
          <div style={{ fontSize: 11, color: T.g200, marginBottom: 12 }}>
            Subsidy is calculated automatically from household income: ≤R3,500 → 100%, ≤R5,500 → 50%, ≤R7,000 → 25%, above → not eligible.
          </div>
          <Btn
            ch={applying ? <><Spin s={12} /> Submitting…</> : "Submit Application"}
            onClick={apply}
            disabled={applying || !householdIncome || Number(householdIncome) < 0 || !householdSize || Number(householdSize) < 1}
            full
          />
          {error && (
            <div style={{ marginTop: 12, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
              {error}
            </div>
          )}
        </div>
      </Card>

      {latest && (
        <Card s={{ marginBottom: 20, maxWidth: 480, borderTop: `2px solid ${latest.status === "approved" ? T.green : T.red}` }}>
          <div style={{ padding: "15px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Most Recent Application</div>
              <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>
                {latest.status === "approved" ? `${latest.subsidyPercent}% subsidy on your monthly billing` : "Household income above the eligibility threshold"}
              </div>
            </div>
            <Badge v={latest.status} />
          </div>
        </Card>
      )}

      <Card s={{ maxWidth: 480 }}>
        <CH title="Application History" icon={IC.dash} />
        <div>
          {applications.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: T.white2 }}>R{a.householdIncome.toLocaleString()}/mo · {a.householdSize} in household</div>
                <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>{a.appliedAt.slice(0, 10)}{a.status === "approved" ? ` · ${a.subsidyPercent}% subsidy` : ""}</div>
              </div>
              <Badge v={a.status} />
            </div>
          ))}
          {applications.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No applications yet.</div>}
        </div>
      </Card>
    </div>
  );
}
