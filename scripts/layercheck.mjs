#!/usr/bin/env node
// Layer check: imports point downward only. A file's layer comes from the
// directory it sits in, and a value import may only reach a layer at or below
// its own — presentation → state → endpoints → transport, with model a side
// branch that presentation and state may both reach. ARCHITECTURE.md §1 is the
// rule; this is the enforcement of it.
//
//   node scripts/layercheck.mjs                 # whole tree
//   node scripts/layercheck.mjs src/tools/memory
//
// ── What a violation costs ────────────────────────────────────────────────
// `model` importing `state` risks a cycle, and has already happened here once.
// A value import is a real edge in the module graph at runtime; that is the
// thing that cycles, so that is the thing this checks.
//
// ── Type-only imports point anywhere ──────────────────────────────────────
// `import type {…}` and an inline `import { type X }` erase at compile time.
// They create no runtime edge and therefore no cycle, and the layout depends on
// it: the wire types live in `api/` because they are the endpoints layer's own
// vocabulary, and the model has to name those shapes to transform them. So the
// decision is per SPECIFIER, never per statement — `import { flatten, type Row }`
// is a value edge for `flatten` and nothing at all for `Row`. `export … from`
// is checked the same way: a re-export is a runtime edge unless it is a type
// re-export.
//
// ── Where a layer comes from ──────────────────────────────────────────────
// The directory, per §2. A `.tsx` is presentation wherever it sits, which is a
// fact about the file (it contains JSX) rather than an absence of one — that is
// the objection §2 raises to a suffix scheme, and it does not apply here.
// `lib/`, `copy/`, `test/` and anything vendored are importable from anywhere:
// primitives, the catalog, and fixtures carry no domain and no direction.
//
// A `.ts` in a directory that names no layer is UNCLASSIFIED. It is neither
// checked as a source nor restricted as a target, and it is listed by name in
// the summary. §2 argues that the worst thing a layer scheme can do is claim a
// file nobody classified, so an unclassified file is reported loudly rather
// than defaulted quietly. Every one of them today is a pre-§2 module still to
// be moved into its layer directory; each is a hole in this check until it is.
//
// ── Tests are checked, on the same terms as anything else ─────────────────
// A test sits inside the layer of the module it covers, so its imports are that
// layer's imports: a model test that needs a store value is telling you the
// model wants the store, which is the finding. Nothing has to be special-cased
// for factories, because `test/` is exempt as a target like `lib/` — the
// shared-fixture directory declares no layer in §2's table and holds no domain
// direction.
//
// ── The second check: who may own a fetch ─────────────────────────────────
// Presentation reaching `api/` directly is DOWNWARD, so the direction rule
// above passes it — and §1 still calls it wrong, for a different reason: the
// screen bypassed the data layer instead of calling a hook (§3, "No component
// calls fetch"). That is a rule about ownership rather than direction, so it
// runs as a separate check below with its own heading, and its findings are
// never mixed into the upward-import list.
//
// It is reported but does not fail by default. Three screens do this today
// (§1 says so), and they are a refactor rather than a lint fix; a check that
// fails on every run from the day it lands gets muted, and then it is not a
// check. `--strict` makes it fail, and is what the rule should run as once the
// screens are moved onto hooks. The non-failing default is a temporary
// baseline, not the intended end state.
//
// Exit codes: 0 clean · 1 one or more upward value imports (or, with --strict,
// one or more ownership violations).

import { join } from "node:path";
import { ROOT, rel, listSources, parseModule, valueSpecifiers } from "./lib/imports.mjs";

// ── layers ────────────────────────────────────────────────────────────────
// Rank is the only thing compared: an import is legal when it lands at a rank
// at or below its own. Equal ranks are fine — one component may import another.
const RANK = { transport: 0, endpoints: 1, model: 2, state: 3, presentation: 4 };
const DIR_LAYER = {
  api: "endpoints",
  model: "model",
  store: "state",
  components: "presentation",
  screens: "presentation",
};
// Importable from anywhere, and never checked as a source. Primitives with no
// domain knowledge, the copy catalog, shared fixtures, vendored engine code.
const EXEMPT_DIRS = new Set(["lib", "copy", "test", "vendor"]);

