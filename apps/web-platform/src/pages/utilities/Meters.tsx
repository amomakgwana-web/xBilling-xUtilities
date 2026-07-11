import { useEffect, useState } from "react";
import type { Meter } from "@xplatform/shared-types";
import { T, IC, Card, CH, TRow, SectionTitle, Badge, Btn, LoadingState, ErrorState, fmtN } from "@xplatform/ui-kit";
import { api } from "../../api";

const TYPE_LABEL: Record<Meter["type"], string> = {
  prepaid_electricity: "Prepaid Electricity",
  conventional_electricity: "Conventional Electricity",
  water: "Water",
};

export function Meters() {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendingFor, setVendingFor] = useState<string | null>(null);
  const [vendAmount, setVendAmount] = useState("100");
  const [tokenResult, setTokenResult] = useState<{ serial: string; token: string; units: number } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<Meter[]>("/metering/meters")
      .then(setMeters)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load meters"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const vendToken = async (serial: string) => {
    const result = await api.post<{ token: string; units: number; ref: string }>("/metering/meters/vend-token", {
      serial,
      amount: Number(vendAmount),
    });
    setTokenResult({ serial, token: result.token, units: result.units });
    setVendingFor(null);
  };

  if (loading) return <LoadingState label="Loading meters…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <SectionTitle title="Meters" sub="Conlog-managed prepaid STS, conventional electricity & water meters" />

      {tokenResult && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: T.greenBg, border: `1px solid ${T.green}40`, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.greenT, marginBottom: 4 }}>
            Token vended for {tokenResult.serial}
          </div>
          <div style={{ fontSize: 13, fontFamily: "monospace", color: T.white, letterSpacing: "2px" }}>{tokenResult.token}</div>
          <div style={{ fontSize: 11, color: T.g100, marginTop: 4 }}>{tokenResult.units} kWh</div>
        </div>
      )}

      <Card>
        <CH title="All Meters" icon={IC.meter} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TRow cols={["Serial", "Account", "Municipality", "Type", "Last Reading", "Status", "Action"]} />
            <tbody>
              {meters.map((m) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${T.g700}` }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.brand }}>{m.serial}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200, fontFamily: "monospace" }}>{m.accountNumber}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.white2 }}>{m.municipality}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: T.g200 }}>{TYPE_LABEL[m.type]}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: T.white }}>{fmtN(m.lastReading)}</td>
                  <td style={{ padding: "10px 14px" }}><Badge v={m.status} /></td>
                  <td style={{ padding: "10px 14px" }}>
                    {m.type === "prepaid_electricity" &&
                      (vendingFor === m.serial ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            value={vendAmount}
                            onChange={(e) => setVendAmount(e.target.value)}
                            style={{ width: 60, background: T.surf3, border: `1px solid ${T.g600}`, borderRadius: 5, padding: "4px 6px", color: T.white, fontSize: 11 }}
                          />
                          <Btn ch="Vend" sm onClick={() => vendToken(m.serial)} />
                        </div>
                      ) : (
                        <Btn ch="Vend Token" sm v="ghost" onClick={() => setVendingFor(m.serial)} />
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
