import { Route, Routes } from "react-router-dom";
import { Shell } from "./Shell";
import { AccountProvider } from "./AccountContext";
import { Dashboard } from "./pages/Dashboard";
import { Invoices } from "./pages/Invoices";
import { Pay } from "./pages/Pay";

export function App() {
  return (
    <AccountProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/pay" element={<Pay />} />
        </Routes>
      </Shell>
    </AccountProvider>
  );
}
