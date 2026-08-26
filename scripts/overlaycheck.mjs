#!/usr/bin/env node
// Every layered surface must dismiss every way it offers — scrim tap, Escape,
// and back (the Android gesture and the browser button are the same event) —
// and must leave the reader on the screen they were reading. Registration with
// the overlay stack is by hand, per sheet, so a surface can silently miss one
// route while answering the others.
//
//   node scripts/overlaycheck.mjs
//
// The import confirm is not in the table below because it only appears above
// CONFIRM_THRESHOLD sources and the seeded corpus has fewer. To check it, set
// that constant in Sources.tsx to 0, select one source, and confirm the modal
// closes on scrim tap, Escape, back and Cancel — and that dismissing it does
// not import. Put the constant back afterwards.
import { launch, openSurface, VIEWPORTS } from "./lib/browser.mjs";

// Every case runs at one page height rather than its viewport's own, so the
// amount of page behind a surface is constant across cases. Only the width
// selects the layout path under test.
const HEIGHT = 900;

// `dismiss` names the routes a surface actually offers. Everything built on
// <Sheet>/<Modal> offers all three. The tag panel is a full-screen surface with
// no scrim to tap, so it declares only escape and back rather than pretending
// to pass a scrim case that never ran.
const ALL = ["scrim", "escape", "back"];

const CASES = [
  { name: "facet sheet",  hash: "#/memory/review",  vp: VIEWPORTS.phone, open: async (p) => {
      await p.getByRole("button", { name: /^Filter/ }).click(); }, sel: ".sheet" },
  // Group and sort open the SAME sheet. Both openers are still checked: they
  // are two controls onto one surface, and either could lose its wiring.
  { name: "view sheet / from group",  hash: "#/memory/review",  vp: VIEWPORTS.phone, open: async (p) => {
      await p.getByRole("button", { name: /^Group/ }).click(); }, sel: ".sheet.view-sheet" },
  { name: "view sheet / from sort",   hash: "#/memory/review",  vp: VIEWPORTS.phone, open: async (p) => {
      await p.getByRole("button", { name: /^Sort/ }).click(); }, sel: ".sheet.view-sheet" },
  { name: "dock sheet",   hash: "#/memory/review",  vp: VIEWPORTS.phone, open: async (p) => {
      await p.getByRole("button", { name: /What Apply will send/ }).click(); }, sel: ".sheet.dock-sheet" },
  { name: "note peek",    hash: "#/memory/vault",   vp: VIEWPORTS.desktop, open: async (p) => {
      await p.locator(".row-summary").first().click();
      // No pause between the two clicks: .notelink exists only inside a record,
      // never in the list, so waiting for it to be clickable *is* waiting for
      // the record to have arrived.
      await p.locator(".notelink").first().click(); }, sel: ".sheet" },
  // The memory detail card has no layered surface of its own: every section
  // expands in place, so there is nothing here to dismiss.
  // The lorebook tag panel. Every case above is a memory-tool surface, so this
  // is the one non-memory surface the check covers. Opened from the dock so it
  // exercises the phone path.
  { name: "tag panel", hash: "#/lorebooks/JZzGg_2NjFx1hFP_G4Yeq", vp: VIEWPORTS.phone,
    dismiss: ["escape", "back"], open: async (p) => {
      await p.getByRole("button", { name: /Tags/ }).click(); }, sel: ".tagpanel" },
];

const browser = await launch();
let fails = 0;
for (const c of CASES) {
  for (const how of c.dismiss ?? ALL) {
    let p;
    try {
      p = await openSurface(browser, {
        viewport: { width: c.vp.width, height: HEIGHT }, hash: c.hash, settle: 1500,
        open: c.open, sel: c.sel,
      });
      // "The screen they were reading" is wherever opening the surface left
      // them, not the route the case started at: reaching a record can itself
      // be a navigation, and the peek opens over that record, not over the list.
      const base = new URL(p.url()).hash;
      if (how === "scrim") await p.locator(".peek-scrim").click({ position: { x: 5, y: 5 } });
      if (how === "escape") await p.keyboard.press("Escape");
      if (how === "back") await p.goBack();
      await p.waitForTimeout(700);
      const still = await p.locator(c.sel).count();
      const hash = new URL(p.url()).hash;
      if (still) { console.log(`FAIL ${c.name} / ${how}: still open`); fails++; }
      // Closing the surface is only half of it: a dismissal that also unwinds
      // the route has thrown the reader out of the screen they were reading.
      else if (hash !== base) { console.log(`FAIL ${c.name} / ${how}: left the screen (hash "${hash}", expected "${base}")`); fails++; }
      else console.log(`ok   ${c.name} / ${how}`);
    } catch (e) {
      // Wide enough for the harness's mount failure, which names the module the
      // dev server refused. Clipped shorter, that reads as a bare click timeout
      // and points the reader at the overlay code instead of the real fault.
      console.log(`FAIL ${c.name} / ${how}: ${String(e).split("\n")[0].slice(0, 300)}`); fails++;
    }
    // Optional: a navigation that never landed leaves no page to close.
    await p?.close();
  }
}
await browser.close();
console.log(fails === 0 ? "\nevery overlay dismisses every way it offers" : `\n${fails} failures`);
process.exit(fails ? 1 : 0);
