// The eight surfaces every browser check visits, as a list something can
// iterate. One catalog, so a renamed class is corrected once.

import { expect, type Page } from "@playwright/test";
import { BOOK_ID } from "./fixtures/lorebooks";
import { PRESET_ID } from "./fixtures/presets";
import { NOTE_ID, REVIEW_ROWS } from "./fixtures/memory";

export interface Screen {
  /** Used in test titles and artifact names; keep it filename-safe. */
  name: string;
  /** The hash route, from the app root. */
  path: string;
  /** The element that proves the screen ASSEMBLED, not merely that it mounted.
   *  A screen that rendered its error state still has an `#app` with children. */
  ready: string;
  /** The repeating list row. Screens differ — `.row`, `.mem-row`, `.srow` — so
   *  a single union selector would miss rows or count nested ones twice. */
  row: string;
  /** Exactly how many rows the corpus puts on this screen. An exact count, not
   *  a floor, because most of these numbers are a rule rather than a total: the
   *  vault lists nine of ten memories because one is archived, and the review
   *  queue lists twelve of thirteen claims because one sits behind a blocked
   *  draft. A floor would pass while the rule that produced the number was
   *  broken, which is the only thing worth asserting here. */
  rows: number;
}

export const SCREENS: Screen[] = [
  { name: "lorebooks", path: "/#/lorebooks", ready: ".card", row: ".card", rows: 3 },
  { name: "lorebook-audit", path: `/#/lorebooks/${BOOK_ID}`, ready: ".row", row: ".row", rows: 12 },
  { name: "presets", path: "/#/presets", ready: ".preset-card", row: ".preset-card", rows: 3 },
  { name: "preset-editor", path: `/#/presets/${PRESET_ID}`, ready: ".row", row: ".row", rows: 11 },
  { name: "memory-review", path: "/#/memory/review", ready: ".mem-rows", row: ".mem-row", rows: REVIEW_ROWS },
  { name: "memory-vault", path: "/#/memory/vault", ready: ".mem-rows", row: ".row", rows: 9 },
  { name: "memory-detail", path: `/#/memory/vault/${NOTE_ID}`, ready: ".mdc-row", row: ".mdc-row-wrap", rows: 4 },
  { name: "memory-sources", path: "/#/memory/sources", ready: ".mem-rows", row: ".srow", rows: 10 },
];

/**
 * Navigate to a screen and wait until it is worth measuring.
 *
 * Three waits, and each one has caught something the others do not: the app
 * mounting at all, the screen's own marker appearing, and the loading state
 * going away. `Loading` self-times-out after 12 seconds and then renders an
 * error, so waiting on it can never hang past that.
 *
 * Fonts last, because web fonts change text metrics and everything a later
 * check measures — contrast box, tap target, overflow — is read off layout.
 */
export async function openScreen(page: Page, screen: Screen): Promise<void> {
  await page.goto(screen.path);
  await page.waitForFunction(() => (document.getElementById("app")?.childElementCount ?? 0) > 0);
  await page.locator(screen.ready).first().waitFor({ state: "visible" });
  await expect(page.locator("#app .loadingstate")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

/** The catalog entry by name. Throws rather than returning undefined, so a
 *  renamed screen fails at the lookup instead of inside a locator. */
export function screen(name: string): Screen {
  const found = SCREENS.find((s) => s.name === name);
  if (!found) throw new Error(`no screen named "${name}" in SCREENS`);
  return found;
}
