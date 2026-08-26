#!/usr/bin/env node
// Report CSS classes no .tsx/.ts file appears to use.
//
//   node scripts/deadcss.mjs
//   node scripts/deadcss.mjs scripts/fixtures/deadcss/registered   # one tree
//   node scripts/deadcss.mjs --adopt   # record today's set as the baseline
//   node scripts/deadcss.mjs --prune   # drop baseline entries that no longer appear
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
//
// ── The baseline ratchet (design/deadcss-baseline.json) ───────────────────
// The list is candidates, so failing on all of it would block PRs on somebody
// else's judgement calls. Today's set is recorded and only growth fails, which
// is the question a reviewer has: did this change strand a rule? See
// scripts/lib/baseline.mjs.
//
// Exit codes: 0 clean · 1 a candidate outside the baseline · 2 the check is
// compromised (a class position composes a prefix DOMAINS does not name, or
// the baseline is unreadable).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ratchet, reportRatchet } from "./lib/baseline.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = path.join(ROOT, "design", "deadcss-baseline.json");
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

// A path argument scans that tree instead of src/, ratchet scoped to match.
const [arg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SCAN = path.resolve(ROOT, arg ?? "src");
const scanned = path.relative(ROOT, SCAN).split(path.sep).join("/");
if (!fs.existsSync(SCAN)) {
  console.error(`NOTHING TO CHECK — "${arg}" is not a path in this tree`);
  process.exit(2);
}

// Every stylesheet under src/, found rather than listed. §8 gives each
// component its own sheet, so any hardcoded list goes stale the moment a
// component is added and silently stops scanning where the dead rules are.

// Composed prefixes and their value domains, read off the types in source.
// Add an entry when a new `prefix-${...}` appears in a class position.
const DOMAINS = {
  "type-": ["character", "relationship", "timeline_event", "thread", "world", "tone", "scene", "source"],
  "dec-": ["keep", "drop", "undecided"],
  "ln-": ["add", "del", "ctx"],
  "st-": ["active", "resolved", "archived"],
  // SavePill (dirty/saved/err) plus the group-run boundaries the presets audit
  // composes as `is-${run}` — see groupRunBoundaries in src/tools/presets/data.ts.
  "is-": ["dirty", "saved", "err", "start", "mid", "end", "solo"],
  "es-": ["ok", "danger"],          // EmptyState tone
};

const src = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) src.push(fs.readFileSync(p, "utf8"));
  }
})(SCAN);
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

// ── composed prefixes, and the drift test on DOMAINS ──────────────────────
// A prefix counts only in a class position: `className=`, `cls=`, `surface=`.
// `${}` also builds ids, so a scan of every template would demand table entries
// for `draft-${n}` and friends in test/factories.ts.
//
// Gotcha: braces are counted rather than backticks matched. EmptyState nests
// `es-icon ${tone ? `es-${tone}` : ""}`, and stopping at the first inner
// backtick loses `es-` and strands both rules.
const classExpressions = [];
for (const m of code.matchAll(/\b(?:className|cls|surface)=\{/g)) {
  const start = m.index + m[0].length;
  let i = start, depth = 1;
  while (i < code.length && depth) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") depth--;
    i++;
  }
  classExpressions.push(code.slice(start, i - 1));
}

const prefixes = new Set();
for (const expr of classExpressions)
  for (const m of expr.matchAll(/([a-z][\w-]*-)\$\{/g)) prefixes.add(m[1]);

// An unregistered prefix means the check never scanned that namespace, so it
// exits 2 rather than reporting the rules as unused candidates.
const unregistered = [...prefixes].filter((p) => !(p in DOMAINS)).sort();
if (unregistered.length) {
  console.log("\nUNREGISTERED CLASS PREFIX — the check itself is compromised:");
  for (const p of unregistered) console.log(`  \`${p}\${...}\` is composed in a class position and DOMAINS has no entry`);
  console.log("\nAdd each prefix and its value domain to DOMAINS in scripts/deadcss.mjs.");
  process.exit(2);
}
// One way only: an entry nothing composes is not a finding, because the reader
// cannot see through every construction. Retire unused entries by hand.
for (const p of prefixes) for (const v of DOMAINS[p]) live.add(p + v);

const SHEETS = [];
(function sheets(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sheets(p);
    else if (e.name.endsWith(".css")) SHEETS.push(p);
  }
})(SCAN);

const findings = [];
let total = 0;
for (const abs of SHEETS) {
  const f = path.relative(ROOT, abs).split(path.sep).join("/");
  const css = fs.readFileSync(abs, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*@(?:import|charset|use)[^;]*;/gm, "");   // URLs are not selectors
  const names = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(m[1]);
  const dead = [...names].filter((n) => !live.has(n)).sort();
  total += dead.length;
  for (const n of dead) findings.push({ file: f, item: n });
  if (names.size) console.log(`${f}: ${names.size} classes, ${dead.length} unused`);
  if (dead.length) console.log("   " + dead.join(" "));
}
console.log(total === 0 ? "\nno candidates" : `\n${total} candidates — verify each before deleting`);

const adopt = flags.has("--adopt");
const prune = flags.has("--prune");
process.exit(
  reportRatchet({
    ...ratchet(BASELINE_PATH, findings, { adopt, prune, root: ROOT, scope: (f) => f.startsWith(scanned + "/") }),
    label: "design/deadcss-baseline.json",
    noun: "dead class",
    adopt,
    prune,
  }),
);
