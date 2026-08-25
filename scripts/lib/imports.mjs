// Shared front end for the checks that read the module graph: find the source
// files, parse them once, and hand back a normalized view of what each module
// imports and what it exports — including whether each specifier is type-only,
// and where a relative specifier actually lands on disk.
//
// Type-only is tracked PER SPECIFIER, never per statement: `import { flatten,
// type Row }` is a runtime edge for `flatten` and nothing at all for `Row`.
// Every consumer of this module needs that distinction and none of them can
// get it from a regex, which is the whole reason the parse is shared.
//
// Only things more than one check needs live here. Layer classification,
// `fetch` detection, and local-reference counting each belong to exactly one
// script and stay there — a shared module that accumulates one-offs is the
// tangle this is meant to prevent.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/parser";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Absolute path -> repo-relative, forward slashes on every platform. */
export const rel = (p) => relative(ROOT, p).split(sep).join("/");

// ── file discovery ────────────────────────────────────────────────────────
const SKIP_DIRS = /(^|\/)(node_modules|dist|\.git|vendor)$/;

/** Every non-declaration .ts/.tsx under the given roots, sorted, absolute. */
export function listSources(roots) {
  const out = [];
  const visit = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.test(p.split(sep).join("/"))) return;
      for (const f of readdirSync(p).sort()) visit(join(p, f));
      return;
    }
    if (/\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  };
  for (const r of roots) if (existsSync(r)) visit(r);
  return out;
}

/**
 * The source files named by a check's command-line path arguments, or by
 * `fallback` when there are none. Paths are resolved against ROOT, so an
 * absolute path names the file it spells rather than being concatenated onto
 * ROOT and landing nowhere.
 *
 * An argument that matches no source file exits 2 instead of returning an
 * empty list: a check that scanned nothing must not be able to report success.
 */
export function sourceFiles(paths, fallback = "src") {
  const args = paths.length ? paths : [fallback];
  const groups = args.map((arg) => ({ arg, files: listSources([resolve(ROOT, arg)]) }));
  const empty = groups.filter((g) => !g.files.length);
  if (empty.length) {
    for (const g of empty) {
      console.error(`NOTHING TO CHECK — "${g.arg}" matched no .ts/.tsx source file`);
    }
    process.exit(2);
  }
  return groups.flatMap((g) => g.files);
}

