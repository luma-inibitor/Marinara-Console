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

// `settle` is how long #app must go without a DOM mutation before the page
// counts as ready — a condition, not a sleep.
//
// A fixed pause was wrong in both directions and wrong invisibly. Mounting is
// satisfied by the shell, which renders before any screen has its data, so the
// gate below it was a stopwatch: on a cold dev server the module graph is still
// being transformed while the clock runs, the screen is still on its <Loading>
// line when the clock stops, and the caller records a spinner as if it were the
// finished render. On a snapshot check that reads as every element of the screen
// disappearing — a diff with no code behind it, on whichever screens happened to
// lose the race. Waiting for the loading line to clear and then for the tree to
// hold still ties the wait to what the app is actually doing, and it costs the
// same on a warm server as the sleep it replaced.
//
// Mounting is waited on rather than assumed. Vite rewrites every module URL
// with a `?t=` cache-buster when a file changes, so a file edited, moved or
// split while a check is running leaves the served module graph pointing at a
// path the dev server no longer has. The import chain then dies before any
// component renders, #app stays empty, and every locator the caller writes
// waits out its full timeout and blames the UI for a dev-server fault. Failing
// here instead names the real cause. The re-navigation is not a retry for a
// flaky app: a fresh index.html is what makes Vite re-emit the module graph
// with current timestamps, and it is the only way out of a poisoned one.
export async function openPage(browser, { viewport, hash = "", url = DEV_URL + hash, settle = 0, timeout = 60000 }) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  let refused = new Set();
  page.on("requestfailed", (r) => { if (r.url().startsWith(DEV_URL)) refused.add(`${r.url()} ${r.failure()?.errorText ?? "failed"}`); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(DEV_URL)) refused.add(`${r.url()} HTTP ${r.status()}`); });

  await page.goto(url, { waitUntil: "networkidle", timeout });
  for (let attempt = 0; ; attempt++) {
    try {
      await page.waitForFunction(() => document.getElementById("app")?.childElementCount > 0, null, { timeout: 15000 });
      break;
    } catch {
      const why = refused.size ? ` (dev server refused ${[...refused].join(", ")})` : "";
      if (attempt >= 1) throw new Error(`app never mounted at ${url}${why}`);
      refused = new Set();
      await page.reload({ waitUntil: "networkidle", timeout });
    }
  }
  // `.loadingstate` is the one loading marker in the app (src/ui/Loading.tsx),
  // so its absence is the screen saying its data arrived. It is not a forever
  // wait even when the engine is down: the same component gives up at twelve
  // seconds and becomes an error state, which clears this and gets recorded as
  // the deterministic render it is.
  try {
    await page.waitForFunction(() => !document.querySelector("#app .loadingstate"), null, { timeout: 20000 });
  } catch {
    throw new Error(`screen never finished loading at ${url}`);
  }
  // Web fonts change metrics, which moves anything measured from layout.
  await page.evaluate(() => document.fonts.ready.then(() => true));
  if (settle && !(await quiet(page, settle))) {
    console.warn(`warning: ${url} never held still for ${settle}ms — reading it anyway`);
  }
  return page;
}

/** Resolve true once #app has gone `span` ms without a mutation, false if it
 *  never does. Attributes count: a class that flips is exactly the kind of
 *  change the snapshot check exists to notice. */
function quiet(page, span, cap = Math.max(span * 4, 8000)) {
  return page.evaluate(([span, cap]) => new Promise((resolve) => {
    const root = document.getElementById("app");
    if (!root) return resolve(true);
    let idle;
    const observer = new MutationObserver(() => arm());
    const stop = (settled) => { observer.disconnect(); clearTimeout(idle); clearTimeout(giveUp); resolve(settled); };
    const giveUp = setTimeout(() => stop(false), cap);
    const arm = () => { clearTimeout(idle); idle = setTimeout(() => stop(true), span); };
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    arm();
  }), [span, cap]);
}
