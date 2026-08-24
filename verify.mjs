// Definition of done (design/DESIGN.md §7), executable.
//   node verify.mjs [--url http://127.0.0.1:7872]
// Checks per screen × viewport: console/page errors (fail), contrast (fail),
// tap targets (fail <24px, warn <40px), rows-per-screen (report), keyboard walk
// (desktop, fail if list navigation is dead). Screenshots into shots/verify/.
// Read-only: navigates and presses j/k only — never types into fields.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://127.0.0.1:7872";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, mobile: true },
  { name: "phone", width: 486, height: 1085, mobile: true }, // Luma's device
  { name: "tablet", width: 768, height: 1024, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false },
];

mkdirSync("shots/verify", { recursive: true });

// ── in-page audits ─────────────────────────────────────────────────
const AUDITS = `((rowSel) => {
  const out = { taps: [], contrast: [], rows: 0, rowsMatched: 0, empty: false };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  };

  // tap targets
  for (const el of document.querySelectorAll("button, a, input, select, [role=button]")) {
    if (!vis(el) || el.closest("[data-verify-exempt]")) continue;
    // .hit (base.css) pads a control's hit area out to --tap with a positioned
    // ::after, by construction — the visual box stays small on purpose. Reading
    // the box would fail every one of them for a target that is really 44px.
    if (el.classList.contains("hit")) continue;
    const r = el.getBoundingClientRect();
    const min = Math.min(r.width, r.height);
    if (min < 40) out.taps.push({
      min: Math.round(min),
      label: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40),
    });
  }

  // contrast: text-bearing elements vs first opaque ancestor background
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = s.match(/rgba?\\(([\\d.]+), ?([\\d.]+), ?([\\d.]+)(?:, ?([\\d.]+))?\\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const bgOf = (el) => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        if (!acc) acc = { ...c };
        else { const a = acc.a; acc.r = acc.r * a + c.r * (1 - a); acc.g = acc.g * a + c.g * (1 - a); acc.b = acc.b * a + c.b * (1 - a); acc.a = a + c.a * (1 - a); }
        if (acc.a >= 0.99) return acc;
      }
      node = node.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor);
    return acc ?? root ?? { r: 11, g: 13, b: 18, a: 1 };
  };
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el) || el.closest("[data-verify-exempt],[data-contrast-exempt]")) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (!text) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color); if (!fg) continue;
    const bg = bgOf(el);
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const floor = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < floor) {
      const key = s.color + "|" + Math.round(ratio * 10) + "|" + text.slice(0, 20);
      if (seen.has(key)) continue;
      seen.add(key);
      out.contrast.push({ ratio: Math.round(ratio * 100) / 100, floor, px, text: text.slice(0, 40) });
    }
  }

  // density: fully-visible collapsed rows, per the screen's own row selector.
  // rowsMatched counts every visible row anywhere in the document, so a screen
  // whose selector matches nothing at all can be told apart from one whose rows
  // are simply taller than the viewport.
  if (rowSel) {
    for (const el of document.querySelectorAll(rowSel)) {
      if (!vis(el)) continue;
      if (el.parentElement?.closest(rowSel)) continue; // never count a nested row twice
      out.rowsMatched++;
      const r = el.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= innerHeight) out.rows++;
    }
    // "legitimately empty" means the list itself is empty — not the detail pane,
    // which shows its own empty state beside a full list on desktop.
    const list = document.querySelector(".rows");
    out.empty = !!(list ? list.querySelector(".emptystate") : document.querySelector(".emptystate"));
  }
  return out;
})`;

// ── run ────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const bookId = await (async () => {
  const res = await fetch(`${URL}/api/lorebooks`);
  const books = await res.json();
  return books[0]?.id;
})();

const presetId = await (async () => {
  const res = await fetch(`${URL}/api/prompts`);
  const presets = await res.json().catch(() => []);
  return presets[0]?.id;
})();

// The detail card is a route of its own, so the list screen below never
// exercises it. Prefer a memory with a section big enough to overflow the
// preview budget: that is the row that carries the arrow glyph and the peek,
// and a note whose sections all fit would check only half the screen.
const noteId = await (async () => {
  const res = await fetch(`${URL}/api/long-term-memory/notes?limit=500`);
  const notes = await res.json().catch(() => []);
  const saved = notes.filter?.((n) => n.type !== "source") ?? [];
  const big = saved.find((n) => Object.values(n.sections ?? {}).some((s) => (s.text?.length ?? 0) > 700));
  return (big ?? saved[0])?.id;
})();

