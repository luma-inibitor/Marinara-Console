// Every layered surface dismisses cleanly and seals the page behind it.
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
  scrim?: string;
  /** Sits in the page it opens from, so the page behind it is not sealed. */
  anchored?: boolean;
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
    anchored: true,
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

async function background(page: Page, sel: string) {
  return page.evaluate((selector) => {
    const surface = document.querySelector(selector);
    let scrollable = false;
    for (let el = surface?.parentElement ?? null; el; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === "auto" || overflow === "scroll") scrollable = true;
    }
    return {
      scrollable,
      railInert: document.querySelector(".rail")?.matches("[inert]") ?? false,
      focusInside: !!document.activeElement?.closest(selector),
    };
  }, sel);
}

for (const surface of SURFACES) {
  test(`${surface.name} seals the page behind it`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== surface.project, `drawn by the ${surface.project} layout`);
    test.skip(surface.anchored === true, "an anchored popover shares the page it sits in");
    await openScreen(page, surface.screen);
    await surface.open(page);
    await expect(page.locator(surface.sel)).toBeVisible();

    const sealed = await background(page, surface.sel);
    expect(sealed.scrollable, "the page behind the surface still scrolls").toBe(false);
    expect(sealed.railInert, "the nav rail behind the surface is not inert").toBe(true);

    await page.keyboard.press("Tab");
    const tabbed = await background(page, surface.sel);
    expect(tabbed.focusInside, "Tab left the surface").toBe(true);

    await dismiss(page, "escape");
    await expect(page.locator(surface.sel)).toHaveCount(0);

    const released = await background(page, surface.sel);
    expect(released.railInert, "the nav rail stayed inert after dismissal").toBe(false);
  });

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

// The palette is not in the overlay stack and calls `sealBackground` itself.
test("the command palette seals the page behind it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the other three projects emulate touch");
  await openScreen(page, screen("memory-review"));
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator(".palette")).toBeVisible();

  const sealed = await background(page, ".palette");
  expect(sealed.railInert, "the nav rail behind the palette is not inert").toBe(true);

  await page.keyboard.press("Tab");
  expect((await background(page, ".palette")).focusInside, "Tab left the palette").toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.locator(".palette")).toHaveCount(0);
  expect((await background(page, ".palette")).railInert, "the nav rail stayed inert").toBe(false);
});
