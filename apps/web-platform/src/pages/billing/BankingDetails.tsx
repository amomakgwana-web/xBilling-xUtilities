import { useEffect, useState } from "react";
import type { BankingDetails as BankingDetailsType } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Btn, Input, Sel, Spin, LoadingState, ErrorState } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { callRpc } from "../../lib/db";
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.from("banking_details").select("*").eq("accountNumber", accountNumber).maybeSingle();
      if (err) throw new Error(err.message);
      if (!data) {
        setExisting(null);
        return;
      }
      const d = data as BankingDetailsType;
      setExisting(d);
      setBankName(d.bankName);
      setAccountHolder(d.accountHolder);
      setBranchCode(d.branchCode);
      setAccountType(d.accountType);
      setDebitDay(String(d.debitDay));
    } catch {
      setExisting(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [accountNumber]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await callRpc<BankingDetailsType>("upsert_banking_details", {
        p_account_number: accountNumber,
        p_bank_name: bankName,
        p_account_holder: accountHolder,
        p_branch_code: branchCode,
        p_account_type: accountType,
        p_debit_day: Number(debitDay),
        p_bank_account_number: accountNo || undefined,
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
