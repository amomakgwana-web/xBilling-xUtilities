import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Relative asset base — the single output file has to work whether it's
  // served from a GitHub Pages project subpath, a custom domain, or opened
  // straight off disk. Nothing here depends on knowing the deploy path
  // ahead of time.
  base: "./",
  plugins: [react(), viteSingleFile()],
  server: { port: 5173 },
  preview: { port: 5173 },
  build: {
    // vite-plugin-singlefile inlines every JS/CSS asset as a data URI or
    // inline <script>/<style> tag — this just raises the size ceiling so
    // nothing gets left behind as a separate file GitHub Pages would need
    // a second request for.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5000,
  },
});