/** "src/tools/memory/model/flags.ts" -> "model" | "unclassified" | null(exempt) */
function layerOf(rel) {
  const parts = rel.split("/");
  const file = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);

  // src/lib, src/copy, any test/ or vendor/ segment anywhere.
  if (dirs.some((d) => EXEMPT_DIRS.has(d))) return null;

  for (const d of dirs) if (DIR_LAYER[d]) return DIR_LAYER[d];

  // src/ui is shared presentation whatever the extension: index.ts and the
  // hooks beside it are that layer's own plumbing.
  if (dirs[1] === "ui") return "presentation";

  // A file that returns markup is presentation wherever it sits — including the
  // app frame, whose Toaster and Palette are screens like any other. The rest of
  // src/shell is the transport it wraps.
  if (file.endsWith(".tsx")) return "presentation";
  if (dirs[1] === "shell") return "transport";

  return "unclassified";
}

// ── edges ─────────────────────────────────────────────────────────────────
// The shared parse gives per-specifier kinds; the direction rule only cares
// about the specifiers that survive to runtime.
function valueEdges(mod) {
  const edges = [];
  for (const e of mod.imports) {
    const names = valueSpecifiers(e).map((s) =>
      s.star ? `* as ${s.local}` : s.imported
    );
    // A side-effect import (`import "./x"`) names nothing and is still an edge
    // — the module runs. An import whose every specifier was type-only is not.
    if (!names.length && !e.bare) continue;
    edges.push({ line: e.line, spec: e.spec, resolved: e.resolved, names, kind: e.kind });
  }
  return edges;
}

// ── ownership (the second check) ───────────────────────────────────────────
// A different question from direction: not "may this file reach that layer?"
// but "is this file allowed to own a fetch at all?" §3: no component calls
// `fetch`; a screen gets data by calling a hook.
const OWNERSHIP_STRICT = process.argv.includes("--strict");

// The same notion of presentation the direction check uses, so one file cannot
// be presentation to one rule and something else to the other.
function isPresentation(from) {
  const parts = from.split("/");
  if (parts[parts.length - 1].endsWith(".tsx")) return true;
  return parts.slice(0, -1).some((d) => d === "components" || d === "screens");
}

// An `api/` DIRECTORY, per §2 — not a file that happens to be named api.ts.
// The resolved path is the fact; the specifier is the fallback for a target
// this tree does not contain.
function isEndpointsModule(edge) {
  if (edge.resolved) return rel(edge.resolved).split("/").slice(0, -1).includes("api");
  return /(^|\/)api\//.test(edge.spec);
}

const TRANSPORT_DIR = "src/shell/";
const TRANSPORT_CLIENT = "src/shell/api.ts";

// `api()` is a request, so importing it into a component is the same defect as
// calling `fetch` there. The rest of that module is not: `ApiError` is a shape
// an error boundary has to name, and `tokensOf` is a pure estimate. Naming the
// binding rather than the module is what keeps this from firing on all of them.
// The app frame is exempt — src/shell is the transport, `.tsx` and all.
const TRANSPORT_REQUEST = new Set(["api", "default"]);

function isTransportClient(edge, from) {
  if (from.startsWith(TRANSPORT_DIR)) return false;
  if (!edge.resolved || rel(edge.resolved) !== TRANSPORT_CLIENT) return false;
  return edge.names.some((n) => TRANSPORT_REQUEST.has(n) || n.startsWith("* as "));
}

// `fetch` as a free identifier. `opts.refetch()` and `client.fetch` are not it:
// a member name is a property, not the global.
function fetchSites(mod) {
  const lines = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) { for (const c of n) walk(c); return; }
    if (!n || typeof n !== "object" || typeof n.type !== "string") return;
    if (n.type === "Identifier" && n.name === "fetch" && n.loc) lines.add(n.loc.start.line);
    for (const k of Object.keys(n)) {
      if (k === "loc" || k.endsWith("Comments")) continue;
      if (!n.computed && (k === "property" || k === "key")) continue;
      walk(n[k]);
    }
  };
  walk(mod.ast.program.body);
  return [...lines].sort((a, b) => a - b);
}

// ── main ──────────────────────────────────────────────────────────────────
const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const roots = paths.length ? paths.map((p) => join(ROOT, p)) : [join(ROOT, "src")];
const files = listSources(roots);

const perDir = new Map();
const violations = [];
const ownership = [];
const unclassified = [];
const parseErrors = [];
let checked = 0;

