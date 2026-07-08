import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GLOBAL_CSS } from "@xplatform/ui-kit";
import { App } from "./App";

const styleTag = document.createElement("style");
styleTag.textContent = GLOBAL_CSS;
document.head.appendChild(styleTag);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
