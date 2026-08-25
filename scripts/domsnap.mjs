#!/usr/bin/env node
// Snapshot the rendered DOM as a class-and-tag skeleton, so a refactor that
// claims "renders identically" can be checked instead of asserted.
//
//   node scripts/domsnap.mjs before        # capture
//   node scripts/domsnap.mjs after --diff  # capture and compare
//
// Deliberately ignores text content and attribute values: this answers "did
// the element tree and its styling hooks change", which is the question a
// component extraction actually raises.
//
// Every run ends with what it did NOT reach, so "DOM unchanged" is a statement
// about the captured list only. A surface that fails to open exits 1.
//
// Do not run this while something else is driving the same dev server; a page
// that keeps repainting never settles.
import { launch, openSurface, renderedComponents, VIEWPORTS } from "./lib/browser.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const tag = process.argv[2] ?? "snap";
const diff = process.argv.includes("--diff");
// Snapshots are keyed by tag alone, so two worktrees running at once overwrite
// each other's baseline. Point MC_SNAP_DIR somewhere private to avoid that.
const SNAP_DIR = process.env.MC_SNAP_DIR ?? "/tmp";
// The book audit needs a real book id — it is the densest screen in the
// console and the one most likely to break silently.
const BOOK = process.env.MC_BOOK ?? "JZzGg_2NjFx1hFP_G4Yeq";
// The detail card is a route of its own, so it is invisible to a vault-only
// snapshot — and it is the screen a component extraction is most likely to
// disturb, since every duplicated field rendering has a copy here.
const NOTE = process.env.MC_NOTE ?? "source_lorebook_d81a750ad0c1a6d7";

const D = VIEWPORTS.desktop, P = VIEWPORTS.phone;
const BOTH = [P, D];

/** The sources rail lands on "Ready to import", which omits current and missing sources. */
const railAll = (p) => p.getByRole("button", { name: /^All/ }).click();

// A surface is a route plus, where the route is not enough, the interaction
// that opens it. `vps` is the viewports the surface is captured at.
const SURFACES = [
  { name: "sources", hash: "#/memory/sources", vps: BOTH },
  { name: "sources-list", hash: "#/memory/sources", vps: [D], sel: ".srow",
    open: (p) => railAll(p) },
  { name: "sources-produced", hash: "#/memory/sources", vps: [D], sel: ".xbody",
    open: async (p) => { await railAll(p); await p.locator(".xchev").first().click(); } },
  { name: "review", hash: "#/memory/review", vps: BOTH },
  { name: "review-claim", hash: "#/memory/review", vps: [D], sel: ".claim-detail",
    open: (p) => p.locator(".mem-mid").first().click() },
  { name: "review-facets", hash: "#/memory/review", vps: [P], sel: ".sheet",
    open: (p) => p.getByRole("button", { name: /^Filter/ }).click() },
  { name: "review-group", hash: "#/memory/review", vps: [P], sel: ".sheet.option-sheet",
    open: (p) => p.getByRole("button", { name: /^Group/ }).click() },
  { name: "vault", hash: "#/memory/vault", vps: BOTH },
  { name: "detail", hash: `#/memory/vault/${NOTE}`, vps: BOTH },
  { name: "vault-editor", hash: `#/memory/vault/${NOTE}`, vps: [D], sel: ".edit-area",
    open: (p) => p.locator(".mdc-edit").click() },
  { name: "note-peek", hash: "#/memory/vault", vps: [D], sel: ".sheet",
    open: async (p) => {
      await p.locator(".row-summary").first().click();
      // .notelink exists only inside a record, so waiting for it to be
      // clickable is waiting for the record to have arrived.
      await p.locator(".notelink").first().click();
    } },
  { name: "lore", hash: "#/lorebooks", vps: BOTH },
  { name: "book", hash: `#/lorebooks/${BOOK}`, vps: BOTH },
  { name: "book-entry", hash: `#/lorebooks/${BOOK}`, vps: [D], sel: ".drawer",
    open: (p) => p.locator(".row-summary").first().click() },
  { name: "book-fulltext", hash: `#/lorebooks/${BOOK}`, vps: [D], sel: ".fseditor",
    open: async (p) => {
      await p.locator(".row-summary").first().click();
      await p.locator(".drawer .sub").nth(1).locator(".sub-head").click();
      await p.locator(".drawer .fieldbar button").first().click();
    } },
  { name: "book-nomatch", hash: `#/lorebooks/${BOOK}`, vps: [D], sel: ".emptystate",
    open: (p) => p.locator(".pwrap input").fill("zzzznothingmatchesthis") },
  { name: "book-tags", hash: `#/lorebooks/${BOOK}`, vps: [P], sel: ".tagpanel",
    open: (p) => p.getByRole("button", { name: /Tags/ }).click() },
  { name: "presets", hash: "#/presets", vps: BOTH },
  { name: "preset-editor", hash: "#/presets", vps: [D], sel: ".tagline",
    open: (p) => p.locator(".preset-card").first().click() },
  // The shell overlays are global. Opening them over the cheapest screen keeps
  // a change behind them out of this diff.
  { name: "palette", hash: "#/lorebooks", vps: [D], sel: ".palette",
    open: (p) => p.keyboard.press("Meta+k") },
  { name: "cheatsheet", hash: "#/lorebooks", vps: [D], sel: ".cheat",
    open: async (p) => { await p.locator(".rail-brand").click(); await p.keyboard.press("?"); } },
  { name: "notfound", hash: "#/lorebooks/no-such-book", vps: [D] },
];

