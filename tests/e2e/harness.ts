// The test object every spec here imports: `@playwright/test` with the fixture
// corpus installed.
//
// Gotcha: the browser swallows an unanswered request, a console error and an
// uncaught exception after render. Each is raised after `use()` instead.

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
    const noise: string[] = [];
    const crashes: string[] = [];
    page.on("console", (message) => {
      const type = message.type();
      if (type !== "error" && type !== "warning") return;
      const text = message.text();
      if (text.startsWith("[wire]")) mismatches.push(text);
      else noise.push(`${type}: ${text}`);
    });
    page.on("pageerror", (error) => crashes.push(error.message));

    await use(page);

    expect(api.unhandled, "requests the fixture corpus could not answer").toEqual([]);
    expect(mismatches, "responses that failed the app's own valibot schemas").toEqual([]);
    expect(noise, "console errors and warnings the page emitted").toEqual([]);
    expect(crashes, "uncaught exceptions on the page").toEqual([]);
  },
});

export { expect };
