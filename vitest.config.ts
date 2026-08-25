import { defineConfig } from "vitest/config";

// The memory tool's model layer is pure — no DOM, no stores, no fetch — so the
// node environment is the whole story. Rendering is covered by scripts/domsnap
// against real Chromium, which is strictly better signal than jsdom would be;
// adding a second, weaker rendering environment here would buy nothing.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/tools/memory/test/setup.ts"],
  },
});
