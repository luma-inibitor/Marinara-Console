// Shared harness for the checks that drive a real browser: where the dev
// server is, how Chromium is started, the project's standard viewports, and
// the open/navigate/settle sequence they all repeat.
//
// Only things every browser check needs live here. A helper used by one script
// belongs in that script — this module exists to remove duplication, not to
// become a junk drawer of one-offs.
import { chromium } from "playwright-core";

// Trailing slash matters: callers append "#/route" and a hash on a bare origin
// is not a same-document URL Vite will serve.
export const DEV_URL = (process.env.MC_DEV_URL ?? "http://127.0.0.1:5233") + "/";

// The standard viewports (design/DESIGN.md §7). 390 is the narrow floor
// (iPhone-class). 486 is Luma's actual device (1080 physical at DPR 2.22) and
// is the one that has to look right — a layout tuned only at 390 has never
// been seen at the width it ships to. 768 is the band between the two CSS
// breakpoints, 1280 is desktop.
export const VIEWPORTS = {
  narrow: { name: "narrow", width: 390, height: 844 },
  phone: { name: "phone", width: 486, height: 1085 },
  tablet: { name: "tablet", width: 768, height: 1024 },
  desktop: { name: "desktop", width: 1280, height: 800 },
};

export const ALL_VIEWPORTS = Object.values(VIEWPORTS);

// PLAYWRIGHT_CHROMIUM_PATH is honored here and nowhere else, so no check can
// forget it and silently depend on a machine having a default Chromium.
export function launch(options = {}) {
  return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, ...options });
}

// `settle` is the pause after networkidle: the app finishes its first data
// render after the network has gone quiet, so networkidle alone is too early.
export async function openPage(browser, { viewport, hash = "", url = DEV_URL + hash, settle = 0, timeout = 60000 }) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto(url, { waitUntil: "networkidle", timeout });
  if (settle) await page.waitForTimeout(settle);
  return page;
}