// Printed by reportGaps: surfaces a read-only engine cannot be driven to.
const UNREACHABLE = [
  ["import confirm, job dock, import report (Sources.tsx)",
   "all three hang off running an import, which writes notes. The confirm sheet also needs more than CONFIRM_THRESHOLD selectable sources; the dev corpus has six ready sources against a threshold of ten."],
  ["curate panel (Sources.tsx)",
   "shown for a source that has NOT been imported. Every source in the dev corpus is imported already."],
  ["change, link and keyword claims (ClaimDetail.tsx: DiffLines, InlineMemory, ClaimTarget, BatchTarget, KeywordEditor, capNote)",
   "every one of the 42 claims in the dev queue is a create_note preview. These zones need a queue holding a section rewrite, a link and a keyword claim."],
  ["obligations, failures (Review.tsx)",
   "blocked drafts and failed extractions. The dev queue has neither."],
  ["apply dock (Review.tsx)",
   "appears once a claim is decided, and every decision is persisted to the engine's console-state ledger."],
  ["archived-note states (Vault.tsx, MemoryDetail)",
   "needs a note with status archived; the corpus has 30 active and 1 resolved."],
  ["error and loading states (ErrorState, Loading, ConnectionBanner)",
   "need the engine to fail or stall. Nothing here injects transport faults."],
  ["toast row (Toaster.tsx)",
   "exists only while a toast is on screen, which races its own dismissal timer."],
  ["section save bar (PresetsTool.tsx)",
   "appears once a preset section holds a staged edit, and staging one means typing into a shared engine's preset."],
  ["group pressure (Review.tsx)",
   "a group whose target is near or over its cap. Nothing in the dev queue is."],
];

// ── capture ───────────────────────────────────────────────────────────────
const skeleton = (page) => page.evaluate(() =>
  [...document.querySelectorAll("#app *")].map((el) => {
    const cls = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).sort().join(".");
    return el.tagName.toLowerCase() + (cls ? "." + cls : "");
  }));

