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
  dismiss: readonly Route[];
}

/** The invisible scrim under a popover, which takes the outside click. */
const POPOVER_SCRIM = "[data-popover-scrim]";

const SURFACES: Surface[] = [
  {
    name: "facet sheet",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: "Filter", exact: true }).click(),
    sel: ".sheet.filter-sheet",
    dismiss: ROUTES,
  },
  // The phone and desktop rails each draw their own pair of pickers.
  {
    name: "group picker",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: /^Group by: / }).click(),
    sel: '[role="menu"][aria-label="Group by"]',
    scrim: POPOVER_SCRIM,
    dismiss: ROUTES,
  },
  {
    name: "sort picker",
    project: "desktop",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: /^Sort by: / }).click(),
    sel: '[role="menu"][aria-label="Sort by"]',
    scrim: POPOVER_SCRIM,
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
      await page.locator(".mem-rows [data-row]").first().click();
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
    sel: '[role="menu"]',
    scrim: POPOVER_SCRIM,
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
  {
    name: "command palette",
    project: "desktop",
    screen: screen("memory-review"),
    open: (page) => page.keyboard.press("ControlOrMeta+k"),
    sel: ".palette",
    scrim: ".palette-backdrop",
    dismiss: ROUTES,
  },
  {
    name: "cheat sheet",
    project: "desktop",
    screen: screen("memory-review"),
    open: (page) => page.keyboard.press("?"),
    sel: ".palette.cheat",
    scrim: ".palette-backdrop",
    dismiss: ROUTES,
  },
  {
    name: "character picker",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: /^Character: / }).click(),
    sel: '[role="dialog"][aria-label="Character"]',
    scrim: POPOVER_SCRIM,
    dismiss: ROUTES,
  },
  {
    name: "chat picker",
    project: "phone",
    screen: screen("memory-review"),
    open: (page) => page.getByRole("button", { name: /^Chat: / }).click(),
    sel: '[role="dialog"][aria-label="Chat"]',
    scrim: POPOVER_SCRIM,
    dismiss: ROUTES,
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
      railInert: document.querySelector(".rail")?.closest("[inert]") != null,
      focusInside: !!document.activeElement?.closest(selector),
    };
  }, sel);
}

for (const surface of SURFACES) {
  test(`${surface.name} seals the page behind it`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== surface.project, `drawn by the ${surface.project} layout`);
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
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(kebab).toBeFocused();
});

test("opening a note from the group menu leaves one history entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "drawn by the phone layout");
  await openScreen(page, screen("memory-review"));
  const base = new URL(page.url()).hash;
  await page.locator("button.gmenu").first().click();
  await page.getByRole("menuitem", { name: /^Open / }).click();

  await expect(page.locator(".sheet.peek-sheet")).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.locator(".sheet.peek-sheet")).toHaveCount(0);
  expect(new URL(page.url()).hash, "dismissal left the screen").toBe(base);

  await page.goBack();
  expect(new URL(page.url()).hash, "an orphan entry swallowed the back").not.toBe(base);
});

test("Escape closes the palette opened over a sheet, not the sheet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "drawn by the phone layout");
  await openScreen(page, screen("memory-review"));
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator(".sheet.filter-sheet")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator(".palette")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.locator(".palette")).toHaveCount(0);
  await expect(page.locator(".sheet.filter-sheet")).toBeVisible();
});

test("a picked scope closes the picker and returns focus to its trigger", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "drawn by the phone layout");
  await openScreen(page, screen("memory-review"));
  const base = new URL(page.url()).hash;
  await page.getByRole("button", { name: /^Character: / }).click();
  await page.getByRole("dialog", { name: "Character" }).getByRole("button").nth(1).click();

  await expect(page.getByRole("dialog", { name: "Character" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Character: / })).toBeFocused();
  expect(new URL(page.url()).hash, "the pick left the screen").toBe(base);
});

test("a picked grouping closes the picker and reads on its trigger", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "drawn by the phone layout");
  await openScreen(page, screen("memory-review"));
  const base = new URL(page.url()).hash;
  await page.getByRole("button", { name: /^Group by: / }).click();
  const menu = page.getByRole("menu", { name: "Group by" });
  await expect(menu.getByRole("menuitemradio", { name: /^target memory/ })).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("menuitemradio", { name: /^nothing/ }).click();

  await expect(menu).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Group by: nothing" });
  await expect(trigger).toBeFocused();
  expect(new URL(page.url()).hash, "the pick left the screen").toBe(base);
});
