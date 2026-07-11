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
import { BillingDashboard } from "./pages/billing/Dashboard";
import { Invoices } from "./pages/billing/Invoices";
import { Pay } from "./pages/billing/Pay";
import { UtilitiesDashboard } from "./pages/utilities/Dashboard";
import { Meters } from "./pages/utilities/Meters";
import { Faults } from "./pages/utilities/Faults";

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
  const { session } = useAuth();
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
                  <Route path="/billing" element={<Area area="billing"><BillingDashboard /></Area>} />
                  <Route path="/billing/invoices" element={<Area area="billing"><Invoices /></Area>} />
                  <Route path="/billing/pay" element={<Area area="billing"><Pay /></Area>} />
                  <Route path="/utilities" element={<Area area="utilities"><UtilitiesDashboard /></Area>} />
                  <Route path="/utilities/meters" element={<Area area="utilities"><Meters /></Area>} />
                  <Route path="/utilities/faults" element={<Area area="utilities"><Faults /></Area>} />
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