// ── resolution ────────────────────────────────────────────────────────────
// Relative specifiers only; a bare specifier is a package and has no file in
// this tree. The empty extension comes first so an explicit `./x.ts` wins.
const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Resolve a specifier as written in `fromAbs` to an absolute file, or null. */
export function resolveSpecifier(fromAbs, spec) {
  if (!spec.startsWith(".")) return null;
  const base = join(dirname(fromAbs), spec);
  for (const e of EXTS) {
    const p = base + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null; // .css, .json, or a path that does not exist
}

// ── parsing ───────────────────────────────────────────────────────────────
const PLUGINS = ["typescript", "jsx", "decorators-legacy", "explicitResourceManagement"];

function namesOfDeclaration(d) {
  if (!d) return [];
  if (d.type === "VariableDeclaration") {
    const out = [];
    const collect = (id) => {
      if (!id) return;
      if (id.type === "Identifier") out.push(id.name);
      else if (id.type === "ObjectPattern") for (const p of id.properties) collect(p.value ?? p.argument);
      else if (id.type === "ArrayPattern") for (const el of id.elements) collect(el);
      else if (id.type === "AssignmentPattern") collect(id.left);
      else if (id.type === "RestElement") collect(id.argument);
    };
    for (const decl of d.declarations) collect(decl.id);
    return out;
  }
  return d.id?.name ? [d.id.name] : [];
}

const TYPE_DECLARATIONS = new Set([
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSDeclareFunction",
  "TSModuleDeclaration",
]);

/**
 * Parse one file and normalize its module edges.
 *
 * Returns `{ path, rel, source, ast, parseError, imports, exports }`.
 *
 * `imports` entries — one per statement that runs another module:
 *   { line, spec, resolved, kind: "imports" | "re-exports", statementTypeOnly,
 *     bare, specifiers: [{ imported, local, typeOnly, star }] }
 * A side-effect import (`import "./x"`) has no specifiers and `bare: true`; it
 * is still an edge, because the module runs.
 *
 * `exports` entries — one per name this module offers:
 *   { name, local, line, typeOnly, isDefault, from, resolvedFrom, star }
 * `from` is set only for a re-export, where the name is not declared here.
 */
export function parseModule(absPath) {
  const source = readFileSync(absPath, "utf8");
  let ast = null;
  let parseError = null;
  try {
    ast = babel.parse(source, { sourceType: "module", plugins: PLUGINS });
  } catch (e) {
    parseError = e.message;
  }
  const mod = { path: absPath, rel: rel(absPath), source, ast, parseError, imports: [], exports: [] };
  if (parseError) return mod;

  const edge = (n, kind, specifiers, bare = false) => {
    mod.imports.push({
      line: n.loc.start.line,
      spec: n.source.value,
      resolved: resolveSpecifier(absPath, n.source.value),
      kind,
      statementTypeOnly: (n.importKind ?? n.exportKind) === "type",
      bare,
      specifiers,
    });
  };

  for (const n of ast.program.body) {
    if (n.type === "ImportDeclaration") {
      const stmtType = n.importKind === "type";
      const specifiers = n.specifiers.map((s) => ({
        imported:
          s.type === "ImportDefaultSpecifier" ? "default"
          : s.type === "ImportNamespaceSpecifier" ? "*"
          : s.imported.name ?? s.imported.value,
        local: s.local.name,
        typeOnly: stmtType || s.importKind === "type",
        star: s.type === "ImportNamespaceSpecifier",
      }));
      edge(n, "imports", specifiers, n.specifiers.length === 0);
      continue;
    }

    if (n.type === "ExportNamedDeclaration") {
      const stmtType = n.exportKind === "type";
      if (n.source) {
        // A re-export runs the module it names, exactly like an import.
        const specifiers = n.specifiers.map((s) => ({
          imported: s.local?.name ?? s.exported?.name ?? "*",
          local: s.exported?.name ?? s.local?.name,
          typeOnly: stmtType || s.exportKind === "type",
          star: s.type === "ExportNamespaceSpecifier",
        }));
        edge(n, "re-exports", specifiers);
        const resolved = resolveSpecifier(absPath, n.source.value);
        for (const s of specifiers) {
          mod.exports.push({
            name: s.local ?? s.imported,
            local: s.imported,
            line: n.loc.start.line,
            typeOnly: s.typeOnly,
            isDefault: s.imported === "default",
            from: n.source.value,
            resolvedFrom: resolved,
            star: false,
          });
        }
        continue;
      }
      if (n.declaration) {
        const typeOnly = stmtType || TYPE_DECLARATIONS.has(n.declaration.type);
        for (const name of namesOfDeclaration(n.declaration)) {
          mod.exports.push({
            name,
            local: name,
            line: n.loc.start.line,
            typeOnly,
            isDefault: false,
            from: null,
            resolvedFrom: null,
            star: false,
          });
        }
        continue;
      }
      for (const s of n.specifiers) {
        const name = s.exported?.name ?? s.exported?.value;
        mod.exports.push({
          name,
          local: s.local?.name ?? name,
          line: n.loc.start.line,
          typeOnly: stmtType || s.exportKind === "type",
          isDefault: name === "default",
          from: null,
          resolvedFrom: null,
          star: false,
        });
      }
      continue;
    }

    if (n.type === "ExportDefaultDeclaration") {
      mod.exports.push({
        name: "default",
        local: n.declaration?.id?.name ?? null,
        line: n.loc.start.line,
        typeOnly: false,
        isDefault: true,
        from: null,
        resolvedFrom: null,
        star: false,
      });
      continue;
    }

    if (n.type === "ExportAllDeclaration") {
      const typeOnly = n.exportKind === "type";
      edge(n, "re-exports", [{ imported: "*", local: null, typeOnly, star: true }]);
      mod.exports.push({
        name: "*",
        local: null,
        line: n.loc.start.line,
        typeOnly,
        isDefault: false,
        from: n.source.value,
        resolvedFrom: resolveSpecifier(absPath, n.source.value),
        star: true,
      });
    }
  }

  collectDynamicImports(ast.program.body, mod, absPath);
  return mod;
}

// `await import("./x")` is an edge like any other, and its names are as real as
// a static import's. Only the static top-level forms are walked above, so this
// sweeps the whole tree for the expression form. A dynamic import whose target
// is not a plain string cannot be resolved, and one whose result is not
// destructured reaches every export under some name this AST never spells --
// both are recorded as a star so nothing downstream reads them as unused.
function collectDynamicImports(root, mod, absPath) {
  const seen = new Set();
  const walk = (n, parent, grandparent) => {
    if (Array.isArray(n)) { for (const c of n) walk(c, parent, grandparent); return; }
    if (!n || typeof n !== "object" || typeof n.type !== "string") return;
    // Babel spells `import(x)` as a CallExpression whose callee is `Import`;
    // other parsers emit an `ImportExpression` with a `source`.
    const dyn =
      n.type === "ImportExpression" ? n.source
      : n.type === "CallExpression" && n.callee?.type === "Import" ? n.arguments?.[0]
      : null;
    if (dyn && !seen.has(n)) {
      seen.add(n);
      const spec = dyn.type === "StringLiteral" ? dyn.value : null;
      if (spec) {
        // `const { a, b } = await import("./x")` -- the parent is the await and
        // its own parent the declarator that holds the pattern.
        const pattern =
          parent?.type === "AwaitExpression" && grandparent?.type === "VariableDeclarator"
            ? grandparent.id
            : parent?.type === "VariableDeclarator"
              ? parent.id
              : null;
        const names =
          pattern?.type === "ObjectPattern"
            ? pattern.properties
                .filter((prop) => prop.type === "ObjectProperty" && !prop.computed && prop.key?.name)
                .map((prop) => prop.key.name)
            : null;
        mod.imports.push({
          line: n.loc.start.line,
          spec,
          resolved: resolveSpecifier(absPath, spec),
          kind: "imports",
          statementTypeOnly: false,
          bare: false,
          specifiers: names?.length
            ? names.map((name) => ({ imported: name, local: name, typeOnly: false, star: false }))
            : [{ imported: "*", local: null, typeOnly: false, star: true }],
        });
      }
    }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k.endsWith("Comments")) continue;
      walk(n[k], n, parent);
    }
  };
  walk(root, null, null);
}

/** The specifiers of one import edge that survive to runtime, as names. */
export function valueSpecifiers(edge) {
  return edge.specifiers.filter((s) => !s.typeOnly);
}
