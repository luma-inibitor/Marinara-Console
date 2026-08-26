// design/DESIGN.md §7: no screen scrolls sideways at any of the four viewports.

import { SCREENS, openScreen } from "./screens";
import { expect, test } from "./harness";

// Subpixel layout rounds scrollWidth up against an exact clientWidth, so one
// pixel of excess is measurement noise rather than a sideways scroll.
const SLACK = 1;

// Gotcha: `.stage` sets overflow-y: auto, which computes overflow-x to auto
// too, so an over-wide row scrolls the stage and leaves the document at exactly
// the viewport width. Measuring the document alone reports every screen clean.
const BOXES = [":root", ".stage"];

for (const screen of SCREENS) {
  test(screen.name, async ({ page }) => {
    await openScreen(page, screen);
    const report = await page.evaluate(
      ([boxes, slack]: [string[], number]) =>
        boxes.map((sel) => {
          const box = document.querySelector(sel);
          if (!box) return { sel, found: false, scrollW: 0, clientW: 0, wide: [] as string[] };
          const wide = [...box.querySelectorAll("*")]
            .filter((el) => el.getBoundingClientRect().right > box.getBoundingClientRect().right + slack)
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`);
          return { sel, found: true, scrollW: box.scrollWidth, clientW: box.clientWidth, wide };
        }),
      [BOXES, SLACK] as [string[], number],
    );

    for (const box of report) {
      expect(box.found, `${screen.name} has no ${box.sel} to measure`).toBe(true);
      expect(box.scrollW, `${screen.name} scrolls ${box.sel} sideways: ${box.wide.join(", ")}`)
        .toBeLessThanOrEqual(box.clientW + SLACK);
    }
  });
}
