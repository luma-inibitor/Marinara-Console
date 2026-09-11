// Every layered surface dismisses every way it offers, and leaves the reader on
// the screen they were reading.
//
// Gotcha: the import confirm is absent. It appears only above
// CONFIRM_THRESHOLD sources and the corpus has fewer.

import type { Page } from "@playwright/test";
import { expect, test } from "./harness";
import { openScreen, screen, type Screen } from "./screens";

/** Back is the Android gesture and the browser button alike: one event. */
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
  /** Scrim to tap when it is not `.peek-scrim`. */
  scrim?: string;
  dismiss: readonly Route[];
}

const SURFACES: Surface[] = [
  {
    name: "facet sheet",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "Filter", exact: true }).click(),
    sel: ".sheet.filter-sheet",
    dismiss: ROUTES,
  },
  // Group and sort open the same sheet; either opener could lose its wiring.
  {
    name: "view sheet from group",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "Group by", exact: true }).click(),
    sel: ".sheet.view-sheet",
    dismiss: ROUTES,
  },
  {
    name: "view sheet from sort",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "Sort by", exact: true }).click(),
    sel: ".sheet.view-sheet",
    dismiss: ROUTES,
  },
  {
    name: "dock sheet",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "What Apply will send" }).click(),
    sel: ".sheet.dock-sheet",
    dismiss: ROUTES,
  },
  {
    name: "note peek",
    project: "desktop",
    screen: screen("memory-vault"),
    open: async (page) => {
      await page.locator(".row-summary").first().click();
      // No pause between the two clicks: .notelink exists only inside a record,
      // never in the list, so waiting for it to be clickable IS waiting for the
      // record to have arrived.
      await page.locator(".notelink").first().click();
    },
    sel: ".sheet.peek-sheet",
    dismiss: ROUTES,
  },
  {
    name: "group menu",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.locator("button.gmenu").first().click(),
    sel: ".gmenu-pop",
    scrim: ".gmenu-scrim",
    dismiss: ROUTES,
  },
  {
    // Full-screen, with no scrim to tap.
    name: "tag panel",
    project: "phone",
    screen: screen("lorebook-audit"),
    open: (page) => page.getByRole("button", { name: "Tags", exact: true }).click(),
    sel: ".tagpanel",
    dismiss: ["escape", "back"],
  },
];

async function dismiss(page: Page, route: Route, scrim = ".peek-scrim"): Promise<void> {
  if (route === "scrim") await page.locator(scrim).click({ position: { x: 5, y: 5 } });
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

      // Read after opening, not before: reaching a record is itself a
      // navigation, and the peek opens over the record rather than the list.
      const base = new URL(page.url()).hash;
      await dismiss(page, route, surface.scrim);

      await expect(page.locator(surface.sel), "still open").toHaveCount(0);
      expect(new URL(page.url()).hash, "dismissal left the screen").toBe(base);
    });
  }
}

test("group menu returns focus to its button on Escape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "drawn by the phone layout");
  await openScreen(page, screen("memory-review"));
  const kebab = page.locator("button.gmenu").first();
  await kebab.click();
  await expect(page.locator(".gmenu-pop")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.locator(".gmenu-pop")).toHaveCount(0);
  await expect(kebab).toBeFocused();
});

// Closing the menu and opening the peek is the one sequence with two overlays
// in flight; a misordered pair leaves an orphan history entry for the final
// back to spend.
test("opening a note from the group menu leaves one history entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "drawn by the phone layout");
  await openScreen(page, screen("memory-review"));
  const base = new URL(page.url()).hash;
  await page.locator("button.gmenu").first().click();
  await page.getByRole("menuitem", { name: /^Open / }).click();

  await expect(page.locator(".sheet.peek-sheet")).toBeVisible();
  await expect(page.locator(".gmenu-pop")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.locator(".sheet.peek-sheet")).toHaveCount(0);
  expect(new URL(page.url()).hash, "dismissal left the screen").toBe(base);

  await page.goBack();
  expect(new URL(page.url()).hash, "an orphan entry swallowed the back").not.toBe(base);
});
