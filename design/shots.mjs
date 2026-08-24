#!/usr/bin/env node
// Screenshots at the project's standard viewports, so every visual review is
// taken at the same widths and a "mobile" rendering is actually mobile.
//
//   node design/shots.mjs <url> [name] [--sel .selector] [--full]
//
// Widths match verify.mjs exactly (design/DESIGN.md §7): a wireframe that
// looks fine in a 300px box on a desktop page has proved nothing — the box
// was not a phone. Render at the real viewport or do not claim the result.

import { chromium } from "playwright-core";
const DEV_URL = (process.env.MC_DEV_URL ?? "http://127.0.0.1:5173") + "/";
import { mkdirSync } from "node:fs";

export const VIEWPORTS = [
  // 390 is the narrow floor (iPhone-class). 486 is Luma's actual device
  // (1080 physical at DPR 2.22) and is the one that has to look right — a
  // layout tuned only at 390 has never been seen at the width it ships to.
  { name: "narrow", width: 390, height: 844 },
  { name: "phone", width: 486, height: 1085 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

const args = process.argv.slice(2);
const url = args[0];
const name = args[1] && !args[1].startsWith("--") ? args[1] : "shot";
const sel = args.includes("--sel") ? args[args.indexOf("--sel") + 1] : null;
const full = args.includes("--full");
if (!url) { console.error("usage: node design/shots.mjs <url> [name] [--sel .x] [--full]"); process.exit(1); }

const OUT = "/tmp/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const problems = [];
  page.on("pageerror", (e) => problems.push(String(e).slice(0, 100)));
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  const target = sel ? page.locator(sel).first() : page;
  const path = `${OUT}/${name}-${vp.name}.png`;
  await target.screenshot({ path, fullPage: sel ? undefined : full });
  // Horizontal overflow is the defect this tool exists to catch.
  const over = await page.evaluate(() => {
    const d = document.documentElement;
    const wide = [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 1)
      .slice(0, 5)
      .map((el) => (el.className || el.tagName).toString().slice(0, 40));
    return { scrollW: d.scrollWidth, clientW: d.clientWidth, wide };
  });
  const bad = over.scrollW > over.clientW + 1;
  console.log(`${vp.name.padEnd(8)} ${String(vp.width).padStart(4)}px → ${path}` +
    (bad ? `  OVERFLOW ${over.scrollW}>${over.clientW}: ${over.wide.join(", ")}` : "") +
    (problems.length ? `  ERRORS: ${problems[0]}` : ""));
  await page.close();
}
await browser.close();
