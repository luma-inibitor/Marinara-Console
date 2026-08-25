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
import { join, relative, dirname, sep } from "node:path";
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

  return mod;
}

/** The specifiers of one import edge that survive to runtime, as names. */
export function valueSpecifiers(edge) {
  return edge.specifiers.filter((s) => !s.typeOnly);
}
