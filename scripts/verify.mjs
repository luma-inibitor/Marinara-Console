// Definition of done (design/DESIGN.md §7), executable.
//   node scripts/verify.mjs [--url http://127.0.0.1:7872]
// Checks per screen × viewport: console/page errors and warnings (fail),
// contrast (fail), tap targets (fail below §2's floors), horizontal document
// overflow (fail), rows-per-screen (report), keyboard walk (desktop, fail if
// list navigation is dead). Screenshots into shots/verify/.
// Read-only: navigates and presses j/k only — never types into fields.
import { launch, openPage, ALL_VIEWPORTS } from "./lib/browser.mjs";
import { mkdirSync } from "node:fs";

// This check drives a served build, not the dev server, so it takes its origin
// on the command line rather than from the harness's MC_DEV_URL.
const URL = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://127.0.0.1:7872";

// Touch emulation is a property of the run, not of the viewport, so it stays
// here: only this check opens contexts with isMobile/hasTouch at all.
const TOUCH = new Set(["narrow", "phone", "tablet"]);

// `data-contrast-exempt` in the markup only *claims* an exemption. It is
// honored solely for elements matching an entry here, and every entry states
// why the ink may sit below §1's floor; an element carrying the attribute with
// no entry is measured like any other. A selector may name a pseudo-element.
// Anything aria-hidden needs no entry: the contrast pass skips it wholesale.
const CONTRAST_EXEMPTIONS = [
  [".sep", "separator glyph between meta fields; punctuation, no information"],
  [".mdc-sep", "separator glyph between meta fields; punctuation, no information"],
  [".meta > * + *::before", "separator glyph between meta fields; punctuation, no information"],
  ["[data-brand]", "logotype; WCAG 1.4.3 exempts brand wordmarks from contrast"],
];

// §2/§7 floors: under TAP_PRIMARY a control is legitimate only as a secondary
// one, which §2 grants on the condition that it clears TAP_GAP of its neighbours.
const TAP_PRIMARY = 44, TAP_SECONDARY = 24, TAP_GAP = 8;

mkdirSync("shots/verify", { recursive: true });

