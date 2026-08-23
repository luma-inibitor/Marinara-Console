#!/usr/bin/env node
// Every layered surface must dismiss three ways: scrim tap, Escape, and back
// (the Android gesture and the browser button are the same event). The import
// confirm silently answered only one of them for weeks, because each sheet
// registered with the overlay stack by hand and one forgot.
//
//   node design/overlaycheck.mjs
//
// The import confirm is not in the table below because it only appears above
// CONFIRM_THRESHOLD sources and the seeded corpus has fewer. To check it, set
// that constant in Sources.tsx to 0, select one source, and confirm the modal
// closes on scrim tap, Escape, back and Cancel — and that dismissing it does
// not import. Put the constant back afterwards.
import { chromium } from "/Users/eli/code/marinara-console/node_modules/playwright-core/index.mjs";

const CASES = [
  { name: "facet sheet",  hash: "#/memory/review",  w: 486, open: async (p) => {
      await p.getByRole("button", { name: /^Filter/ }).click(); }, sel: ".sheet" },
  { name: "group sheet",  hash: "#/memory/review",  w: 486, open: async (p) => {
      await p.getByRole("button", { name: /^Group/ }).click(); }, sel: ".sheet.option-sheet" },
  { name: "sort sheet",   hash: "#/memory/review",  w: 486, open: async (p) => {
      await p.getByRole("button", { name: /^Sort/ }).click(); }, sel: ".sheet.option-sheet" },
  { name: "note peek",    hash: "#/memory/vault",   w: 1280, open: async (p) => {
      await p.locator(".row-summary").first().click();
      await p.waitForTimeout(500);
      await p.locator(".notelink").first().click(); }, sel: ".sheet" },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
let fails = 0;
for (const c of CASES) {
  for (const how of ["scrim", "escape", "back"]) {
    const p = await browser.newPage({ viewport: { width: c.w, height: 900 } });
    try {
      await p.goto("http://127.0.0.1:5173/" + c.hash, { waitUntil: "networkidle", timeout: 60000 });
      await p.waitForTimeout(1500);
      await c.open(p);
      await p.waitForTimeout(700);
      const opened = await p.locator(c.sel).count();
      if (!opened) { console.log(`FAIL ${c.name} / ${how}: never opened`); fails++; await p.close(); continue; }
      if (how === "scrim") await p.locator(".peek-scrim").click({ position: { x: 5, y: 5 } });
      if (how === "escape") await p.keyboard.press("Escape");
      if (how === "back") await p.goBack();
      await p.waitForTimeout(700);
      const still = await p.locator(c.sel).count();
      if (still) { console.log(`FAIL ${c.name} / ${how}: still open`); fails++; }
      else console.log(`ok   ${c.name} / ${how}`);
    } catch (e) {
      console.log(`FAIL ${c.name} / ${how}: ${String(e).split("\n")[0].slice(0, 90)}`); fails++;
    }
    await p.close();
  }
}
await browser.close();
console.log(fails === 0 ? "\nevery overlay dismisses three ways" : `\n${fails} failures`);
process.exit(fails ? 1 : 0);
