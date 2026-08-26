// Shared harness for the scripts that drive a real browser: where the dev
// server is, how Chromium is started, the project's standard viewports, and
// the open/navigate/settle sequence.
//
// Imports chromium from `@playwright/test`: the bare library packages are no
// longer devDependencies.
import { chromium } from "@playwright/test";

// Trailing slash matters: callers append "#/route" and a hash on a bare origin
// is not a same-document URL Vite will serve.
const DEV_URL = (process.env.MC_DEV_URL ?? "http://127.0.0.1:5233") + "/";

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

// PLAYWRIGHT_CHROMIUM_PATH is honored here and nowhere else, so no check can
// forget it and silently depend on a machine having a default Chromium.
export function launch(options = {}) {
  return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, ...options });
}

// `settle` is how long #app must go without a DOM mutation before the page is
// ready. A fixed wait can return while a screen is still loading.
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
//
async function openPage(browser, { viewport, hash = "", url = DEV_URL + hash, settle = 0, timeout = 60000 }) {
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
  // The app's only loading marker (src/ui/Loading.tsx). It self-times-out at
  // 12s, so this cannot hang.
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

// Open a surface a URL cannot reach: an overlay, a selected row, an expanded
// editor. `open` drives the app there. Without a `sel` to wait for, a click
// that did nothing reads as a reached surface.
export async function openSurface(browser, { open, sel, ...rest }) {
  const page = await openPage(browser, rest);
  try {
    if (open) await open(page);
    if (sel) await page.locator(sel).first().waitFor({ state: "attached", timeout: 15000 });
    if (open) await quiet(page, rest.settle ?? 800);
  } catch (e) {
    await page.close();
    throw new Error(`${sel ?? "surface"} not reached: ${String(e).split("\n")[0]}`);
  }
  return page;
}

// Component names that produced DOM on this page, read off React's fiber tree.
// A component that rendered null is not counted: NotePeek stays mounted on every
// memory screen and renders nothing until a note is peeked. Throws on a
// production bundle, where the names are minified.
export async function renderedComponents(page) {
  const names = await page.evaluate(() => {
    const root = document.getElementById("app");
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    if (!key) return null;
    const nameOf = (t) => {
      if (typeof t === "function") return t.displayName || t.name || null;
      if (t && typeof t === "object") return t.displayName || t.render?.name || t.type?.name || null;
      return null;
    };
    // The container property keeps the root fiber from mount. React
    // double-buffers, so `stateNode.current` is the tree on screen now.
    const fibers = [];
    const seen = new Set();
    const stack = [root[key].stateNode?.current ?? root[key]];
    while (stack.length) {
      const f = stack.pop();
      if (!f || seen.has(f)) continue;
      seen.add(f);
      fibers.push(f);
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    const rendered = new Set();
    for (const f of fibers) {
      if (!(f.stateNode instanceof Element)) continue;
      for (let a = f.return; a && !rendered.has(a); a = a.return) rendered.add(a);
    }
    const out = new Set();
    for (const f of rendered) { const n = nameOf(f.type); if (n) out.add(n); }
    return [...out];
  });
  if (!names) throw new Error("no React fiber tree on the page — component coverage needs a dev build");
  return names.sort();
}

/** True once #app has gone `span` ms without a mutation, false if it never
 *  does. Attributes count: a flipped class is a change worth catching. */
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
