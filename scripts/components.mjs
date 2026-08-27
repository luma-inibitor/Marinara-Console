#!/usr/bin/env node
// Component inventory: every function in the tree whose return value is
// markup, and what each one is coupled to. The count that matters is not how
// many components there are — it is how many of them reach past props into a
// store, the model, or the endpoints layer, because that is what decides
// whether two surfaces that render the same record can ever be one component.
//
//   node scripts/components.mjs                  # whole tree
//   node scripts/components.mjs src/tools/memory # narrowed
//   node scripts/components.mjs --json           # machine-readable
//
// ── Why not enumerate by export ───────────────────────────────────────────
// The interesting components are file-local. Review.tsx and Sources.tsx each
// define a dozen sub-components that appear in no export list, and those are
// exactly the ones that duplicate field rendering. An export-based inventory
// reports a flattering number by missing them, so this walks every function in
// every file and asks what it returns.
//
// ── What counts as returning markup ───────────────────────────────────────
// A function is a component when JSX appears in one of its RETURN positions:
// an arrow's expression body, or a `return` argument — looking through the
// wrappers a return can legally use (conditional, logical, sequence, `as`
// cast, parentheses, array). JSX anywhere else in the body does not count: a
// function that only passes `<Sheet/>` to `openOverlay()` and returns nothing
// is a handler, not a component, and reading the whole body would call it one.
// Crossing into a nested function always stops the search — the nested
// function's markup belongs to the nested function, which is inventoried in
// its own right.
//
// ── Components vs inline render closures ──────────────────────────────────
// Both are counted, and they are reported apart. A function declared at module
// scope is a COMPONENT. A function that returns JSX from inside another one is
// a CLOSURE — the `(x) => <li/>` inside a `.map`, a `renderRow` prop, a branch
// helper defined mid-body. They are where duplicated field rendering actually
// hides, because they are never named in an import and never show up in a
// component list. Their names are inferred from context (the variable, the
// object key, the JSX attribute, the callee they are passed to) and fall back
// to `<callee>@line` — a synthesized label, not a symbol you can grep for.
//
// ── Attributing an import to a component ──────────────────────────────────
// An import is a property of a FILE; coupling is a property of a COMPONENT,
// and a 600-line screen file holds both a store-bound screen and a dozen
// props-only leaves. So each component is attributed only the imported
// bindings its own subtree actually references, plus — transitively — the ones
// reached through module-scope helpers and constants it names. That closure is
// intra-file only: a helper in another module is that module's coupling, not
// this component's.
//
// Where the reference is invisible to a syntactic walk the attribution is
// wrong in the safe direction (under-attribution, never over): a binding
// reached only through a dynamic property lookup is not counted. Nothing here
// falls back to file-level attribution; a component with no references of its
// own is reported as presentational, and `--json` carries the binding names
// behind every classification so a surprising one can be checked.
//
// ── The classes ───────────────────────────────────────────────────────────
//   presentational  props only — no store, model, or api binding
//   store-bound     reads a store — expected in a screen, a smell in a leaf
//   domain          imports model/ (see the caveat below)
//   violating       imports api/, or the request off shell/api — a component
//                   owning a fetch. `ApiError` and `tokensOf` off that same
//                   module are not requests and do not count, which is the
//                   line layercheck.mjs already draws.
// One class per component, worst wins, in that order. `domain` here means an
// import from `model/` and nothing more: "computes domain logic inline" cannot
// be detected syntactically — a cap comparison written out in a JSX expression
// is arithmetic to a parser — so the domain count is a floor, not a total.
//
// Informational. Exit code is always 0.

import { rel, sourceFiles, parseModule } from "./lib/imports.mjs";

const JSON_MODE = process.argv.includes("--json");

// ── AST helpers ───────────────────────────────────────────────────────────
const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod",
]);

const isNode = (n) => n && typeof n === "object" && typeof n.type === "string";

/** Every child node of `n`, skipping location and comment bookkeeping. */
function* children(n) {
  for (const k of Object.keys(n)) {
    if (k === "loc" || k === "range" || k.endsWith("Comments")) continue;
    const v = n[k];
    if (Array.isArray(v)) {
      for (const c of v) if (isNode(c)) yield c;
    } else if (isNode(v)) yield v;
  }
}

