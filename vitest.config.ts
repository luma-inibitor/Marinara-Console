import { defineConfig } from "vitest/config";

// The memory tool's model layer is pure — no DOM, no stores, no fetch — so the
// node environment is the whole story. Rendering is covered by scripts/domsnap
// against real Chromium.
export default defineConfig({
  test: {
    environment: "node",
    // test/ is the HTTP conformance suite for server.mjs.
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs", "test/**/*.test.mjs"],
    setupFiles: ["src/tools/memory/test/setup.ts"],
    // cn.test.ts reads theme.css as text, which the default CSS stub would blank.
    css: { include: [/theme\.css/] },
  },
});
