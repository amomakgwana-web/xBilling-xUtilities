import { Route, Routes } from "react-router-dom";
import { Shell } from "./Shell";
import { Dashboard } from "./pages/Dashboard";
import { Meters } from "./pages/Meters";
import { Faults } from "./pages/Faults";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/meters" element={<Meters />} />
        <Route path="/faults" element={<Faults />} />
      </Routes>
    </Shell>
  );
}