/** Walk `n` and everything under it, never entering a nested function. */
function walkWithin(n, visit) {
  const stack = [n];
  while (stack.length) {
    const cur = stack.pop();
    visit(cur);
    for (const c of children(cur)) {
      if (c !== n && FUNCTION_TYPES.has(c.type)) continue;
      stack.push(c);
    }
  }
}

// A return can wrap its markup in a handful of ways that are still "returns
// markup". Anything else — a call, a member access — is not looked through,
// because the JSX inside it belongs to whatever that expression owns.
function returnsMarkup(expr) {
  if (!isNode(expr)) return false;
  switch (expr.type) {
    case "JSXElement":
    case "JSXFragment":
      return true;
    case "ConditionalExpression":
      return returnsMarkup(expr.consequent) || returnsMarkup(expr.alternate);
    case "LogicalExpression":
      return returnsMarkup(expr.left) || returnsMarkup(expr.right);
    case "SequenceExpression":
      return returnsMarkup(expr.expressions[expr.expressions.length - 1]);
    case "ArrayExpression":
      return expr.elements.some((e) => returnsMarkup(e));
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "ParenthesizedExpression":
      return returnsMarkup(expr.expression);
    default:
      return false;
  }
}

function isComponentFn(fn) {
  if (fn.type === "ArrowFunctionExpression" && fn.body.type !== "BlockStatement") {
    return returnsMarkup(fn.body);
  }
  let found = false;
  walkWithin(fn.body, (n) => {
    if (!found && n.type === "ReturnStatement" && returnsMarkup(n.argument)) found = true;
  });
  return found;
}

/** Identifier names referenced anywhere under `n`, nested functions included. */
function referencedNames(n) {
  const names = new Set();
  const stack = [n];
  while (stack.length) {
    const cur = stack.pop();
    if (cur.type === "Identifier") names.add(cur.name);
    if (cur.type === "JSXIdentifier") names.add(cur.name);
    for (const k of Object.keys(cur)) {
      if (k === "loc" || k === "range" || k.endsWith("Comments")) continue;
      // A non-computed property or key is a name in someone else's namespace,
      // not a reference to a binding in this one.
      if (!cur.computed && (k === "property" || k === "key")) continue;
      const v = cur[k];
      if (Array.isArray(v)) {
        for (const c of v) if (isNode(c)) stack.push(c);
      } else if (isNode(v)) stack.push(v);
    }
  }
  return names;
}

// ── naming ────────────────────────────────────────────────────────────────
// A function expression has no name of its own; the name a reader would use
// comes from where it sits. Ordered most to least like a real symbol.
function nameFrom(fn, parents) {
  if (fn.id?.name) return { name: fn.id.name, named: true };
  const p = parents[parents.length - 1];
  const gp = parents[parents.length - 2];
  if (p?.type === "VariableDeclarator" && p.id?.type === "Identifier") {
    return { name: p.id.name, named: true };
  }
  if ((p?.type === "ObjectProperty" || p?.type === "ObjectMethod") && p.key) {
    const k = p.key.name ?? p.key.value;
    if (k) return { name: String(k), named: true };
  }
  if (p?.type === "ClassProperty" && p.key?.name) return { name: p.key.name, named: true };
  if (p?.type === "AssignmentExpression" && p.left?.type === "Identifier") {
    return { name: p.left.name, named: true };
  }
  if (p?.type === "JSXExpressionContainer" && gp?.type === "JSXAttribute") {
    return { name: `${gp.name?.name ?? "prop"}=`, named: false };
  }
  if (p?.type === "CallExpression") {
    const c = p.callee;
    const label =
      c?.type === "Identifier"
        ? c.name
        : c?.type === "MemberExpression" && !c.computed
          ? (c.property?.name ?? "call")
          : "call";
    // Wrappers that hand the component straight back: the name is the
    // variable the wrapped call is assigned to, not `memo`.
    if (["memo", "forwardRef", "observer"].includes(label) && gp?.type === "VariableDeclarator") {
      return { name: gp.id?.name ?? label, named: true };
    }
    return { name: `${label}()`, named: false };
  }
  return { name: "anonymous", named: false };
}

