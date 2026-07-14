import { useEffect, useState } from "react";
import type { Meter } from "@xplatform/shared-types";
import { T, IC, Card, CH, SectionTitle, Badge, Btn, Spin, LoadingState, ErrorState, fmtN, fmtR } from "@xplatform/ui-kit";
import { supabase } from "../../lib/supabaseClient";
import { unwrap, callRpc } from "../../lib/db";
import { useAccount } from "../../AccountContext";

const AMOUNTS = [50, 100, 200, 500];

interface VendRecord {
  serial: string;
  token: string;
  units: number;
  amount: number;
  at: string;
}

export function BuyElectricity() {
  const { accountNumber } = useAccount();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const [vending, setVending] = useState(false);
  const [vendError, setVendError] = useState<string | null>(null);
  const [history, setHistory] = useState<VendRecord[]>([]);

  const load = () => {
    setLoading(true);
    setError(null);
    unwrap<Meter[]>(supabase.from("meters").select("*").eq("accountNumber", accountNumber).eq("type", "prepaid_electricity"))
      .then(setMeters)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your meters"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [accountNumber]);

  const effectiveAmount = custom !== "" ? Number(custom) : amount;

  const vend = async (serial: string) => {
    setVending(true);
    setVendError(null);
    try {
      const result = await callRpc<{ token: string; units: number; ref: string }>("vend_token", {
        p_serial: serial,
        p_amount: effectiveAmount,
      });
      setHistory((prev) => [
        { serial, token: result.token, units: result.units, amount: effectiveAmount, at: new Date().toLocaleTimeString() },
        ...prev,
      ]);
    } catch (err) {
      setVendError(err instanceof Error ? err.message : "Token purchase failed");
    } finally {
      setVending(false);
    }
  };

  if (loading) return <LoadingState label="Loading your meters…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const latest = history[0];

  return (
    <div>
      <SectionTitle title="Buy Electricity" sub={`Prepaid STS tokens · account ${accountNumber}`} />

      {meters.length === 0 ? (
        <Card>
          <div style={{ padding: 24, fontSize: 12, color: T.g200 }}>
            No prepaid electricity meter is linked to this account. Conventional meters are billed on your monthly
            statement instead — see Invoices.
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
          <div>
            {meters.map((m) => (
              <Card key={m.id} s={{ marginBottom: 16 }}>
                <CH title={m.serial} sub={`${m.municipality} · last reading ${fmtN(m.lastReading)} kWh`} icon={IC.bolt} right={<Badge v={m.status} />} />
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.g100, marginBottom: 8 }}>Amount</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
                    {AMOUNTS.map((a) => {
                      const active = custom === "" && amount === a;
                      return (
                        <button
                          key={a}
                          onClick={() => {
                            setAmount(a);
                            setCustom("");
                          }}
                          style={{
                            padding: "10px 0",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            color: active ? "#fff" : T.white2,
                            background: active ? T.brand : T.surf3,
                            border: `1px solid ${active ? T.brand : T.g600}`,
                          }}
                        >
                          R{a}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Custom amount (ZAR)"
                    style={{ width: "100%", background: T.surf3, border: `1px solid ${T.g600}`, borderRadius: 8, padding: "9px 12px", color: T.white, fontSize: 12, fontFamily: "inherit", marginBottom: 12 }}
                  />
                  <Btn
                    ch={vending ? <><Spin s={12} c="rgba(255,255,255,.6)" /> Purchasing…</> : <>{IC.bolt} Buy {effectiveAmount > 0 ? fmtR(effectiveAmount) : ""} token</>}
                    onClick={() => vend(m.serial)}
                    disabled={vending || !(effectiveAmount > 0)}
                    full
                  />
                  {vendError && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: T.redBg, border: `1px solid ${T.red}40`, borderRadius: 7, fontSize: 12, color: T.redT }}>
                      {vendError}
                    </div>
                  )}
                </div>
              </Card>
            ))}

            {latest && (
              <div style={{ padding: "14px 16px", background: T.greenBg, border: `1px solid ${T.green}40`, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.greenT, marginBottom: 6 }}>
                  Token issued for {latest.serial} — enter it on your meter keypad
                </div>
                <div style={{ fontSize: 16, fontFamily: "monospace", color: T.white, letterSpacing: "3px" }}>{latest.token}</div>
                <div style={{ fontSize: 11, color: T.g100, marginTop: 6 }}>
                  {latest.units} kWh for {fmtR(latest.amount)}
                </div>
              </div>
            )}
          </div>

          <Card>
            <CH title="This Session" sub="Tokens purchased" icon={IC.billing} />
            <div>
              {history.map((h, i) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: `1px solid ${T.g700}` }}>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: T.white }}>{h.token}</div>
                  <div style={{ fontSize: 10, color: T.g200, marginTop: 2 }}>
                    {h.serial} · {h.units} kWh · {fmtR(h.amount)} · {h.at}
                  </div>
                </div>
              ))}
              {history.length === 0 && <div style={{ padding: 16, fontSize: 12, color: T.g200 }}>No tokens purchased yet.</div>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
