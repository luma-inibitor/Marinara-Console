#!/usr/bin/env node
// Report CSS classes no .tsx/.ts file appears to use.
//
//   node design/deadcss.mjs
//
// This is a CANDIDATE list, not a delete list. Read every hit before removing
// anything — a first version of this script substring-matched and reported 36
// dead classes, of which 20 were live and 3 (.is-dirty/.is-saved/.is-err)
// would have broken the lorebook save pill. Class names reach the DOM three
// ways here and all three have to be modelled:
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

const SHEETS = ["base", "shell", "lorebooks", "memory"];

// Composed prefixes and their value domains, read off the types in source.
// Add an entry here whenever a new `prefix-${...}` appears in the JSX.
const DOMAINS = {
  "type-": ["character", "relationship", "timeline_event", "thread", "world", "tone", "scene", "source"],
  "dec-": ["keep", "drop", "undecided"],
  "ln-": ["add", "del", "ctx"],
  "st-": ["active", "resolved", "archived"],
  "is-": ["dirty", "saved", "err"],       // SavePill
  "kw-": ["add", "del"],
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
for (const m of code.matchAll(/([a-z][\w-]*-)\$\{/g))
  for (const v of DOMAINS[m[1]] ?? []) live.add(m[1] + v);

let total = 0;
for (const f of SHEETS) {
  const css = fs.readFileSync(`src/styles/${f}.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const names = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(m[1]);
  const dead = [...names].filter((n) => !live.has(n)).sort();
  total += dead.length;
  console.log(`src/styles/${f}.css: ${names.size} classes, ${dead.length} unused`);
  if (dead.length) console.log("   " + dead.join(" "));
}
console.log(total === 0 ? "\nno candidates" : `\n${total} candidates — verify each before deleting`);
