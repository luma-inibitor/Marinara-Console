#!/usr/bin/env node
// Layer check: value imports point downward only (ARCHITECTURE.md §1), and no
// component owns a fetch (§3).
//
//   node scripts/layercheck.mjs                 # whole tree
//   node scripts/layercheck.mjs src/tools/memory
//
// Exit codes: 0 clean · 1 one or more violations of either rule · 2 nothing to check.

import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as ts from "typescript/unstable/ast";
import { API, SymbolFlags } from "typescript/unstable/sync";
import { ROOT, rel, sourceFiles } from "./lib/imports.mjs";

// ── layers ────────────────────────────────────────────────────────────────
const REACHES = {
  transport: new Set(["transport"]),
  endpoints: new Set(["endpoints", "transport"]),
  model: new Set(["model"]),
  state: new Set(["state", "model", "endpoints", "transport"]),
  presentation: new Set(["presentation", "state", "model", "endpoints", "transport"]),
};
const DIR_LAYER = {
  api: "endpoints",
  model: "model",
  store: "state",
  components: "presentation",
  screens: "presentation",
};
const EXEMPT_DIRS = new Set(["lib", "copy", "test", "vendor"]);

/** "src/tools/memory/model/flags.ts" -> "model" | "unclassified" | null(exempt) */
function layerOf(rel) {
  const parts = rel.split("/");
  const file = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);

  if (dirs.some((d) => EXEMPT_DIRS.has(d))) return null;

  for (const d of dirs) if (DIR_LAYER[d]) return DIR_LAYER[d];

  if (dirs[1] === "ui") return "presentation";

  if (file.endsWith(".tsx")) return "presentation";
  if (dirs[1] === "shell") return "transport";

  return "unclassified";
}

// ── the program ───────────────────────────────────────────────────────────
// The config is generated because the fixture trees under scripts/ sit outside
// the repo tsconfig's `include` and still have to be checked.
function openProject(roots) {
  const dir = mkdtempSync(join(tmpdir(), "layercheck-"));
  const config = join(dir, "tsconfig.json");
  writeFileSync(
    config,
    // `typeRoots` is repeated because it resolves against the config file, and
    // this config is in a temp directory with no node_modules beside it.
    JSON.stringify({
      extends: join(ROOT, "tsconfig.json"),
      compilerOptions: { typeRoots: [join(ROOT, "node_modules", "@types")] },
      include: roots,
    }),
  );
  const api = new API({ cwd: ROOT });
  const project = api.updateSnapshot({ openProjects: [config] }).getProjects()[0];
  return {
    project,
    close() {
      api.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ── edges ─────────────────────────────────────────────────────────────────
// A specifier survives to runtime when the checker resolves it to a value, so
// an unmarked import of a type is no edge either.
function makeReader(project) {
  const { checker, program } = project;
  const realPath = new Map(program.getSourceFileNames().map((n) => [n.toLowerCase(), n]));

  function resolveModule(specifier) {
    const path = checker.getSymbolAtLocation(specifier)?.declarations?.[0]?.path;
    if (!path) return onDisk(specifier);
    const abs = realPath.get(path) ?? path;
    const r = rel(abs);
    return r.startsWith("..") || r.split("/").includes("node_modules") ? null : abs;
  }

  // A stylesheet is a runtime edge the checker cannot see: it is not
  // TypeScript, so it is not in the program.
  function onDisk(specifier) {
    if (!specifier.text.startsWith(".")) return null;
    const abs = join(dirname(specifier.sourceFile.fileName), specifier.text);
    return existsSync(abs) && statSync(abs).isFile() ? abs : null;
  }

  function isValue(name) {
    const symbol = checker.getSymbolAtLocation(name);
    if (!symbol) return true;
    const target = symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    if (checker.isUnknownSymbol(target)) return true;
    return Boolean(target.flags & SymbolFlags.Value);
  }

  function namesOf(clause, elements) {
    const names = [];
    if (clause?.name && isValue(clause.name)) names.push("default");
    for (const el of elements ?? []) {
      if (el.isTypeOnly || !isValue(el.name)) continue;
      names.push(el.propertyName?.text ?? el.name.text);
    }
    return names;
  }

  return { resolveModule, namesOf };
}

function edgesOf(source, read) {
  const edges = [];
  const push = (node, specifier, kind, names, bare = false) => {
    if (!names.length && !bare) return;
    edges.push({
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      spec: specifier.text,
      resolved: read.resolveModule(specifier),
      kind,
      names,
    });
  };

  for (const node of source.statements) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (!clause) {
        push(node, node.moduleSpecifier, "imports", [], true);
        continue;
      }
      // TypeScript 7's ImportClause declares `phaseModifier`, which carries
      // `type` and `defer`, and no longer declares `isTypeOnly` — though the
      // node still answers to it. Same edges either way; this is the spelling
      // the published types know.
      if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) continue;
      const bindings = clause.namedBindings;
      const names =
        bindings && ts.isNamespaceImport(bindings)
          ? [...read.namesOf(clause, null), `* as ${bindings.name.text}`]
          : read.namesOf(clause, bindings?.elements);
      push(node, node.moduleSpecifier, "imports", names);
      continue;
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (node.isTypeOnly) continue;
      const clause = node.exportClause;
      const names = !clause
        ? ["*"]
        : ts.isNamespaceExport(clause)
          ? [`* as ${clause.name.text}`]
          : read.namesOf(null, clause.elements);
      push(node, node.moduleSpecifier, "re-exports", names);
    }
  }

  // `await import("./x")` is an edge the statement loop above cannot see.
  walk(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isImportExpression(node.expression)) return;
    const specifier = node.arguments?.[0];
    if (!specifier || !ts.isStringLiteral(specifier)) return;
    const holder = node.parent?.kind === ts.SyntaxKind.AwaitExpression ? node.parent : node;
    const declaration = holder.parent;
    const pattern = declaration && ts.isVariableDeclaration(declaration) ? declaration.name : null;
    const names =
      pattern && ts.isObjectBindingPattern(pattern)
        ? // `{ a: { b } }` binds through `a`, so the name reached here is an
          // identifier in every valid form; anything else has no name to take.
          pattern.elements.flatMap((e) => {
            const n = e.propertyName ?? e.name;
            return n && ts.isIdentifier(n) ? [n.text] : [];
          })
        : ["*"];
    push(node, specifier, "imports", names);
  });

  return edges;
}

