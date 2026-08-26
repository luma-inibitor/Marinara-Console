// Every layered surface dismisses every way it offers, and leaves the reader on
// the screen they were reading.
//
// Gotcha: the import confirm is absent. It appears only above
// CONFIRM_THRESHOLD sources and the corpus has fewer, so reaching it means
// setting that constant to 0 in Sources.tsx by hand.

import type { Page } from "@playwright/test";
import { expect, test } from "./harness";
import { openScreen, screen, type Screen } from "./screens";

/** Back is the Android gesture and the browser button alike: one event.
 *  Everything built on <Sheet>/<Modal> offers all three. */
const ROUTES = ["scrim", "escape", "back"] as const;
type Route = (typeof ROUTES)[number];

interface Surface {
  name: string;
  /** The project to run in. narrow, phone and tablet share one layout branch
   *  below the 900px split, so one of them stands for all three. */
  project: string;
  screen: Screen;
  open: (page: Page) => Promise<void>;
  sel: string;
  dismiss: readonly Route[];
}

const SURFACES: Surface[] = [
  {
    name: "facet sheet", project: "phone", screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "Filter", exact: true }).click(),
    sel: ".sheet.filter-sheet", dismiss: ROUTES,
  },
  // Group and sort open the SAME sheet. Both openers are checked: they are two
  // controls onto one surface, and either could lose its wiring.
  {
    name: "view sheet from group", project: "phone", screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "Group by", exact: true }).click(),
    sel: ".sheet.view-sheet", dismiss: ROUTES,
  },
  {
    name: "view sheet from sort", project: "phone", screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "Sort by", exact: true }).click(),
    sel: ".sheet.view-sheet", dismiss: ROUTES,
  },
  {
    name: "dock sheet", project: "phone", screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "What Apply will send" }).click(),
    sel: ".sheet.dock-sheet", dismiss: ROUTES,
  },
  {
    name: "note peek", project: "desktop", screen: screen("memory-vault"),
    open: async (page) => {
      await page.locator(".row-summary").first().click();
      // No pause between the two clicks: .notelink exists only inside a record,
      // never in the list, so waiting for it to be clickable IS waiting for the
      // record to have arrived.
      await page.locator(".notelink").first().click();
    },
    sel: ".sheet.peek-sheet", dismiss: ROUTES,
  },
  // A full-screen surface with no scrim to tap, so it declares two routes
  // rather than pretending to pass a third that never ran.
  {
    name: "tag panel", project: "phone", screen: screen("lorebook-audit"),
    open: (page) => page.getByRole("button", { name: "Tags", exact: true }).click(),
    sel: ".tagpanel", dismiss: ["escape", "back"],
  },
];

async function dismiss(page: Page, route: Route): Promise<void> {
  if (route === "scrim") await page.locator(".peek-scrim").click({ position: { x: 5, y: 5 } });
  else if (route === "escape") await page.keyboard.press("Escape");
  else await page.goBack();
}

for (const surface of SURFACES) {
  for (const route of surface.dismiss) {
    test(`${surface.name} dismisses on ${route}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== surface.project, `drawn by the ${surface.project} layout`);
      await openScreen(page, surface.screen);
      await surface.open(page);
      await expect(page.locator(surface.sel)).toBeVisible();

      // Where opening the surface left the reader, not the route the case
      // started at: reaching a record is itself a navigation, and the peek
      // opens over that record rather than over the list.
      const base = new URL(page.url()).hash;
      await dismiss(page, route);

      await expect(page.locator(surface.sel), "still open").toHaveCount(0);
      expect(new URL(page.url()).hash, "dismissal left the screen").toBe(base);
    });
  }
}
