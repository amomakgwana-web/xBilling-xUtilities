import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { GLOBAL_CSS } from "@xplatform/ui-kit";
import { App } from "./App";

const styleTag = document.createElement("style");
styleTag.textContent = GLOBAL_CSS;
document.head.appendChild(styleTag);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Hash-based routing — the whole point of the single-file build is that
        index.html works from any path (a GitHub Pages project subpath, a
        custom domain, even file://) with zero server-side rewrite rules.
        BrowserRouter needs a 404.html fallback trick to survive a hard
        refresh on a deep link; HashRouter never sends the route to the
        server at all, so there's nothing to configure. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