function walk(node, visit) {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

// ── ownership (the second check) ──────────────────────────────────────────
function isPresentation(from) {
  const parts = from.split("/");
  if (parts[parts.length - 1].endsWith(".tsx")) return true;
  return parts.slice(0, -1).some((d) => d === "components" || d === "screens");
}

// An `api/` DIRECTORY, per §2 — not a file that happens to be named api.ts.
function isEndpointsModule(edge) {
  if (edge.resolved) return rel(edge.resolved).split("/").slice(0, -1).includes("api");
  return /(^|\/)api\//.test(edge.spec);
}

const TRANSPORT_DIR = "src/shell/";
const TRANSPORT_CLIENT = "src/shell/api.ts";
const inTransport = (p) => p.includes(TRANSPORT_DIR);

// `api()` is a request, so importing it into a component is the same defect as
// calling `fetch` there. `ApiError` is a shape an error boundary has to name,
// and `tokensOf` is a pure estimate, so the binding is named rather than the
// module.
const TRANSPORT_REQUEST = new Set(["api", "default"]);

function isTransportClient(edge, from) {
  if (inTransport(from)) return false;
  if (!edge.resolved || !rel(edge.resolved).endsWith(TRANSPORT_CLIENT)) return false;
  return edge.names.some((n) => TRANSPORT_REQUEST.has(n) || n.startsWith("* as "));
}

// `fetch` as a free identifier. `opts.refetch()` and `client.fetch` are not it:
// a member name is a property, not the global.
const MEMBER_NAMES = new Set([
  ts.SyntaxKind.PropertyAccessExpression,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.EnumMember,
]);

function isMemberName(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.kind === ts.SyntaxKind.QualifiedName) return parent.right === node;
  return MEMBER_NAMES.has(parent.kind) && parent.name === node;
}

function fetchSites(source) {
  const lines = new Set();
  walk(source, (node) => {
    if (node.kind !== ts.SyntaxKind.Identifier) return;
    if (node.text !== "fetch" || isMemberName(node)) return;
    lines.add(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
  });
  return [...lines].sort((a, b) => a - b);
}

// ── main ──────────────────────────────────────────────────────────────────
const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const files = sourceFiles(paths);

const session = openProject((paths.length ? paths : ["src"]).map((p) => resolve(ROOT, p)));
const read = makeReader(session.project);

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

  const source = session.project.program.getSourceFile(abs);
  const broken = source ? session.project.program.getSyntacticDiagnostics(abs) : [{ text: "not part of the program" }];
  if (!source || broken.length) {
    parseErrors.push(`${from}: ${broken[0].text}`);
    continue;
  }
  const edges = edgesOf(source, read);

  // Ownership runs on every file whatever its layer: an unclassified module
  // still may not own a fetch, and that is exactly where some of them are.
  if (isPresentation(from)) {
    for (const e of edges) {
      const rule = isEndpointsModule(e) ? "endpoints" : isTransportClient(e, from) ? "transport" : null;
      if (!rule) continue;
      ownership.push({
        file: from,
        line: e.line,
        rule,
        text: `${e.kind} { ${e.names.join(", ")} } from "${e.spec}"`,
      });
    }
  }
  if (!inTransport(from)) {
    for (const line of fetchSites(source)) {
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
    if (REACHES[layer].has(tLayer)) continue;
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

session.close();

console.log(`layercheck · ${files.length} files · ${checked} value imports resolved to a layer\n`);
console.log("per directory:");
for (const d of [...perDir.values()].sort((a, b) => a.dir.localeCompare(b.dir))) {
  console.log(
    `  ${d.dir.padEnd(28)} ${String(d.files).padStart(3)} files  ${String(d.edges).padStart(3)} value imports  ` +
      `[${d.layer}]${d.bad ? `  ${d.bad} FORBIDDEN` : ""}`,
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
  console.log("\nFORBIDDEN VALUE IMPORTS:");
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.from} → ${v.to}   ${v.text}`);
  }
}
console.log(
  violations.length
    ? `\n${violations.length} forbidden value import(s) — every value import points downward or not at all`
    : "\nevery value import points downward",
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
      if (o.file !== last) {
        console.log(`    ${o.file}`);
        last = o.file;
      }
      console.log(`      :${String(o.line).padStart(4)}  ${o.text}`);
    }
  }
  const inFiles = new Set(ownership.map((o) => o.file)).size;
  console.log(`\n${ownership.length} ownership violation(s) across ${inFiles} file(s)`);
} else {
  console.log("\nno component owns a fetch");
}

process.exit(violations.length || ownership.length ? 1 : 0);
