// Produces a single self-contained file for hosts that can't run pnpm
// workspaces (e.g. shared cPanel hosting's Node.js Selector, which does its
// own `npm install` in an app root with no notion of a monorepo). Every
// dependency here is pure JS with no native addons, so everything —
// workspace packages and npm packages alike — gets inlined; the only
// requirement on the host is a Node.js runtime.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist-bundle/server.mjs",
  banner: {
    // esbuild's ESM output doesn't provide require()/__dirname by default;
    // drizzle-orm's dynamic driver loading expects require() to exist.
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});

console.log("Bundled to dist-bundle/server.mjs");
