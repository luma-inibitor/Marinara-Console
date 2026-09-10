// The three keyboard routes DESIGN.md §3 offers: the command palette, the `g`
// jump sequences, and j/k down a list.

import type { Page } from "@playwright/test";
import { expect, test } from "./harness";
import { openScreen, screen } from "./screens";

test.skip(({ isMobile }) => !!isMobile, "the other three projects emulate touch");

const focusedRow = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("data-row") ?? null);

test("Cmd-K opens the palette and Enter navigates", async ({ page }) => {
  await openScreen(page, screen("lorebooks"));
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator(".palette-input")).toBeVisible();

  await page.locator(".palette-input").fill("presets");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/presets/);
});

test("g then p navigates to presets", async ({ page }) => {
  await openScreen(page, screen("lorebooks"));
  await page.keyboard.press("g");
  await page.keyboard.press("p");
  await expect(page).toHaveURL(/#\/presets/);
});

test("j and k move row focus", async ({ page }) => {
  await openScreen(page, screen("lorebook-audit"));
  await page.locator(".row .row-summary").first().click();
  const before = await focusedRow(page);

  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await page.keyboard.press("k");

  const after = await focusedRow(page);
  expect(after, "nothing holds row focus").not.toBeNull();
  expect(after, "j/k did not move row focus").not.toBe(before);
});
