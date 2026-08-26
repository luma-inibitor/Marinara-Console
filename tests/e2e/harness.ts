// The test object every spec here imports: `@playwright/test` with the fixture
// corpus installed.
//
// It also turns three things the browser swallows into failures — an
// unanswered request, a `[wire]` console error (a fixture that no longer parses
// against the app's own valibot schemas), and an uncaught exception after
// render. All three are checked after `use()`, so they report on the whole test.

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
