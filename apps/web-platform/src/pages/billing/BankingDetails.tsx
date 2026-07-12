import { useEffect, useState } from "react";
import type { BankingDetails as BankingDetailsType } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Btn, Input, Sel, Spin, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { api } from "../../api";
import { useAccount } from "../../AccountContext";

export function BankingDetails() {
  const { accountNumber } = useAccount();
  const [existing, setExisting] = useState<BankingDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountType, setAccountType] = useState("cheque");
  const [debitDay, setDebitDay] = useState("1");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<BankingDetailsType>(`/billing/banking/${accountNumber}`)
      .then((d) => {
        setExisting(d);
        setBankName(d.bankName);
        setAccountHolder(d.accountHolder);
        setBranchCode(d.branchCode);
        setAccountType(d.accountType);
        setDebitDay(String(d.debitDay));
      })
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accountNumber]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await api.put<BankingDetailsType>(`/billing/banking/${accountNumber}`, {
        bankName,
        accountHolder,
        accountNumber: accountNo || undefined,
        branchCode,
        accountType,
        debitDay: Number(debitDay),
      });
      setExisting(updated);
      setAccountNo("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save banking details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading banking details…" />;

  return (
    <div>
      <SectionTitle title="Banking Details" sub="For future debit order collection — visible only to you" />
      <div style={{ maxWidth: 480 }}>
        <Card>
          <CH title={existing ? "On File" : "Add Banking Details"} icon={IC.billing} />
          <div style={{ padding: "16px 18px" }}>
            {existing && (
              <div style={{ marginBottom: 16, padding: "10px 12px", background: T.surf3, border: `1px solid ${T.g700}`, borderRadius: 7, fontSize: 12, color: T.g100 }}>
                {existing.bankName} · {existing.maskedAccountNumber} · collects on the {existing.debitDay}
                {existing.debitDay === 1 ? "st" : existing.debitDay === 2 ? "nd" : existing.debitDay === 3 ? "rd" : "th"} of each month
              </div>
            )}
            <Input label="Bank name" value={bankName} onChange={setBankName} placeholder="e.g. Capitec" />
            <Input label="Account holder" value={accountHolder} onChange={setAccountHolder} placeholder="Full name" />
            <Input
              label={existing ? "New account number (leave blank to keep current)" : "Account number"}
              value={accountNo}
              onChange={setAccountNo}
              placeholder={existing ? existing.maskedAccountNumber : "e.g. 4070123456"}
              mono
            />
            <Input label="Branch code" value={branchCode} onChange={setBranchCode} placeholder="e.g. 470010" mono />
            <Sel label="Account type" value={accountType} onChange={setAccountType} options={["cheque", "savings"]} />
            <Input label="Debit day (1-31)" value={debitDay} onChange={setDebitDay} type="number" />
            <Btn ch={saving ? <><Spin s={12} /> Saving…</> : "Save Banking Details"} onClick={save} disabled={saving || !bankName || !accountHolder || (!existing && !accountNo) || !branchCode} full />

            {saved && (
              <div style={{ marginTop: 12, padding: "9px 12px", background: T.greenBg, border: `1px solid ${T.green}40`, borderRadius: 7, fontSize: 12, color: T.greenT }}>
                Saved.
              </div>
            )}
            {error && (
              <div style={{ marginTop: 12, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
                {error}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