// rows: the collapsed list row each screen actually renders, one entry per item.
// Screens genuinely differ — lorebooks/vault use .row, the review queue uses
// .mem-row, sources uses .srow — so density is measured per screen rather than
// with one global union that would miss rows or double-count nested ones.
// A screen with no rows list (presets) omits `rows` and reports no density.
const SCREENS = [
  { name: "picker", path: "/#/lorebooks", waitFor: ".card", rows: ".card" },
  { name: "audit", path: `/#/lorebooks/${bookId}`, waitFor: ".row", rows: ".row" },
  { name: "presets", path: "/#/presets", waitFor: ".card" },
  ...(presetId ? [{ name: "preset-editor", path: `/#/presets/${presetId}`, waitFor: ".row", rows: ".row" }] : []),
  { name: "memory-review", path: "/#/memory/review", waitFor: ".mem-rows", rows: ".mem-row" },
  { name: "memory-vault", path: "/#/memory/vault", waitFor: ".mem-rows", rows: ".row" },
  ...(noteId ? [{ name: "memory-detail", path: `/#/memory/vault/${noteId}`, waitFor: ".mdc-row", rows: ".mdc-row-wrap" }] : []),
  { name: "memory-sources", path: "/#/memory/sources", waitFor: ".mem-rows", rows: ".srow" },
];

let failures = 0, warnings = 0, blind = 0;
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2, isMobile: vp.mobile, hasTouch: vp.mobile,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  for (const screen of SCREENS) {
    await page.goto(URL + screen.path, { waitUntil: "networkidle" });
    await page.waitForSelector(screen.waitFor, { timeout: 15000 }).catch(() => errors.push(`${screen.name}: ${screen.waitFor} never appeared`));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/verify/${vp.name}-${screen.name}.png` });

    const audit = await page.evaluate(`${AUDITS}(${JSON.stringify(screen.rows ?? null)})`);
    const hardTaps = audit.taps.filter((t) => t.min < 24);
    const softTaps = audit.taps.filter((t) => t.min >= 24);
    const tag = `${vp.name}/${screen.name}`;

    if (errors.length) { failures++; console.log(`FAIL ${tag} — console errors:\n  ${errors.join("\n  ")}`); errors.length = 0; }
    if (audit.contrast.length) {
      failures++;
      console.log(`FAIL ${tag} — contrast below floor:`);
      for (const c of audit.contrast.slice(0, 6)) console.log(`  ${c.ratio}:1 (needs ${c.floor}) ${c.px}px "${c.text}"`);
    }
    if (hardTaps.length) {
      failures++;
      console.log(`FAIL ${tag} — targets under 24px: ${hardTaps.map((t) => `"${t.label}" ${t.min}px`).join(", ")}`);
    }
    if (softTaps.length) { warnings += softTaps.length; }
    // A metric that cannot fail is not a metric: if the screen rendered but its
    // row selector matched nothing anywhere, the density number is blind, not 0.
    let density = "";
    if (screen.rows) {
      if (audit.rowsMatched === 0 && !audit.empty) {
        blind++;
        console.log(`WARN ${tag} — density is blind: "${screen.rows}" matched no rows (selector stale?)`);
        density = ` · density unmeasured ("${screen.rows}" matched 0)`;
      } else if (audit.rowsMatched === 0) {
        density = ` · 0 rows visible (empty state)`;
      } else {
        density = ` · ${audit.rows} rows visible (of ${audit.rowsMatched})`;
      }
    }
    console.log(`ok   ${tag}${density}${softTaps.length ? ` · ${softTaps.length} targets 24–39px (warn)` : ""}`);
  }

  // command palette check (desktop)
  if (!vp.mobile) {
    await page.goto(URL + "/", { waitUntil: "networkidle" });
    await page.keyboard.press("ControlOrMeta+k");
    const seen = await page.waitForSelector(".palette-input", { timeout: 3000 }).catch(() => null);
    if (!seen) { failures++; console.log(`FAIL ${vp.name} — Cmd-K did not open the palette`); }
    else {
      await page.type(".palette-input", "presets");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      const hash = await page.evaluate(() => location.hash);
      if (!hash.includes("presets")) { failures++; console.log(`FAIL ${vp.name} — palette Enter did not navigate (hash=${hash})`); }
      else console.log(`ok   ${vp.name}/palette — Cmd-K opens, search + Enter navigates`);
    }
    // g-sequence navigation
    await page.goto(URL + "/#/lorebooks", { waitUntil: "networkidle" });
    await page.keyboard.press("g");
    await page.keyboard.press("p");
    await page.waitForTimeout(400);
    const gHash = await page.evaluate(() => location.hash);
    if (!gHash.includes("presets")) { failures++; console.log(`FAIL ${vp.name} — g p did not navigate (hash=${gHash})`); }
    else console.log(`ok   ${vp.name}/hotkeys — g p navigates to presets`);
  }

  // keyboard walk on desktop audit screen
  if (!vp.mobile && bookId) {
    await page.goto(`${URL}/#/lorebooks/${bookId}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".row");
    await page.click(".row .row-summary");
    const before = await page.evaluate(() => document.activeElement?.getAttribute("data-row"));
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    const after = await page.evaluate(() => document.activeElement?.getAttribute("data-row"));
    if (!after || after === before) { failures++; console.log(`FAIL ${vp.name} — j/k list navigation did not move focus`); }
    else console.log(`ok   ${vp.name}/keyboard — j/k moves row focus`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} FAILURES` : "all checks pass"}${warnings ? ` · ${warnings} soft-target warnings` : ""}${blind ? ` · ${blind} density selectors matched nothing (WARN — density unmeasured there)` : ""}`);
process.exit(failures ? 1 : 0);
