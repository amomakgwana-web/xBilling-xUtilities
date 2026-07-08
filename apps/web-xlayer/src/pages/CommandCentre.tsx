import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Account, Campaign, ComplianceScore, PaymentMethod, PlatformStatus } from "@xplatform/shared-types";
import { T, IC, Card, CH, KpiCard, SectionTitle, Badge, LiveDot, Btn, Spin, fmtN, fmtR } from "@xplatform/ui-kit";
import { api } from "../api";

interface ChatbotStats {
  total: number;
  resolved: number;
  escalated: number;
}

export function CommandCentre() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [chatStats, setChatStats] = useState<ChatbotStats | null>(null);
  const [compliance, setCompliance] = useState<ComplianceScore | null>(null);
  const [platform, setPlatform] = useState<PlatformStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<{ text: string; mocked: boolean } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Account[]>("/billing/accounts"),
      api.get<PaymentMethod[]>("/payments/methods"),
      api.get<Campaign[]>("/comms/campaigns"),
      api.get<ChatbotStats>("/comms/chatbot/stats"),
      api.get<ComplianceScore>("/compliance/score"),
      api.get<PlatformStatus>("/platform/status"),
    ])
      .then(([acc, mth, camp, chat, comp, plat]) => {
        setAccounts(acc);
        setMethods(mth);
        setCampaigns(camp);
        setChatStats(chat);
        setCompliance(comp);
        setPlatform(plat);
      })
      .finally(() => setLoading(false));
  }, []);

  const runInsight = async () => {
    setInsightLoading(true);
    const outstanding = accounts.reduce((sum, a) => sum + a.balance, 0);
    const summary = `Outstanding book ${fmtR(outstanding)} across ${accounts.length} accounts, ${methods.filter((m) => m.status === "active").length} active payment rails, compliance score ${compliance?.score ?? "n/a"}/100, ${chatStats?.total ?? 0} chatbot sessions today (${chatStats?.resolved ?? 0} resolved).`;
    const result = await api.post<{ text: string; mocked: boolean }>("/comms/insight/platform", { summary });
    setInsight(result);
    setInsightLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.g100 }}>
        <Spin /> Loading platform data…
      </div>
    );
  }

  const outstanding = accounts.reduce((sum, a) => sum + a.balance, 0);
  const activeMethods = methods.filter((m) => m.status === "active");
  const totalRevToday = activeMethods.reduce((sum, m) => sum + m.revDay, 0);

  const kpis = [
    { label: "Outstanding Book", value: fmtR(outstanding), sub: `Across ${accounts.length} accounts`, accent: T.brand, icon: IC.billing, nav: "/campaigns" },
    { label: "Active Payment Rails", value: String(activeMethods.length), sub: `${methods.length} configured total`, accent: T.green, icon: IC.pay, nav: "/payments" },
    { label: "Revenue Today", value: fmtR(totalRevToday), sub: "All gateways combined", accent: T.cyan, icon: IC.chart, nav: "/payments" },
    { label: "Compliance Gate", value: `${compliance?.score ?? "—"}/100`, sub: "ISO 27001 · POPIA · PCI-DSS", accent: T.amber, icon: IC.shield, nav: "/integrations" },
    { label: "Chatbot Sessions", value: String(chatStats?.total ?? 0), sub: `${chatStats?.resolved ?? 0} resolved · ${chatStats?.escalated ?? 0} escalated`, accent: T.purple, icon: IC.chat, nav: "/campaigns" },
    { label: "Active Campaigns", value: String(campaigns.filter((c) => c.status === "running").length), sub: `${campaigns.length} total`, accent: T.cyan, icon: IC.campaign, nav: "/campaigns" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.white, letterSpacing: "-.03em", marginBottom: 6 }}>
            Command <span style={{ color: T.brand }}>Centre</span>
          </h1>
          <p style={{ fontSize: 12, color: T.g100, display: "flex", alignItems: "center", gap: 6 }}>
            Unified monitoring across billing, payments, metering &amp; comms
            <LiveDot color={T.green} /> All services live
          </p>
        </div>
        <Btn
          ch={insightLoading ? <><Spin s={12} c="rgba(255,255,255,.6)" /> Analysing…</> : <>{IC.eye} Platform Insight</>}
          onClick={runInsight}
          disabled={insightLoading}
          v="dark"
        />
      </div>

      {(insightLoading || insight) && (
        <div style={{ background: T.surf, border: `1px solid ${T.cyan}30`, borderLeft: `3px solid ${T.cyan}`, borderRadius: 10, padding: "13px 16px", marginBottom: 20, display: "flex", gap: 10 }}>
          {insightLoading ? (
            <>
              <Spin s={14} c={T.cyan} />
              <span style={{ fontSize: 12, color: T.cyan, fontStyle: "italic" }}>Analysing platform KPIs…</span>
            </>
          ) : (
            <>
              <span style={{ color: T.cyan, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>AI INSIGHT</span>
              <p style={{ fontSize: 12, color: T.white2, lineHeight: 1.65, margin: 0 }}>
                {insight!.text}
                {insight!.mocked && <span style={{ color: T.g200, fontStyle: "italic" }}> (canned response — set ANTHROPIC_API_KEY on comms-service for live analysis)</span>}
              </p>
            </>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} icon={k.icon} onClick={() => navigate(k.nav)} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        <Card>
          <CH title="Recent Campaigns" sub="xCentral · SMS & Email" icon={IC.campaign} />
          <div>
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: `1px solid ${T.g700}` }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.type === "SMS" ? T.green : T.cyan, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: T.g200, marginTop: 1 }}>
                    {fmtN(c.sent)} sent · {fmtN(c.paid)} paid · {c.municipality}
                  </div>
                </div>
                <Badge v={c.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CH title="Platform Status" sub="Downstream services" icon={IC.server} pad={false} />
          <div>
            {platform?.services.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${T.g700}` }}>
                <LiveDot color={s.status === "live" ? T.green : s.status === "degraded" ? T.amber : T.red} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.white, textTransform: "capitalize" }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: T.g200 }}>{s.url}</div>
                </div>
                <div style={{ fontSize: 11, color: T.g100, textAlign: "right" }}>{s.latencyMs !== undefined ? `${s.latencyMs}ms` : "—"}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