// ── coupling ──────────────────────────────────────────────────────────────
const segments = (p) => p.split("/");

/** What layer an import edge lands in, for coupling purposes. */
function edgeKind(edge) {
  const target = edge.resolved ? rel(edge.resolved) : edge.spec;
  const parts = segments(target);
  const file = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);

  // The transport client is one module holding a request and two things that
  // are not: `ApiError` is a shape an error boundary has to name and `tokensOf`
  // is a pure estimate. layercheck.mjs draws the line at the binding for that
  // reason, and drawing it at the module here would inflate the one count this
  // report exists to give — so the binding decides, in `bindingsOf` below.
  // It is tested FIRST because it resolves to a file named api.ts whose
  // specifier ends in `/api`, exactly like an endpoints directory would.
  if (file === "api.ts") return "transport-module";
  if (dirs.includes("api") || /(^|\/)api$/.test(edge.spec)) return "api";
  // `detail/model.ts` is the domain module of that folder under a filename
  // rather than a directory, and reads as model to anyone opening it.
  if (dirs.includes("model") || file === "model.ts" || /(^|\/)model$/.test(edge.spec)) return "model";
  // lib/store is the store PRIMITIVE, not a store. Only `useStore` off it is a
  // read; `createStore` there is how view state is declared, which every
  // screen may do for itself (§1).
  if (file === "store.ts" && dirs.includes("lib")) return "store-primitive";
  if (dirs.includes("store") || /(^|\/)store$/.test(edge.spec)) return "store";
  return null;
}

const STORE_READERS = new Set(["useStore"]);
const TRANSPORT_REQUEST = new Set(["api", "default", "*"]);

// ── gather ────────────────────────────────────────────────────────────────
const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const files = sourceFiles(paths);

const modules = [];
const parseErrors = [];

for (const abs of files) {
  const mod = parseModule(abs);
  if (mod.parseError) {
    parseErrors.push(`${rel(abs)}: ${mod.parseError}`);
    continue;
  }
  modules.push(mod);
}

// Imported bindings, per file: local name -> the coupling that name carries.
const bindingsOf = new Map();
for (const mod of modules) {
  const map = new Map();
  for (const edge of mod.imports) {
    const kind = edgeKind(edge);
    if (!kind) continue;
    for (const s of edge.specifiers) {
      if (s.typeOnly || !s.local) continue; // a type erases; it is not an edge
      let k = kind;
      if (k === "transport-module") {
        if (!TRANSPORT_REQUEST.has(s.star ? "*" : s.imported)) continue;
        k = "api";
      }
      map.set(s.local, { kind: k, spec: edge.spec, imported: s.imported });
    }
  }
  bindingsOf.set(mod.rel, map);
}

// Re-export hops, so a barrel does not eat the reference count. `src/ui`
// exports everything through index.ts, and every consumer imports from there:
// without following the hop, each ui component reads as referenced by exactly
// one file — the barrel — which is the opposite of the fact wanted here.
const alias = new Map(); // "barrel\0name" -> { file, name }
for (const mod of modules) {
  for (const e of mod.exports) {
    if (!e.resolvedFrom) continue;
    const target = rel(e.resolvedFrom);
    if (e.star) continue; // resolved per name below
    alias.set(`${mod.rel}\0${e.name}`, { file: target, name: e.local ?? e.name });
  }
  for (const e of mod.exports) {
    if (e.star && e.resolvedFrom) alias.set(`${mod.rel}\0*star*`, { file: rel(e.resolvedFrom), name: null });
  }
}

function throughBarrels(file, name) {
  for (let hop = 0; hop < 4; hop++) {
    const direct = alias.get(`${file}\0${name}`);
    if (direct) {
      file = direct.file;
      name = direct.name ?? name;
      continue;
    }
    const star = alias.get(`${file}\0*star*`);
    if (star) {
      file = star.file;
      continue;
    }
    break;
  }
  return { file, name };
}

