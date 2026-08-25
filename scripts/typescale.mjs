#!/usr/bin/env node
// Type scale: every `font-size` in the app should name a step, not a number.
//
//   node scripts/typescale.mjs                  # whole tree
//   node scripts/typescale.mjs src/tools/memory
//   node scripts/typescale.mjs --adopt          # record today's set as the baseline
//   node scripts/typescale.mjs --prune          # drop baseline entries that no longer appear
//
// ── Why this exists ───────────────────────────────────────────────────────
// DESIGN.md §1 gives eight sizes as tokens and says the type utilities set the
// FACE only, with the size belonging to the component rule. The rule is
// followed in the sense that components set their own size, and broken in the
// sense that most of them set a number rather than a token. At the time this
// was written the tree declared 123 literal sizes against 48 token ones, and
// rendered FOURTEEN distinct sizes against a scale of eight — with 13px, the
// single most common size in the codebase, appearing nowhere in tokens.css.
//
// A scale nobody can name is not a scale, and the drift is invisible in review:
// each individual `font-size: 13px` looks like a considered choice, and only
// counting them across the tree shows that nobody chose it.
//
// ── What counts as a finding ──────────────────────────────────────────────
// Any `font-size` whose value is not `var(--fs-…)`. That includes a literal
// that happens to sit exactly on a step: `font-size: 10.5px` renders correctly
// today and still leaves the rule unable to move when the scale does, which is
// what a token buys. Findings say whether the value is on the scale, because
// the two are different repairs — an on-scale literal is a rename, an off-scale
// one is a decision about which step it should have been.
//
// `clamp()`, `calc()` and keyword sizes (`inherit`, `smaller`) are findings
// too: each one is a size the scale cannot name. `font` shorthand is not read;
// this tree does not use it, and reading it properly means a real parser.
//
// ── Where the scale comes from ────────────────────────────────────────────
// Parsed from src/styles/tokens.css, never duplicated here. A check that
// hardcodes the thing it is checking drifts from it in exactly the way it
// exists to prevent — the same reason copycheck reads the catalog and the
// ontology lint reads the glossary rather than restating them.
//
// ── The baseline ratchet (design/typescale-baseline.json) ─────────────────
// 123 findings is not a list anyone will burn down in one change, and failing
// on all of them trains people to pass a flag. Today's set is recorded; only
// growth fails. See scripts/lib/baseline.mjs.
//
// Exit codes: 0 clean · 1 a finding outside the baseline · 2 the check itself
// is compromised and must never read as a pass.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { ratchet, reportRatchet } from "./lib/baseline.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "design", "typescale-baseline.json");
const TOKENS = join(ROOT, "src", "styles", "tokens.css");

const args = process.argv.slice(2);
const adopt = args.includes("--adopt");
const prune = args.includes("--prune");
const targets = args.filter((a) => !a.startsWith("--"));

/** The scale, read from the tokens file rather than restated here. */
function loadScale() {
  let css;
  try {
    css = readFileSync(TOKENS, "utf8");
  } catch (e) {
    return { steps: new Map(), integrity: [`${relative(ROOT, TOKENS)} is unreadable: ${e.message}`] };
  }
  // value -> every token that carries it. Several roles legitimately share a
  // size (--fs-data-l and --fs-prose are both 14px) and the density block
  // redefines some, so a plain Map would silently report only the last one and
  // send the reader to the wrong role.
  const steps = new Map();
  for (const m of css.matchAll(/(--fs-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const value = m[2].trim();
    if (!steps.has(value)) steps.set(value, new Set());
    steps.get(value).add(m[1]);
  }
  // A scale with no steps means the token file moved or its naming changed, and
  // every font-size in the tree would suddenly read as off-scale. That is a
  // broken check reporting a catastrophe, not a catastrophe.
  const integrity = steps.size
    ? []
    : [`${relative(ROOT, TOKENS)} declares no --fs-* tokens; the scale could not be read`];
  return { steps, integrity };
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "fixtures"]);

function cssFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) cssFiles(p, out);
    else if (extname(p) === ".css") out.push(p);
  }
  return out;
}

/** Selector for the rule a declaration sits in — the stable half of an entry.
 *  Line numbers are deliberately not part of the key: they churn on every edit
 *  above them and would make the baseline unmergeable. */
function scan(file) {
  const css = readFileSync(file, "utf8");
  const findings = [];
  // A stack, not a single selector: a rule inside `@media` has its own
  // selector, and reading only the outermost prelude filed every nested
  // declaration under the at-rule. Joining the stack also keeps the key unique
  // when the same selector is restated at a breakpoint with a different size.
  const stack = [];
  let buf = "";
  const selectorNow = () => stack.join(" ") || "(top level)";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(buf.replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " "));
      buf = "";
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else {
      buf += ch;
      // a declaration ends at ; — check it before the buffer is reset
      if (ch === ";") {
        const m = buf.match(/(^|[\s{;])font-size\s*:\s*([^;]+);\s*$/);
        if (m) findings.push({ selector: selectorNow(), value: m[2].trim().replace(/\s+/g, " ") });
        buf = "";
      }
    }
  }
  return findings;
}

const { steps, integrity: scaleIntegrity } = loadScale();
const roots = targets.length ? targets.map((t) => join(ROOT, t)) : [join(ROOT, "src")];
const files = roots.flatMap((r) => (statSync(r).isDirectory() ? cssFiles(r) : [r]));

const findings = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  for (const { selector, value } of scan(file)) {
    if (/^var\(\s*--fs-/.test(value)) continue;
    const onScale = steps.has(value);
    findings.push({
      file: rel,
      item: `${selector} → ${value}`,
      detail: `${selector} → ${value}${onScale ? `   (on the scale — use ${[...steps.get(value)].sort().join(" or ")})` : "   OFF THE SCALE"}`,
    });
  }
}

console.log(`typescale · ${files.length} stylesheet(s) · scale: ${[...steps.keys()].join(" ") || "(none)"}`);
const off = findings.filter((f) => !steps.has(f.item.split("→").pop().trim()));
console.log(`${findings.length} literal font-size(s), ${off.length} of them off the scale entirely`);

const inScope = new Set(files.map((f) => relative(ROOT, f)));
const r = ratchet(BASELINE, findings, { adopt, prune, scope: (f) => inScope.has(f) });
const code = reportRatchet({
  ...r,
  integrity: [...scaleIntegrity, ...r.integrity],
  label: "design/typescale-baseline.json",
  noun: "literal font-size",
  adopt,
  prune,
});
process.exit(code);
