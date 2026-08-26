import { defineConfig } from "@playwright/test";

// Drives the built bundle over `vite preview`, not the dev server, so what is
// measured is what ships. Requests under /api and /console are answered from
// tests/e2e/fixtures/ by tests/e2e/api.ts; no engine is needed.
//
// Gotcha: `tsc --noEmit` does not cover this file. It includes src/ and tests/
// only, and this reads `process.env` with no @types/node installed.
const PORT = 4178;

// design/DESIGN.md §7. 390 is the iPhone-class floor; 486 is Luma's device
// (1080 physical at DPR 2.22); 768 sits between the two CSS breakpoints; 1280
// is desktop.
const VIEWPORTS = [
  { name: "narrow", width: 390, height: 844, touch: true },
  { name: "phone", width: 486, height: 1085, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "desktop", width: 1280, height: 800, touch: false },
];

// Runs once, without a browser: four copies would name one fault four times.
const CORPUS = /corpus\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Fixed corpus, no engine: a pass on the second attempt is a real signal.
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "corpus", testMatch: CORPUS },
    ...VIEWPORTS.map(({ name, width, height, touch }) => ({
      name,
      testIgnore: CORPUS,
      use: {
        browserName: "chromium" as const,
        viewport: { width, height },
        // Touch emulation is a property of the device, not of the width: it
        // decides which pointer media queries match and whether the app's own
        // desktop test agrees with the viewport it is running at.
        isMobile: touch,
        hasTouch: touch,
      },
    })),
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // A cold `vite build` is most of this; the preview server itself is instant.
    timeout: 180_000,
  },
});