// How many OTHER files reference each exported name, by import.
const externalRefs = new Map(); // "file\0name" -> Set(file)
for (const mod of modules) {
  for (const edge of mod.imports) {
    if (!edge.resolved) continue;
    if (rel(edge.resolved) === mod.rel) continue;
    for (const s of edge.specifiers) {
      if (s.typeOnly) continue;
      const at = s.star ? { file: rel(edge.resolved), name: "*" } : throughBarrels(rel(edge.resolved), s.imported);
      if (at.file === mod.rel) continue; // a module importing back through a barrel
      const key = `${at.file}\0${at.name}`;
      if (!externalRefs.has(key)) externalRefs.set(key, new Set());
      externalRefs.get(key).add(mod.rel);
    }
  }
}

const components = [];

for (const mod of modules) {
  const bindings = bindingsOf.get(mod.rel);
  const exported = new Map(mod.exports.map((e) => [e.local ?? e.name, e.name]));

  // Module-scope helpers and constants, so a component that names one inherits
  // whatever that helper is coupled to. Fixpoint below, because helpers call
  // helpers.
  const localRefs = new Map();
  for (const n of mod.ast.program.body) {
    const d = n.type === "ExportNamedDeclaration" || n.type === "ExportDefaultDeclaration" ? n.declaration : n;
    if (!isNode(d)) continue;
    if (d.type === "FunctionDeclaration" && d.id) localRefs.set(d.id.name, referencedNames(d));
    if (d.type === "VariableDeclaration") {
      for (const decl of d.declarations) {
        if (decl.id?.type === "Identifier" && decl.init) {
          localRefs.set(decl.id.name, referencedNames(decl.init));
        }
      }
    }
  }
  for (let pass = 0; pass < 6; pass++) {
    let grew = false;
    for (const [name, refs] of localRefs) {
      for (const r of [...refs]) {
        if (r === name) continue;
        const inner = localRefs.get(r);
        if (!inner) continue;
        for (const x of inner)
          if (!refs.has(x)) {
            refs.add(x);
            grew = true;
          }
      }
    }
    if (!grew) break;
  }

  // Every function in the file, with its ancestry, so nesting decides whether
  // it is a component or a closure.
  const found = [];
  const visit = (n, parents, fnDepth) => {
    if (FUNCTION_TYPES.has(n.type)) {
      const component = isComponentFn(n);
      if (component) found.push({ fn: n, parents: [...parents], depth: fnDepth });
      parents = [...parents, n];
      for (const c of children(n)) visit(c, parents, fnDepth + 1);
      return;
    }
    const next = [...parents, n];
    for (const c of children(n)) visit(c, next, fnDepth);
  };
  for (const n of mod.ast.program.body) visit(n, [], 0);

  for (const { fn, parents, depth } of found) {
    const { name, named } = nameFrom(fn, parents);
    const own = referencedNames(fn);

    // Transitive through module-scope helpers, intra-file only.
    const reach = new Set(own);
    for (let pass = 0; pass < 6; pass++) {
      let grew = false;
      for (const r of [...reach]) {
        const inner = localRefs.get(r);
        if (!inner) continue;
        for (const x of inner)
          if (!reach.has(x)) {
            reach.add(x);
            grew = true;
          }
      }
      if (!grew) break;
    }

    /** @type {{api: string[], model: string[], store: string[]}} */
    const signals = { api: [], model: [], store: [] };
    for (const r of reach) {
      const b = bindings.get(r);
      if (!b) continue;
      if (b.kind === "api") signals.api.push(r);
      else if (b.kind === "model") signals.model.push(r);
      else if (b.kind === "store") signals.store.push(r);
      else if (b.kind === "store-primitive" && STORE_READERS.has(b.imported)) signals.store.push(r);
    }
    for (const k of Object.keys(signals)) signals[k].sort();

    const cls = signals.api.length
      ? "violating"
      : signals.model.length
        ? "domain"
        : signals.store.length
          ? "store-bound"
          : "presentational";

    const isExported = depth === 0 && exported.has(name);
    const exportName = isExported ? exported.get(name) : null;
    const refs = isExported
      ? new Set([
          ...(externalRefs.get(`${mod.rel}\0${exportName}`) ?? []),
          ...(externalRefs.get(`${mod.rel}\0*`) ?? []),
        ]).size
      : 0;

    components.push({
      name,
      inferredName: !named,
      file: mod.rel,
      dir: segments(mod.rel).slice(0, -1).join("/"),
      line: fn.loc.start.line,
      kind: depth === 0 ? "component" : "closure",
      class: cls,
      exported: isExported,
      refs,
      signals,
    });
  }
}

