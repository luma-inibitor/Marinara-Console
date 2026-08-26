// The test object every spec in this directory imports.
//
// It is `@playwright/test` with the corpus already installed and three failure
// channels the browser would otherwise swallow turned into test failures:
//
//   an unanswered request   — a gap in tests/e2e/api.ts, reported as the route
//                             that was missing rather than as a blank screen
//   a `[wire]` console error — a fixture that no longer parses against the
//                             valibot schemas the app itself uses. This is the
//                             drift guard running INSIDE the app: corpus.spec.ts
//                             parses the memory fixtures directly, and this
//                             catches the same class of fault on any response
//                             a screen actually consumed
//   an uncaught exception   — a screen that threw after it rendered, which no
//                             locator assertion can see
//
// The checks run after `use()`, so they report on the whole test rather than on
// the moment a locator was queried.

import { test as base, expect } from "@playwright/test";
import { installApi, type Route } from "./api";

interface Options {
  /** Routes prepended to the corpus, for a test that needs one endpoint to
   *  answer differently. `test.use({ routes: [...] })`. */
  routes: Route[];
}

export const test = base.extend<Options>({
  routes: [[], { option: true }],

  page: async ({ page, routes }, use) => {
    const api = await installApi(page, routes);
    const mismatches: string[] = [];
    const crashes: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().startsWith("[wire]")) mismatches.push(message.text());
    });
    page.on("pageerror", (error) => crashes.push(error.message));

    await use(page);

    expect(api.unhandled, "requests the fixture corpus could not answer").toEqual([]);
    expect(mismatches, "responses that failed the app's own valibot schemas").toEqual([]);
    expect(crashes, "uncaught exceptions on the page").toEqual([]);
  },
});

export { expect };
