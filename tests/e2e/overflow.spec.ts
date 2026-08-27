// design/DESIGN.md §7: no screen scrolls sideways at any of the four viewports.

import { SCREENS, openScreen } from "./screens";
import { expect, test } from "./harness";

// Subpixel layout rounds scrollWidth up against an exact clientWidth, so one
// pixel of excess is measurement noise rather than a sideways scroll.
const SLACK = 1;

// `.chiprail` is the one box meant to scroll sideways, and says so with a fade.
const SIDEWAYS_OK = [".chiprail"];

// Gotcha: `overflow-y: auto` computes `overflow-x` to auto too, so an over-wide
// row scrolls its nearest scroller and leaves the document at the viewport
// width. Hence collecting scrollers by computed overflow rather than by name.

for (const screen of SCREENS) {
  test(screen.name, async ({ page }) => {
    await openScreen(page, screen);
    const report = await page.evaluate(
      ([allowed, slack]: [string[], number]) => {
        const scrollers = [...document.querySelectorAll("*")].filter((el) => {
          const x = getComputedStyle(el).overflowX;
          return (x === "auto" || x === "scroll") && !allowed.some((sel) => el.matches(sel));
        });
        return [document.documentElement, ...scrollers].map((box) => {
          const edge = box.getBoundingClientRect().right + slack;
          const name = (el: Element) => `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`;
          const wide = [...box.querySelectorAll("*")]
            .filter((el) => el.getBoundingClientRect().right > edge)
            .slice(0, 5)
            .map(name);
          const sel = box === document.documentElement ? ":root" : name(box);
          return { sel, scrollW: box.scrollWidth, clientW: box.clientWidth, wide };
        });
      },
      [SIDEWAYS_OK, SLACK] as [string[], number],
    );

    // `.stage` is on all eight screens, so nothing but the document to measure
    // means the collector stopped matching rather than the app stopped scrolling.
    expect(report.length, `${screen.name} found no scroll container to measure`).toBeGreaterThan(1);
    for (const box of report) {
      expect(box.scrollW, `${screen.name} scrolls ${box.sel} sideways: ${box.wide.join(", ")}`).toBeLessThanOrEqual(
        box.clientW + SLACK,
      );
    }
  });
}