// ── in-page audits ─────────────────────────────────────────────────
const AUDITS = `((rowSel, exemptions, TAP_PRIMARY, TAP_SECONDARY, TAP_GAP) => {
  const out = { taps: [], contrast: [], unjustifiedExempt: 0, overflow: 0, rows: 0, rowsMatched: 0, empty: false };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    // Opacity is not inherited into a computed style, so a transparent ancestor
    // has to be looked for; visibility and display are already resolved here.
    if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (getComputedStyle(p).opacity === "0") return false;
    }
    return true;
  };
  // A bounding rect is unclipped: an element scrolled out of an overflow
  // container still reports the box it would occupy, which is a place nobody can
  // see or touch and which usually sits over unrelated content. Null comes back
  // for such an element, and otherwise the box that is really there.
  //
  // The two kinds of overflow are not the same fact. auto and scroll hide by
  // scroll position, so a half-scrolled control is still a full-size control and
  // keeps its own rect; only one scrolled entirely away is gone. hidden and clip
  // take the area off for good, so the rect shrinks to what is left.
  const clipTo = (el, r) => {
    const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let l = r.left, t = r.top, rt = r.right, b = r.bottom; // what is on screen now
    // A positioned box is only clipped by ancestors in its containing block
    // chain: a fixed one escapes them all, an absolute one escapes until the
    // first positioned ancestor.
    let escaping = getComputedStyle(el).position;
    if (escaping === "fixed") return box;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      const clipsX = s.overflowX !== "visible", clipsY = s.overflowY !== "visible";
      if ((clipsX || clipsY) && escaping !== "absolute") {
        // overflow clips to the padding box, so the borders come off the rect.
        const c = p.getBoundingClientRect();
        const edge = { left: c.left + parseFloat(s.borderLeftWidth), top: c.top + parseFloat(s.borderTopWidth),
          right: c.right - parseFloat(s.borderRightWidth), bottom: c.bottom - parseFloat(s.borderBottomWidth) };
        if (clipsX) {
          l = Math.max(l, edge.left); rt = Math.min(rt, edge.right);
          if (s.overflowX === "hidden" || s.overflowX === "clip") {
            box.left = Math.max(box.left, edge.left); box.right = Math.min(box.right, edge.right);
          }
        }
        if (clipsY) {
          t = Math.max(t, edge.top); b = Math.min(b, edge.bottom);
          if (s.overflowY === "hidden" || s.overflowY === "clip") {
            box.top = Math.max(box.top, edge.top); box.bottom = Math.min(box.bottom, edge.bottom);
          }
        }
        if (rt <= l || b <= t) return null;
      }
      if (s.position !== "static") escaping = "static";
      if (s.position === "fixed") break;
    }
    return box;
  };
  const onScreen = (el) => vis(el) && !!clipTo(el, el.getBoundingClientRect());
  // .hit (base.css) pads a control's hit area out to --tap with a positioned
  // ::after. That pad is what a finger lands on, so it is what gets measured —
  // but only as far as it survives: ModePill sets overflow:hidden on the pill,
  // which clips the pad straight back off its segments. The pad is read off the
  // pseudo's own box rather than assumed, so nothing here names a size and --tap
  // is free to move.
  const padBox = (el, r) => {
    const s = getComputedStyle(el, "::after");
    if (s.position !== "absolute" || s.content === "none") return null;
    const cs = getComputedStyle(el);
    const x = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(s.left);
    const y = r.top + parseFloat(cs.borderTopWidth) + parseFloat(s.top);
    const w = parseFloat(s.width), h = parseFloat(s.height);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return { left: Math.min(r.left, x), top: Math.min(r.top, y), right: Math.max(r.right, x + w), bottom: Math.max(r.bottom, y + h) };
  };
  const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);
  // Targets on separate layers are never reached by the same tap, so the
  // distance between them is not a clearance. A fixed ancestor is what makes a
  // layer here: the stacked detail screen sits over the list it came from, and
  // every "neighbour" underneath it is unreachable while it is open.
  const layerOf = (el) => {
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      if (getComputedStyle(p).position === "fixed") return p;
    }
    return null;
  };

  // tap targets
  const targets = [];
  for (const el of document.querySelectorAll("button, a, input, select, [role=button]")) {
    if (!vis(el) || el.closest("[data-verify-exempt]")) continue;
    // A wrapping <label> forwards its clicks, so the label is the target.
    const host = (el.matches("input, select, textarea") && el.closest("label")) || el;
    const raw = host.getBoundingClientRect();
    const r = clipTo(host, (host.classList.contains("hit") && padBox(host, raw)) || raw);
    if (!r) continue;
    targets.push({ el, r: { ...r, width: r.right - r.left, height: r.bottom - r.top }, group: el.closest("[role=group]"), layer: layerOf(el) });
  }
  // Edge-to-edge distance to the nearest other target. Two members of one
  // [role=group] are segments of one control. A cross-<nav> pair reflects
  // scroll position, not layout, and so does a pair split across layers.
  const clearance = (a) => {
    let best = Infinity;
    const aNav = !!a.el.closest("nav");
    for (const b of targets) {
      if (b === a || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.group && a.group === b.group) continue;
      if (aNav !== !!b.el.closest("nav")) continue;
      if (a.layer !== b.layer) continue;
      const dx = Math.max(0, a.r.left - b.r.right, b.r.left - a.r.right);
      const dy = Math.max(0, a.r.top - b.r.bottom, b.r.top - a.r.bottom);
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  };
  for (const t of targets) {
    const min = Math.min(t.r.width, t.r.height);
    if (min >= TAP_PRIMARY) continue;
    const gap = clearance(t);
    out.taps.push({
      min: Math.round(min),
      gap: Number.isFinite(gap) ? Math.round(gap * 10) / 10 : null,
      secondary: min >= TAP_SECONDARY && !(gap < TAP_GAP),
      label: label(t.el),
    });
  }

  if (document.documentElement.scrollWidth > innerWidth + 1) {
    out.overflow = document.documentElement.scrollWidth - innerWidth;
  }

  // contrast: text-bearing elements vs first opaque ancestor background
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // A computed color is whatever the browser chose to serialize: color-mix() in
  // a stylesheet comes back as color(srgb …), and a regex over rgb() reads those
  // as no color at all — which silently exempted every rule using one. Painting
  // a pixel makes the browser do the conversion instead. The sentinel catches an
  // unparseable value, which leaves the previous fillStyle in place.
  const ink = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const colors = new Map();
  const parse = (s) => {
    if (!s) return null;
    if (colors.has(s)) return colors.get(s);
    let v = null;
    ink.fillStyle = "#010203";
    ink.fillStyle = s;
    if (ink.fillStyle !== "#010203" || s.trim() === "#010203") {
      ink.clearRect(0, 0, 1, 1);
      ink.fillRect(0, 0, 1, 1);
      const d = ink.getImageData(0, 0, 1, 1).data;
      v = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    }
    colors.set(s, v);
    return v;
  };
  // The node carrying the background comes back too: opacity between the text
  // and that node dims the text against it, opacity at or above it dims both.
  const bgOf = (el) => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        if (!acc) acc = { ...c };
        else { const a = acc.a; acc.r = acc.r * a + c.r * (1 - a); acc.g = acc.g * a + c.g * (1 - a); acc.b = acc.b * a + c.b * (1 - a); acc.a = a + c.a * (1 - a); }
        if (acc.a >= 0.99) return { ...acc, node };
      }
      node = node.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor);
    return { ...(acc ?? root ?? { r: 11, g: 13, b: 18, a: 1 }), node: document.body };
  };
  const exempt = (el, pseudo) => exemptions.some((e) => e.pseudo === pseudo && el.matches(e.sel));
  const seen = new Set();
  const measure = (el, pseudo, text) => {
    const s = getComputedStyle(el, pseudo);
    const raw = parse(s.color); if (!raw) return;
    const bg = bgOf(el);
    // A dimmed row is dimmer to read, not just to look at: the ink is composited
    // over its background at the product of every opacity between the two, and
    // its own alpha. Scoring the token colour reports a contrast nobody gets.
    let a = raw.a;
    for (let n = el; n && n !== bg.node && n !== document.documentElement; n = n.parentElement) a *= parseFloat(getComputedStyle(n).opacity);
    const fg = { r: raw.r * a + bg.r * (1 - a), g: raw.g * a + bg.g * (1 - a), b: raw.b * a + bg.b * (1 - a) };
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const floor = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (ratio >= floor) return;
    const key = s.color + "|" + Math.round(ratio * 10) + "|" + text.slice(0, 20);
    if (seen.has(key)) return;
    seen.add(key);
    out.contrast.push({ ratio: Math.round(ratio * 100) / 100, floor, px, text: (pseudo ?? "") + text.slice(0, 40) });
  };
  for (const el of document.querySelectorAll("body *")) {
    if (!onScreen(el) || el.closest("[data-verify-exempt]")) continue;
    // Ink an assistive reader is told to ignore is decoration by the markup's
    // own account. This is what the one-glyph entries in CONTRAST_EXEMPTIONS
    // were doing by hand, selector by selector.
    if (el.closest("[aria-hidden=true]")) continue;
    if (el.hasAttribute("data-contrast-exempt") && !exempt(el, null)) out.unjustifiedExempt++;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (text && !exempt(el, null)) measure(el, null, text);
    // Pseudo-element and placeholder ink is invisible to the childNodes walk.
    for (const pseudo of ["::before", "::after"]) {
      const raw = getComputedStyle(el, pseudo).content;
      if (!raw || raw === "none" || raw === "normal" || raw.includes("url(")) continue;
      const glyph = raw.replace(/^"|"$/g, "").trim();
      if (!glyph || exempt(el, pseudo)) continue;
      measure(el, pseudo, glyph);
    }
    if (el.placeholder && !exempt(el, "::placeholder")) measure(el, "::placeholder", el.placeholder);
  }

  // density: fully-visible collapsed rows, per the screen's own row selector.
  // rowsMatched counts every laid-out row anywhere in the document — a row
  // scrolled out of its list is still a row, and the denominator is what tells a
  // screen whose selector matches nothing from one whose rows are simply taller
  // than the viewport. The numerator is what a reader can actually see, so it
  // wants the clipping test as well as the viewport box.
  if (rowSel) {
    for (const el of document.querySelectorAll(rowSel)) {
      if (!vis(el)) continue;
      if (el.parentElement?.closest(rowSel)) continue; // never count a nested row twice
      out.rowsMatched++;
      const r = el.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= innerHeight && clipTo(el, r)) out.rows++;
    }
    // "legitimately empty" means the list itself is empty — not the detail pane,
    // which shows its own empty state beside a full list on desktop.
    const list = document.querySelector(".rows");
    out.empty = !!(list ? list.querySelector(".emptystate") : document.querySelector(".emptystate"));
  }
  return out;
})`;

