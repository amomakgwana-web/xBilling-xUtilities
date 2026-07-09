import { Route, Routes } from "react-router-dom";
import { Shell } from "./Shell";
import { CommandCentre } from "./pages/CommandCentre";
import { Payments } from "./pages/Payments";
import { Campaigns } from "./pages/Campaigns";
import { Integrations } from "./pages/Integrations";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<CommandCentre />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/integrations" element={<Integrations />} />
      </Routes>
    </Shell>
  );
}