const browser = await launch();
const out = {};
const seenComponents = new Set();
const failed = [];
for (const s of SURFACES) for (const vp of s.vps) {
  const key = `${s.name}/${vp.name}`;
  try {
    const p = await openSurface(browser, { viewport: vp, hash: s.hash, settle: 1400, open: s.open, sel: s.sel });
    out[key] = await skeleton(p);
    for (const n of await renderedComponents(p)) seenComponents.add(n);
    await p.close();
  } catch (e) {
    failed.push(`${key}: ${String(e.message ?? e).split("\n")[0].slice(0, 200)}`);
  }
}
await browser.close();
fs.writeFileSync(`${SNAP_DIR}/domsnap-${tag}.json`, JSON.stringify(out, null, 1));

// ── coverage ──────────────────────────────────────────────────────────────
// A name defined in two files is covered in both: the fiber carries no file.
// The listing goes through a file rather than a pipe because components.mjs
// ends on process.exit(), which drops an unflushed stdout.
const listing = fileURLToPath(new URL("components.mjs", import.meta.url));
const spill = `${SNAP_DIR}/domsnap-${tag}-components.json`;
const fd = fs.openSync(spill, "w");
execFileSync("node", [listing, "--json"], { stdio: ["ignore", fd, "inherit"] });
fs.closeSync(fd);
const inventory = JSON.parse(fs.readFileSync(spill, "utf8"))
  .inventory.filter((c) => c.kind === "component");
const missed = inventory.filter((c) => !seenComponents.has(c.name));
const byFile = new Map();
for (const c of missed) byFile.set(c.file, [...(byFile.get(c.file) ?? []), c.name]);

function reportGaps() {
  if (failed.length) {
    console.log("\nSURFACES NOT REACHED — this run is incomplete, not clean:");
    for (const f of failed) console.log(`  ${f}`);
  }
  console.log(`\ncoverage · ${inventory.length - missed.length} of ${inventory.length} components rendered by the captured surfaces`);
  if (!missed.length) return;
  console.log(`\nNOT COVERED — ${missed.length} components no surface rendered. Nothing above says anything about these:`);
  for (const [file, names] of [...byFile].sort()) console.log(`  ${file}: ${names.join(", ")}`);
  console.log("\nout of reach from a read-only engine:");
  for (const [what, why] of UNREACHABLE) console.log(`  ${what}\n    ${why}`);
}

const captures = Object.keys(out).length;

if (!diff) {
  console.log(`captured ${tag} · ${captures} of ${captures + failed.length} surface/viewport pairs`);
  reportGaps();
  process.exit(failed.length ? 1 : 0);
}

// ── diff ──────────────────────────────────────────────────────────────────
const base = JSON.parse(fs.readFileSync(`${SNAP_DIR}/domsnap-before.json`, "utf8"));
let bad = 0;
const uncompared = [];
for (const key of Object.keys(base)) {
  const a = base[key], b = out[key];
  if (!b) { uncompared.push(key); continue; }
  const count = (list) => list.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
  const ca = count(a), cb = count(b), keys = new Set([...ca.keys(), ...cb.keys()]);
  const rows = [...keys].filter((k) => (ca.get(k) ?? 0) !== (cb.get(k) ?? 0))
    .map((k) => `      ${(ca.get(k) ?? 0)} -> ${(cb.get(k) ?? 0)}  ${k}`);
  if (rows.length) { bad++; console.log(`  ${key}: ${a.length} -> ${b.length} elements`); console.log(rows.join("\n")); }
  else console.log(`  ${key}: identical (${a.length} elements)`);
}
const added = Object.keys(out).filter((k) => !(k in base));
for (const key of added) console.log(`  ${key}: new surface, nothing to compare (${out[key].length} elements)`);
if (uncompared.length) {
  console.log("\nNOT COMPARED — captured before, not this run. Neither changed nor unchanged:");
  for (const key of uncompared) console.log(`  ${key}`);
}
console.log(bad === 0 ? `\nDOM unchanged across ${captures} captured surface/viewport pairs` : `\n${bad} page/viewport pairs differ`);
reportGaps();
process.exit(failed.length ? 1 : 0);
