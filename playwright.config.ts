import { defineConfig } from "@playwright/test";

// Playwright drives the BUILT bundle, not the dev server.
//
// That is the whole point of the harness. `scripts/verify.mjs` drives whatever
// is on MC_DEV_URL, which in practice is Vite, and Vite is not what ships: the
// dev server serves unminified modules, injects its own client, rewrites module
// URLs with `?t=` cache-busters, and reports errors in an overlay the page does
// not otherwise have. A check that passes there and fails on `dist/` has told
// nobody anything. `npm run build` runs first and `vite preview` serves the
// result, so what is measured is what a person would be looking at.
//
// No engine and no server.mjs: every request under /api and /console is
// answered from tests/e2e/fixtures/ by tests/e2e/api.ts.
//
// This file is not covered by `tsc --noEmit`, which includes only src/ and
// tests/ — the same place scripts/*.mjs sits. It reads `process.env`, and the
// project has no @types/node; adding it would mean putting node globals on the
// `types` list that src/ compiles against, which is a worse trade than leaving
// one config file checked by the runner that loads it.

const PORT = 4178;

// design/DESIGN.md §7. 390 is the narrow floor (iPhone-class). 486 is Luma's
// actual device (1080 physical at DPR 2.22) and is the one that has to look
// right — a layout tuned only at 390 has never been seen at the width it ships
// to. 768 is the band between the two CSS breakpoints, 1280 is desktop.
//
// Duplicated from scripts/lib/browser.mjs on purpose: that module is the old
// harness and is deleted when verify.mjs is retired. Importing it here would
// tie this config's lifetime to that deletion, and would pull a browser launch
// helper into a file the runner loads before it has decided to launch one.
const VIEWPORTS = [
  { name: "narrow", width: 390, height: 844, touch: true },
  { name: "phone", width: 486, height: 1085, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "desktop", width: 1280, height: 800, touch: false },
];

// The corpus check needs no browser and no viewport, and four identical
// failures would name one fault four times.
const CORPUS = /corpus\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries anywhere. This is a required job over a fixed corpus with no
  // engine behind it: a test that passes on the second attempt is telling us
  // something, and a retry would spend it.
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
