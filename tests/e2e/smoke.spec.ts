// Every top-level screen loads, from the built bundle, at four viewports.
//
// This is deliberately the whole of it. The contrast, tap-target, overlay and
// keyboard checks are separate pull requests built on this harness; what has to
// be true first is that each screen assembles from the corpus and lists what
// the corpus put in it. A screen that renders its error state still mounts, so
// the row count is the assertion that means something: it fails when a fixture
// stops reaching the list, which is the failure a smoke test is for.

import { SCREENS, openScreen } from "./screens";
import { expect, test } from "./harness";

for (const screen of SCREENS) {
  test(screen.name, async ({ page }) => {
    await openScreen(page, screen);
    await expect(page.locator(screen.row), `${screen.name} lists the corpus`)
      .toHaveCount(screen.rows, { timeout: 10_000 });
  });
}
