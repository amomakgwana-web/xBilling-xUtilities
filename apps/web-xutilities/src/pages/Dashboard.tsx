import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Meter, MeterFault } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, SectionTitle, Badge, LiveDot, Spin, fmtN } from "@xplatform/ui-kit";
import { api } from "../api";

export function Dashboard() {
  const navigate = useNavigate();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [faults, setFaults] = useState<MeterFault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Meter[]>("/metering/meters"), api.get<MeterFault[]>("/metering/faults")])
      .then(([m, f]) => {
        setMeters(m);
        setFaults(f);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.g100 }}>
        <Spin /> Loading metering data…
      </div>
    );
  }

  const normalCount = meters.filter((m) => m.status === "normal").length;
  const openFaults = faults.filter((f) => f.status !== "resolved");

  const kpis = [
    { label: "Total Meters", value: String(meters.length), sub: "Prepaid · conventional · water", accent: T.brand, icon: IC.meter, nav: "/meters" },
    { label: "Healthy Meters", value: String(normalCount), sub: `${meters.length - normalCount} need attention`, accent: T.green, icon: IC.shield, nav: "/meters" },
    { label: "Open Faults", value: String(openFaults.length), sub: `${faults.length} total reported`, accent: T.red, icon: IC.alert, nav: "/faults" },
  ];

  return (
    <div>
      <SectionTitle title="Metering Overview" sub="Conlog STS · fault dispatch · consumption feed" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} icon={k.icon} onClick={() => navigate(k.nav)} />
        ))}
      </div>

      <Card>
        <CH title="Open Faults" sub="Requiring dispatch or resolution" icon={IC.alert} accent={T.red} />
        <div>
          {openFaults.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${T.g700}` }}>
              <LiveDot color={f.severity === "high" ? T.red : T.amber} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.white, fontFamily: "monospace" }}>{f.serial}</div>
                <div style={{ fontSize: 11, color: T.g200, marginTop: 2 }}>{f.description}</div>
              </div>
              <Badge v={f.status === "reported" ? "alert" : f.status === "dispatched" ? "pending" : "completed"} label={f.status} />
            </div>
          ))}
          {openFaults.length === 0 && <div style={{ padding: 18, fontSize: 12, color: T.g200 }}>No open faults. All meters reporting normally.</div>}
        </div>
      </Card>
    </div>
  );
}