for (const abs of files) {
  const from = rel(abs);
  const layer = layerOf(from);
  const dir = from.split("/").slice(0, -1).join("/");

  const agg = perDir.get(dir) || { dir, layer: layer ?? "exempt", files: 0, edges: 0, bad: 0 };
  agg.files++;
  if (agg.layer !== (layer ?? "exempt")) agg.layer = "mixed";
  perDir.set(dir, agg);

  if (layer === "unclassified") unclassified.push(from);

  const mod = parseModule(abs);
  if (mod.parseError) { parseErrors.push(`${from}: ${mod.parseError}`); continue; }
  const edges = valueEdges(mod);

  // Ownership runs on every file whatever its layer: an unclassified module
  // still may not own a fetch, and that is exactly where some of them are.
  if (isPresentation(from)) {
    for (const e of edges) {
      const rule =
        isEndpointsModule(e) ? "endpoints"
        : isTransportClient(e, from) ? "transport"
        : null;
      if (!rule) continue;
      ownership.push({
        file: from, line: e.line, rule,
        text: `${e.kind} { ${e.names.join(", ")} } from "${e.spec}"`,
      });
    }
  }
  if (!from.startsWith(TRANSPORT_DIR)) {
    for (const line of fetchSites(mod)) {
      ownership.push({ file: from, line, rule: "fetch", text: "calls the global fetch()" });
    }
  }

  if (layer === null || layer === "unclassified") continue;

  for (const e of edges) {
    if (!e.resolved) continue;
    const tLayer = layerOf(rel(e.resolved));
    if (tLayer === null || tLayer === "unclassified") continue;
    checked++;
    agg.edges++;
    if (RANK[tLayer] <= RANK[layer]) continue;
    agg.bad++;
    violations.push({
      file: from,
      line: e.line,
      from: layer,
      to: tLayer,
      text: `${e.kind} { ${e.names.join(", ")} } from "${e.spec}"`,
    });
  }
}

console.log(`layercheck · ${files.length} files · ${checked} value imports resolved to a layer\n`);
console.log("per directory:");
for (const d of [...perDir.values()].sort((a, b) => a.dir.localeCompare(b.dir))) {
  console.log(
    `  ${d.dir.padEnd(28)} ${String(d.files).padStart(3)} files  ${String(d.edges).padStart(3)} value imports  ` +
    `[${d.layer}]${d.bad ? `  ${d.bad} UPWARD` : ""}`
  );
}

if (unclassified.length) {
  console.log(`\nUNCLASSIFIED — no layer directory, so neither checked nor restricted (§2):`);
  for (const f of unclassified) console.log("  " + f);
}

if (parseErrors.length) {
  console.log("\nPARSE FAILURES — these files were not checked:");
  for (const m of parseErrors) console.log("  " + m);
}

// ── rule 1 · direction ────────────────────────────────────────────────────
console.log("\n──── RULE 1 · imports point downward (§1) ────");
if (violations.length) {
  console.log("\nUPWARD VALUE IMPORTS:");
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.from} → ${v.to}   ${v.text}`);
  }
}
console.log(
  violations.length
    ? `\n${violations.length} upward value import(s) — every import points downward or not at all`
    : "\nevery value import points downward"
);

// ── rule 2 · ownership ────────────────────────────────────────────────────
const RULE_TEXT = {
  endpoints: "presentation reaches api/ directly — a screen gets data from a hook",
  transport: "presentation reaches the transport client — api() is a fetch by another name",
  fetch: "the global fetch() outside the transport layer (src/shell/)",
};
console.log("\n──── RULE 2 · no component owns a fetch (§3) ────");
if (ownership.length) {
  for (const rule of ["endpoints", "transport", "fetch"]) {
    const hits = ownership
      .filter((o) => o.rule === rule)
      .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    if (!hits.length) continue;
    console.log(`\n  ${RULE_TEXT[rule]}:`);
    let last = null;
    for (const o of hits) {
      if (o.file !== last) { console.log(`    ${o.file}`); last = o.file; }
      console.log(`      :${String(o.line).padStart(4)}  ${o.text}`);
    }
  }
  const inFiles = new Set(ownership.map((o) => o.file)).size;
  console.log(
    `\n${ownership.length} ownership violation(s) across ${inFiles} file(s)` +
    (OWNERSHIP_STRICT ? " — FAILING under --strict" : " — reported only; --strict makes this fail")
  );
} else {
  console.log("\nno component owns a fetch");
}

process.exit(violations.length || (OWNERSHIP_STRICT && ownership.length) ? 1 : 0);
