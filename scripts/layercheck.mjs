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
// ── Deliberately out of scope ─────────────────────────────────────────────
// Presentation reaching `api/` directly is downward, so it passes here, though
// §1 calls it wrong for a different reason: the screen bypassed the data layer
// rather than risking a cycle. That is a rule about who owns a fetch, not about
// direction, and it wants its own check rather than a special case in this one.
//
// Exit codes: 0 clean · 1 one or more upward value imports.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/parser";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// ── resolution ────────────────────────────────────────────────────────────
// Relative specifiers only; a bare specifier is a package and has no layer.
const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolve(fromAbs, spec) {
  if (!spec.startsWith(".")) return null;
  const base = join(dirname(fromAbs), spec);
  for (const e of EXTS) {
    const p = base + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null; // .css, .json, or a path that does not exist
}

// ── parsing ───────────────────────────────────────────────────────────────
// The same babel front end copycheck uses. A regex cannot answer the question
// this check asks — `import { a, type B }` needs per-specifier kinds, and the
// list may wrap across as many lines as it likes.
function valueEdges(absPath) {
  const src = readFileSync(absPath, "utf8");
  let ast;
  try {
    ast = babel.parse(src, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy", "explicitResourceManagement"],
    });
  } catch (e) {
    return { parseError: e.message, edges: [] };
  }

  const edges = [];
  for (const n of ast.program.body) {
    if (n.type === "ImportDeclaration") {
      if (n.importKind === "type") continue; // `import type {…}` — no runtime edge
      const named = [];
      let bare = true;
      for (const s of n.specifiers) {
        bare = false;
        if (s.importKind === "type") continue; // `import { type X }`
        named.push(
          s.type === "ImportDefaultSpecifier" ? "default"
          : s.type === "ImportNamespaceSpecifier" ? `* as ${s.local.name}`
          : s.imported.name ?? s.imported.value
        );
      }
      // A side-effect import (`import "./x"`) has no specifiers and is still an
      // edge — the module runs.
      if (!named.length && !bare) continue;
      edges.push({ line: n.loc.start.line, spec: n.source.value, names: named, kind: "imports" });
      continue;
    }
    // A re-export runs the module it names, exactly like an import.
    if (n.type === "ExportNamedDeclaration" && n.source) {
      if (n.exportKind === "type") continue;
      const named = n.specifiers
        .filter((s) => s.exportKind !== "type")
        .map((s) => s.local?.name ?? s.exported?.name ?? "*");
      if (!named.length) continue;
      edges.push({ line: n.loc.start.line, spec: n.source.value, names: named, kind: "re-exports" });
      continue;
    }
    if (n.type === "ExportAllDeclaration" && n.exportKind !== "type") {
      edges.push({ line: n.loc.start.line, spec: n.source.value, names: ["*"], kind: "re-exports" });
    }
  }
  return { parseError: null, edges };
}

// ── file discovery ────────────────────────────────────────────────────────
function listSources(roots) {
  const out = [];
  const visit = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      if (/(^|\/)(node_modules|dist|\.git|vendor)$/.test(p.split(sep).join("/"))) return;
      for (const f of readdirSync(p).sort()) visit(join(p, f));
      return;
    }
    if (/\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  };
  for (const r of roots) if (existsSync(r)) visit(r);
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────
const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const roots = paths.length ? paths.map((p) => join(ROOT, p)) : [join(ROOT, "src")];
const files = listSources(roots);

const rel = (p) => relative(ROOT, p).split(sep).join("/");
const perDir = new Map();
const violations = [];
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
  if (layer === null || layer === "unclassified") continue;

  const { parseError, edges } = valueEdges(abs);
  if (parseError) { parseErrors.push(`${from}: ${parseError}`); continue; }

  for (const e of edges) {
    const target = resolve(abs, e.spec);
    if (!target) continue;
    const tLayer = layerOf(rel(target));
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

if (violations.length) {
  console.log("\nUPWARD VALUE IMPORTS — imports point downward only (§1):");
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.from} → ${v.to}   ${v.text}`);
  }
}

console.log(
  violations.length
    ? `\n${violations.length} upward value import(s) — every import points downward or not at all`
    : "\nevery value import points downward"
);
process.exit(violations.length ? 1 : 0);
