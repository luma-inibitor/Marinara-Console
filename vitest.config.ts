import { defineConfig } from "vitest/config";

// The memory tool's model layer is pure — no DOM, no stores, no fetch — so the
// node environment is the whole story. Rendering is covered by scripts/domsnap
// against real Chromium, which is strictly better signal than jsdom would be;
// adding a second, weaker rendering environment here would buy nothing.
export default defineConfig({
  test: {
    environment: "node",
    // test/ holds the HTTP conformance suite for server.mjs. It is separate
    // from src/ and scripts/ because it tests neither: it stands the real
    // server on a port and talks to it, so it must outlive any rewrite of the
    // file it covers.
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs", "test/**/*.test.mjs"],
    setupFiles: ["src/tools/memory/test/setup.ts"],
  },
});
