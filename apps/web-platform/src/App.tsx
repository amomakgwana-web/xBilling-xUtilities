import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Login } from "./auth/Login";
import { AREA_ACCESS, PERSONA_META } from "./auth/session";
import { AccountProvider } from "./AccountContext";
import { Shell } from "./Shell";
import { CommandCentre } from "./pages/xlayer/CommandCentre";
import { Payments } from "./pages/xlayer/Payments";
import { Campaigns } from "./pages/xlayer/Campaigns";
import { Integrations } from "./pages/xlayer/Integrations";
import { Audit } from "./pages/xlayer/Audit";
import { Municipalities } from "./pages/xlayer/Municipalities";
import { Tariffs } from "./pages/xlayer/Tariffs";
import { Analytics } from "./pages/xlayer/Analytics";
import { BillingDashboard } from "./pages/billing/Dashboard";
import { Invoices } from "./pages/billing/Invoices";
import { Pay } from "./pages/billing/Pay";
import { BuyElectricity } from "./pages/billing/BuyElectricity";
import { BankingDetails } from "./pages/billing/BankingDetails";
import { PaymentPlans } from "./pages/billing/PaymentPlans";
import { IndigentSubsidy } from "./pages/billing/IndigentSubsidy";
import { Disputes as CitizenDisputes } from "./pages/billing/Disputes";
import { UtilitiesDashboard } from "./pages/utilities/Dashboard";
import { Meters } from "./pages/utilities/Meters";
import { Electricity } from "./pages/utilities/Electricity";
import { Faults } from "./pages/utilities/Faults";
import { Arrears } from "./pages/utilities/Arrears";
import { LegalHandover } from "./pages/utilities/LegalHandover";
import { Subsidy } from "./pages/utilities/Subsidy";
import { Disputes as OfficialDisputes } from "./pages/utilities/Disputes";
import { Reports } from "./pages/utilities/Reports";
import { Settings } from "./pages/utilities/Settings";

/** Route guard: requires a session AND that the persona may see this area. */
function Area({ area, children }: { area: keyof typeof AREA_ACCESS; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!AREA_ACCESS[area].includes(session.persona)) {
    return <Navigate to={PERSONA_META[session.persona].home} replace />;
  }
  return <>{children}</>;
}

function Routed() {
  const { session, loading } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={PERSONA_META[session.persona].home} replace /> : <Login />} />
      <Route
        path="/*"
        element={
          session ? (
            <AccountProvider>
              <Shell>
                <Routes>
                  <Route path="/" element={<Area area="xlayer"><CommandCentre /></Area>} />
                  <Route path="/payments" element={<Area area="xlayer"><Payments /></Area>} />
                  <Route path="/campaigns" element={<Area area="xlayer"><Campaigns /></Area>} />
                  <Route path="/integrations" element={<Area area="xlayer"><Integrations /></Area>} />
                  <Route path="/audit" element={<Area area="xlayer"><Audit /></Area>} />
                  <Route path="/municipalities" element={<Area area="xlayer"><Municipalities /></Area>} />
                  <Route path="/tariffs" element={<Area area="xlayer"><Tariffs /></Area>} />
                  <Route path="/analytics" element={<Area area="xlayer"><Analytics /></Area>} />
                  <Route path="/billing" element={<Area area="billing"><BillingDashboard /></Area>} />
                  <Route path="/billing/invoices" element={<Area area="billing"><Invoices /></Area>} />
                  <Route path="/billing/pay" element={<Area area="billing"><Pay /></Area>} />
                  <Route path="/billing/electricity" element={<Area area="billing"><BuyElectricity /></Area>} />
                  <Route path="/billing/banking" element={<Area area="billing"><BankingDetails /></Area>} />
                  <Route path="/billing/plans" element={<Area area="billing"><PaymentPlans /></Area>} />
                  <Route path="/billing/subsidy" element={<Area area="billing"><IndigentSubsidy /></Area>} />
                  <Route path="/billing/disputes" element={<Area area="billing"><CitizenDisputes /></Area>} />
                  <Route path="/utilities" element={<Area area="utilities"><UtilitiesDashboard /></Area>} />
                  <Route path="/utilities/meters" element={<Area area="utilities"><Meters /></Area>} />
                  <Route path="/utilities/electricity" element={<Area area="utilities"><Electricity /></Area>} />
                  <Route path="/utilities/faults" element={<Area area="utilities"><Faults /></Area>} />
                  <Route path="/utilities/arrears" element={<Area area="utilities"><Arrears /></Area>} />
                  <Route path="/utilities/legal-handover" element={<Area area="utilities"><LegalHandover /></Area>} />
                  <Route path="/utilities/subsidy" element={<Area area="utilities"><Subsidy /></Area>} />
                  <Route path="/utilities/disputes" element={<Area area="utilities"><OfficialDisputes /></Area>} />
                  <Route path="/utilities/reports" element={<Area area="utilities"><Reports /></Area>} />
                  <Route path="/utilities/settings" element={<Area area="utilities"><Settings /></Area>} />
                  <Route path="*" element={<Navigate to={PERSONA_META[session.persona].home} replace />} />
                </Routes>
              </Shell>
            </AccountProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routed />
    </AuthProvider>
  );
}