// ── run ────────────────────────────────────────────────────────────
const browser = await launch();
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

const EXEMPT_ARG = CONTRAST_EXEMPTIONS.map(([spec]) => {
  const [sel, pseudo] = spec.split("::");
  return { sel, pseudo: pseudo ? `::${pseudo}` : null };
});
const AUDIT_ARGS = (screen) => [screen.rows ?? null, EXEMPT_ARG, TAP_PRIMARY, TAP_SECONDARY, TAP_GAP]
  .map((a) => JSON.stringify(a)).join(", ");

let failures = 0, warnings = 0, blind = 0;
for (const vp of ALL_VIEWPORTS) {
  const mobile = TOUCH.has(vp.name);
  const errors = [];
  // Every page this check opens goes through the shared harness, which waits
  // for the app to mount and for document.fonts.ready. Web fonts change text
  // metrics, so a box read before they land is not the box that ships.
  const open = (url) => openPage(browser, {
    viewport: vp,
    url,
    context: { deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile },
    onPage: (p) => {
      p.on("pageerror", (e) => errors.push(String(e.message)));
      p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
    },
  });

  for (const screen of SCREENS) {
    let page;
    try {
      page = await open(URL + screen.path);
    } catch (e) {
      failures++;
      console.log(`FAIL ${vp.name}/${screen.name} — ${String(e.message).split("\n")[0]}`);
      errors.length = 0;
      continue;
    }
    await page.waitForSelector(screen.waitFor, { timeout: 15000 }).catch(() => errors.push(`${screen.name}: ${screen.waitFor} never appeared`));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/verify/${vp.name}-${screen.name}.png` });

    const audit = await page.evaluate(`${AUDITS}(${AUDIT_ARGS(screen)})`);
    const badTaps = audit.taps.filter((t) => !t.secondary);
    const softTaps = audit.taps.filter((t) => t.secondary);
    const tag = `${vp.name}/${screen.name}`;

    if (errors.length) { failures++; console.log(`FAIL ${tag} — console:\n  ${errors.join("\n  ")}`); errors.length = 0; }
    if (audit.contrast.length) {
      failures++;
      console.log(`FAIL ${tag} — contrast below floor:`);
      for (const c of audit.contrast.slice(0, 6)) console.log(`  ${c.ratio}:1 (needs ${c.floor}) ${c.px}px "${c.text}"`);
    }
    if (audit.overflow) { failures++; console.log(`FAIL ${tag} — document scrolls ${audit.overflow}px horizontally`); }
    if (audit.unjustifiedExempt) {
      warnings += audit.unjustifiedExempt;
      console.log(`WARN ${tag} — ${audit.unjustifiedExempt} data-contrast-exempt elements have no entry in CONTRAST_EXEMPTIONS; measured as normal`);
    }
    if (badTaps.length) {
      failures++;
      const shown = [...new Map(badTaps.map((t) => [`${t.label}|${t.min}`, t])).values()].slice(0, 6);
      console.log(`FAIL ${tag} — ${badTaps.length} targets below the §2 floors:`);
      for (const t of shown) {
        console.log(t.min < TAP_SECONDARY
          ? `  ${t.min}px "${t.label}" — under the ${TAP_SECONDARY}px hard floor`
          : `  ${t.min}px "${t.label}" — under ${TAP_PRIMARY}px and only ${t.gap}px from its neighbour (needs ${TAP_GAP}px to count as secondary)`);
      }
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
    console.log(`ok   ${tag}${density}${softTaps.length ? ` · ${softTaps.length} spaced secondary targets ${TAP_SECONDARY}–${TAP_PRIMARY - 1}px (warn)` : ""}`);
    await page.close();
  }

  // command palette check (desktop)
  if (!mobile) {
    const page = await open(URL + "/");
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
    await page.close();
    // g-sequence navigation
    const gPage = await open(URL + "/#/lorebooks");
    await gPage.keyboard.press("g");
    await gPage.keyboard.press("p");
    await gPage.waitForTimeout(400);
    const gHash = await gPage.evaluate(() => location.hash);
    if (!gHash.includes("presets")) { failures++; console.log(`FAIL ${vp.name} — g p did not navigate (hash=${gHash})`); }
    else console.log(`ok   ${vp.name}/hotkeys — g p navigates to presets`);
    await gPage.close();
  }

  // keyboard walk on desktop audit screen
  if (!mobile && bookId) {
    const page = await open(`${URL}/#/lorebooks/${bookId}`);
    await page.waitForSelector(".row");
    await page.click(".row .row-summary");
    const before = await page.evaluate(() => document.activeElement?.getAttribute("data-row"));
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    const after = await page.evaluate(() => document.activeElement?.getAttribute("data-row"));
    if (!after || after === before) { failures++; console.log(`FAIL ${vp.name} — j/k list navigation did not move focus`); }
    else console.log(`ok   ${vp.name}/keyboard — j/k moves row focus`);
    await page.close();
  }
}

await browser.close();
console.log(`\n${failures ? `${failures} FAILURES` : "all checks pass"}${warnings ? ` · ${warnings} warnings` : ""}${blind ? ` · ${blind} density selectors matched nothing (WARN — density unmeasured there)` : ""}`);
process.exit(failures ? 1 : 0);