components.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

// ── report ────────────────────────────────────────────────────────────────
const CLASSES = ["presentational", "store-bound", "domain", "violating"];

if (JSON_MODE) {
  const totals = Object.fromEntries(CLASSES.map((c) => [c, components.filter((x) => x.class === c).length]));
  console.log(
    JSON.stringify(
      {
        files: files.length,
        components: components.filter((c) => c.kind === "component").length,
        closures: components.filter((c) => c.kind === "closure").length,
        byClass: totals,
        parseErrors,
        inventory: components,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const count = (list, k, v) => list.filter((x) => x[k] === v).length;

console.log(
  `components · ${files.length} files · ${components.length} functions return markup ` +
    `(${count(components, "kind", "component")} components, ${count(components, "kind", "closure")} inline closures)\n`,
);

const dirs = new Map();
for (const c of components) {
  const agg = dirs.get(c.dir) || {
    dir: c.dir,
    component: 0,
    closure: 0,
    presentational: 0,
    "store-bound": 0,
    domain: 0,
    violating: 0,
  };
  agg[c.kind]++;
  agg[c.class]++;
  dirs.set(c.dir, agg);
}

console.log("per directory:");
console.log(
  `  ${"".padEnd(30)} ${"cmp".padStart(4)} ${"clo".padStart(4)}   ${"pres".padStart(5)} ${"store".padStart(5)} ${"dom".padStart(4)} ${"viol".padStart(4)}`,
);
for (const d of [...dirs.values()].sort((a, b) => a.dir.localeCompare(b.dir))) {
  console.log(
    `  ${d.dir.padEnd(30)} ${String(d.component).padStart(4)} ${String(d.closure).padStart(4)}   ` +
      `${String(d.presentational).padStart(5)} ${String(d["store-bound"]).padStart(5)} ` +
      `${String(d.domain).padStart(4)} ${String(d.violating).padStart(4)}`,
  );
}

console.log("\ntotals by class:");
for (const c of CLASSES) {
  const n = count(components, "class", c);
  const inClosures = components.filter((x) => x.class === c && x.kind === "closure").length;
  console.log(`  ${c.padEnd(16)} ${String(n).padStart(4)}   (${inClosures} of them inline closures)`);
}
const coupled = components.filter((c) => c.class === "domain" || c.class === "violating").length;
console.log(`\n  domain + violating: ${coupled} of ${components.length} — the ones props alone cannot move`);

console.log("\ninventory:");
console.log(
  `  ${"component".padEnd(28)} ${"line".padStart(5)}  ${"class".padEnd(14)} ${"exp".padEnd(3)} ${"refs".padStart(4)}  file`,
);
let lastFile = null;
for (const c of components) {
  if (c.file !== lastFile) {
    console.log(`  ── ${c.file}`);
    lastFile = c.file;
  }
  const label = (c.kind === "closure" ? "  ↳ " : "  ") + c.name;
  console.log(
    `  ${label.padEnd(28)} ${String(c.line).padStart(5)}  ${c.class.padEnd(14)} ` +
      `${(c.exported ? "yes" : "—").padEnd(3)} ${String(c.exported ? c.refs : "—").padStart(4)}  ${c.file}`,
  );
}

if (parseErrors.length) {
  console.log("\nPARSE FAILURES — these files hold no counted components:");
  for (const m of parseErrors) console.log("  " + m);
}

console.log(
  "\nnote · `domain` counts a model/ import only; domain logic written inline in a\n" +
    "       component is invisible to a parser, so that column is a floor.\n" +
    "note · closure names are inferred from context and are not grep-able symbols.",
);

process.exit(0);
