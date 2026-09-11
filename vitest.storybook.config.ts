import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

// The stories, run as tests in a real browser. Kept out of vitest.config.ts on
// purpose: `npm run check:test` is the node suite, and folding a browser
// project into it would put a Chromium download inside the fast job. The CI
// job for this one installs the browser the way the Playwright job does.
//
// Each story runs its play function, and the a11y addon runs axe over the
// result — `test: "error"` in .storybook/preview.tsx is what makes a violation
// fail here rather than only colour a panel in the manager.
export default defineConfig({
  plugins: [storybookTest({ configDir: ".storybook" })],
  test: {
    name: "storybook",
    setupFiles: [".storybook/vitest.setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
