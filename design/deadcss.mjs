#!/usr/bin/env node
// Report CSS classes no .tsx/.ts file appears to use.
//
//   node design/deadcss.mjs
//
// This is a CANDIDATE list, not a delete list. Read every hit before removing
// anything. Class names reach the DOM three ways here and all three have to be
// modelled:
//
//   1. literal            class="chip"
//   2. composed prefix    class={`type-${n.type}`}      — DOMAINS below
//   3. a bare string      cls="z-ev"  ·  x ? "is-over" : "is-near"
//
// Case 3 is why the scan harvests every plausible class-shaped string literal
// in the source, not only class attributes. That over-reports live classes,
// which is the safe direction to be wrong in: a false "live" costs a dead rule
// nobody deletes, a false "dead" costs a bug.
import fs from "node:fs";
import path from "node:path";

// Every stylesheet under src/, found rather than listed. §8 gives each
// component its own sheet, so any hardcoded list goes stale the moment a
// component is added and silently stops scanning where the dead rules are.

// Composed prefixes and their value domains, read off the types in source.
// Add an entry here whenever a new `prefix-${...}` appears in the JSX.
const DOMAINS = {
  "type-": ["character", "relationship", "timeline_event", "thread", "world", "tone", "scene", "source"],
  "dec-": ["keep", "drop", "undecided"],
  "ln-": ["add", "del", "ctx"],
  "st-": ["active", "resolved", "archived"],
  // SavePill (dirty/saved/err) plus the group-run boundaries the presets audit
  // composes as `is-${run}` — see groupRunBoundaries in src/tools/presets/data.ts.
  "is-": ["dirty", "saved", "err", "start", "mid", "end", "solo"],
  "kw-": ["add", "del"],
  "es-": ["ok", "danger"],          // EmptyState tone
};

const src = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) src.push(fs.readFileSync(p, "utf8"));
  }
})("src");
const code = src.join("\n");

const live = new Set();
const add = (s) => {
  for (const tok of s.replace(/["'`]/g, " ").split(/[\s${}?:()|&]+/))
    if (/^[a-zA-Z][\w-]*$/.test(tok)) live.add(tok);
};
for (const m of code.matchAll(/class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\})/g)) add(m[1] ?? m[2]);
for (const m of code.matchAll(/\bcls=(?:"([^"]*)"|\{`([^`]*)`\})/g)) add(m[1] ?? m[2]);
for (const m of code.matchAll(/"([a-z][\w-]*(?: [\w-]+)*)"/g)) add(m[1]);   // case 3
// Every template literal, not only the ones sitting in a class= attribute.
// Sheet/Modal hand their class down as `surface={`sheet ${...}`}`, and the
// tone icon in EmptyState nests a template inside its class template, which
// the attribute patterns above cannot see past. Over-reporting live is the
// safe direction to be wrong in (see the header).
for (const m of code.matchAll(/`([^`]*)`/g)) add(m[1]);
// And the literal head of any template, matched without needing to find its
// closing backtick — nesting one template inside another desynchronises the
// pairing above for everything after it in the file.
for (const m of code.matchAll(/`([^`$]+)\$\{/g)) add(m[1]);
for (const m of code.matchAll(/([a-z][\w-]*-)\$\{/g))
  for (const v of DOMAINS[m[1]] ?? []) live.add(m[1] + v);

const SHEETS = [];
(function sheets(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sheets(p);
    else if (e.name.endsWith(".css")) SHEETS.push(p);
  }
})("src");

let total = 0;
for (const f of SHEETS) {
  const css = fs.readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*@(?:import|charset|use)[^;]*;/gm, "");   // URLs are not selectors
  const names = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(m[1]);
  const dead = [...names].filter((n) => !live.has(n)).sort();
  total += dead.length;
  if (names.size) console.log(`${f}: ${names.size} classes, ${dead.length} unused`);
  if (dead.length) console.log("   " + dead.join(" "));
}
console.log(total === 0 ? "\nno candidates" : `\n${total} candidates — verify each before deleting`);
