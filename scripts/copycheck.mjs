#!/usr/bin/env node
// Copy check: every user-visible string in a rendered surface must trace to
// the vendored product catalog (ltm-en.json) or be a registered coinage in the
// console's own copy. Coining a word the catalog already holds is the defect
// this catches.
//
//   node scripts/copycheck.mjs                       # source mode: src/**/*.{ts,tsx}
//   node scripts/copycheck.mjs src/tools/memory      # source mode, narrowed
//   node scripts/copycheck.mjs public/mockups/x.html # mockup mode (unchanged)
//   node scripts/copycheck.mjs --prune               # drop vanished baseline entries
//   node scripts/copycheck.mjs --adopt               # record today's untraced set
//   node scripts/copycheck.mjs --json                # machine-readable report
//
// ── The baseline ratchet (design/copy-baseline.json) ───────────────────────
// Keyed by FILE, values are NORMALISED strings — no line numbers, so ordinary
// edits do not churn it. `_areas` declares a state per directory; there are
// exactly two, and both enforce per string:
//   clean      no baseline entries permitted there at all; an entry under a
//              clean directory is an INTEGRITY failure, not a copy failure —
//              it means the baseline is lying about a finished area.
//   baselined  the baseline is honored PER STRING and may only shrink. Any
//              untraced string not already listed for that file fails, even
//              if another string in the same file was routed the same day,
//              so a swap cannot pass as progress.
//
// Enforcement must stay per string, never by count: a count-based baseline
// lets you coin a new string as long as you route an old one in the same
// change, which is the exact defect this tool exists to catch. "Actively
// being routed" vs "not started" is a fact about intent, not enforcement, so
// it belongs in a comment beside the area, not in the state machine.
//
// A directory with no declared area is treated as clean. Entries that no
// longer appear WARN (never fail) and are removed by --prune. The baseline
// never suppresses a catalog-integrity failure, and never suppresses a string
// in a file it does not list.
//
// Exit codes: 0 clean · 1 untraced strings · 2 catalog-integrity failure.
// 2 is separate on purpose: it means the check itself is compromised (the
// catalog did not load, or the baseline claims entries in a `clean` area), and
// a compromised check must never be read as a passing one.
//
// ── How source mode decides what is copy ───────────────────────────────────
// Only whitelisted syntactic POSITIONS are read: JSX text, string/template
// literals in a JSX child expression, a small set of copy-carrying attributes,
// and the arguments of copy sinks. Class names, ids, keys, route paths, enum
// values and catalog keys are never in one of those positions, so they are not
// filtered out after the fact — they are never picked up.
//
// A whole sentence is reconstructed per JSX element, with every expression or
// element child replaced by a sentinel; `{{name}}` in catalog values becomes
// the same sentinel. So `<>adds to <Skey/> of {ref}</>` matches the catalog's
// "adds to {{section}} of {{ref}}". Without that, a parameterised string could
// never match and splitting a sentence into fragments would read as a fix.
//
// A brand name is not copy: an element marked data-brand is skipped along with
// its whole subtree. See the note beside `brandSkip` for why it is an attribute
// and not a word list.
//
// ── What the console's own copy is ────────────────────────────────────────
// src/copy/*.json, one file per area. The allowlist is EXACTLY the rendered
// text fields — `text`, `one`, `other`. Never keys, never `use` targets, never
// `note` prose, so nothing can be laundered into the allowlist by writing it in
// a comment. Entries are checked structurally by checkCatalog(); every one of
// those checks exits 2, because a bad allowlist makes a green run meaningless.
//
// A file whose first three lines contain the marker @copy-strict has EVERY
// string literal with a letter and a space read as copy. That is how the copy
// TABLES are covered (glossary.tsx, flags.ts, store.ts message maps), which no
// position rule can reach.
//
// Specimen books carry a meta layer (captions, intros, legends) that is prose
// about the design, not product copy; those are skipped by class in HTML mode.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/parser";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = join(ROOT, "design", "copy-baseline.json");
const SENT = "\u0000";

// ── normalization ─────────────────────────────────────────────────────────
// Matching is EXACT, never substring: under substring matching almost every
// string finds some catalog entry containing it, and a check that never fails
// is not a check.
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\{\{\s*\w+\s*\}\}/g, SENT) // catalog placeholders == our sentinel
    .replace(/\s*\(\d+\)\s*$/, "") // trailing counts: "Select all (8)"
    .replace(/\s*\(\u0000\)\s*$/, "") // trailing counts: "Select all ({{n}})"
    .replace(/\s+\d+$/, "") // trailing counts: "Select all 8"
    .replace(/[.:…]$/, "")
    .replace(/\s+/g, " ")
    .replace(/\u0000(?:\s*\u0000)+/g, SENT) // collapse adjacent sentinels
    .trim();

// ── residual filters ──────────────────────────────────────────────────────
// All-lowercase WITH an internal separator: identifiers, enum values, route
// paths, dotted catalog keys. `create_note` and `reviewqueue.draft` are exempt;
// "Long-Term Memory" (capitals) and the bare word "keep" (no separator) are
// NOT — a one-word lowercase coinage must still be registered.
const SEP = /^\/?[a-z0-9]+([_./:-][a-z0-9]+)+\/?$/;
// Punctuation, counts, bare sentinels: nothing a reader could call a word.
const GLYPH = /^[\s\u0000\d·—–…✓✗×+−(){}[\]%\/.,:;!?'"|@#*&_-]*$/;
const HAS_LETTER = /[a-zA-Z]/;

function isCandidate(raw) {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length < 2) return false;
  // length is measured on the words, not the sentinels: `{n}s` is a unit
  // suffix, not a sentence.
  if (t.replace(/\u0000/g, "").trim().length < 2) return false;
  if (!HAS_LETTER.test(t)) return false;
  if (GLYPH.test(t)) return false;
  if (SEP.test(t)) return false;
  const n = norm(t);
  if (!n || !HAS_LETTER.test(n) || GLYPH.test(n)) return false;
  return true;
}

// ── catalog loading ───────────────────────────────────────────────────────
const integrity = [];

function jsonStrings(node, out, keysOnly = null) {
  if (typeof node === "string") {
    if (!keysOnly) out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) jsonStrings(v, out, keysOnly);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (keysOnly) {
        if (keysOnly.has(k) && typeof v === "string") out.push(v);
        else if (v && typeof v === "object") jsonStrings(v, out, keysOnly);
      } else {
        jsonStrings(v, out, keysOnly);
      }
    }
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    integrity.push(`cannot read ${relative(ROOT, path)}: ${e.message}`);
    return null;
  }
}

/** The vendored product catalog: every string value, wherever it sits. */
function loadVendored() {
  const candidates = [
    join(ROOT, "src", "copy", "vendor", "ltm-en.json"),
    join(ROOT, "src", "tools", "memory", "ltm-en.json"),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    integrity.push("vendored catalog not found (src/copy/vendor/ltm-en.json or src/tools/memory/ltm-en.json)");
    return { path: null, strings: [] };
  }
  const data = readJson(path);
  if (!data) return { path, strings: [] };
  const out = [];
  jsonStrings(data, out);
  if (!out.length) integrity.push(`vendored catalog ${relative(ROOT, path)} yielded no strings`);
  return { path: relative(ROOT, path), strings: out, data };
}

/**
 * The console's own copy. Two worlds:
 *   catalog   — src/copy/*.json exists; the allowlist is EXACTLY the rendered
 *               text fields (text / one / other). Never keys, never `use`
 *               targets, never `note` prose.
 *   pre-catalog — the catalog has not been built yet; fall back to the OURS
 *               object in strings.ts, parsed structurally so keys, comments
 *               and import paths cannot leak into the allowlist.
 */
const TEXT_FIELDS = new Set(["text", "one", "other"]);

function loadConsole() {
  const dir = join(ROOT, "src", "copy");
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
    : [];
  if (files.length) {
    const out = [];
    const entries = [];
    for (const f of files) {
      const data = readJson(join(dir, f));
      if (!data) continue;
      jsonStrings(data, out, TEXT_FIELDS);
      for (const [key, entry] of Object.entries(data)) {
        if (key.startsWith("_")) continue; // file metadata, never copy
        entries.push({ file: `src/copy/${f}`, key, entry });
      }
    }
    if (!out.length) integrity.push("src/copy/*.json exists but yielded no text/one/other entries");
    return {
      world: "catalog",
      source: `src/copy/{${files.map((f) => f.replace(/\.json$/, "")).join(",")}}.json`,
      strings: out,
      entries,
    };
  }

  const path = join(ROOT, "src", "tools", "memory", "strings.ts");
  if (!existsSync(path)) {
    integrity.push("console copy not found (no src/copy/*.json and no src/tools/memory/strings.ts)");
    return { world: "pre-catalog", source: null, strings: [] };
  }
  const src = readFileSync(path, "utf8");
  let ast;
  try {
    ast = babel.parse(src, { sourceType: "module", plugins: ["typescript", "jsx"] });
  } catch (e) {
    integrity.push(`cannot parse src/tools/memory/strings.ts: ${e.message}`);
    return { world: "pre-catalog", source: "src/tools/memory/strings.ts", strings: [] };
  }
  const out = [];
  let found = false;
  walk(ast, (n) => {
    if (n.type !== "VariableDeclarator") return;
    if (n.id?.type !== "Identifier" || n.id.name !== "OURS") return;
    found = true;
    objectValues(unwrap(n.init), out);
  });
  if (!found) integrity.push("src/tools/memory/strings.ts has no `OURS` object");
  if (!out.length) integrity.push("`OURS` in src/tools/memory/strings.ts yielded no strings");
  return { world: "pre-catalog", source: "src/tools/memory/strings.ts", strings: out };
}

// ── catalog integrity ─────────────────────────────────────────────────────
// Structural checks on src/copy/*.json itself. All of these are FATAL (exit 2)
// rather than copy failures, because each one means the allowlist is not what
// it claims to be — and an allowlist you cannot trust makes every green run a
// lie. The last check is the one that pays for the rest: a coinage whose text
// already exists upstream.
const PREFIX = "ui.longTermMemory.";
const MIN_NOTE = 40;

function checkCatalog(entries, vendoredData) {
  if (!entries || !vendoredData) return;
  const product = vendoredData;
  const has = (k) => typeof product[PREFIX + k] === "string";

  // normalized product text -> first key that carries it
  const byText = new Map();
  for (const [k, v] of Object.entries(product)) {
    if (typeof v !== "string") continue;
    const n = norm(v);
    if (n && !byText.has(n)) byText.set(n, k.replace(PREFIX, ""));
  }

  const seenText = new Map();
  const fail = (e, msg) => integrity.push(`${e.file}: "${e.key}" ${msg}`);

  for (const e of entries) {
    const v = e.entry;
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      fail(e, "is not an entry object ({use} or {text,note} or {one,other,note})");
      continue;
    }
    const texts = ["text", "one", "other"].filter((f) => typeof v[f] === "string").map((f) => v[f]);
    const isMirror = typeof v.use === "string";

    if (!texts.length && !isMirror) {
      fail(e, "has neither rendered text (text/one/other) nor a `use` pointer");
      continue;
    }
    if (texts.length && isMirror) {
      fail(e, "has BOTH `use` and rendered text — a pointer and a copy of what it points at drift apart silently");
      continue;
    }

    // a console key must never also be reachable as a product key
    if (has(e.key)) fail(e, `shadows product key "${PREFIX}${e.key}"`);

    if (isMirror) {
      if (!has(v.use)) fail(e, `mirrors "${v.use}", which is not in the vendored catalog`);
      if (v.despite != null) fail(e, "is a mirror and cannot carry `despite`; that field is only for coinages that decline a near-miss");
      continue;
    }

    // coinages: the note is the whole argument for the coinage existing
    if (typeof v.note !== "string" || v.note.trim().length < MIN_NOTE) {
      fail(e, `is a coinage with ${v.note == null ? "no `note`" : `a ${v.note.trim().length}-character note`} — say why the product has no word for this (min ${MIN_NOTE} chars)`);
    }

    for (const text of texts) {
      const n = norm(text);
      if (!n) continue;

      const dup = seenText.get(n);
      if (dup) fail(e, `renders the same text as "${dup}" — one string, one key`);
      else seenText.set(n, e.key);

      const upstream = byText.get(n);
      if (upstream && !v.despite) {
        fail(e, `coins ${JSON.stringify(text)}, but the vendored catalog already has it as "${upstream}" — mirror it with {"use": "${upstream}"}, or if it genuinely cannot be used, declare {"despite": "${upstream}"} and say why in the note`);
      }
    }

    if (v.despite != null) {
      if (!has(v.despite)) fail(e, `declares despite:"${v.despite}", which is not in the vendored catalog`);
      else if (!texts.some((tx) => norm(tx) === norm(product[PREFIX + v.despite]))) {
        fail(e, `declares despite:"${v.despite}", but that string does not collide with this text — a stale exemption is an exemption for nothing`);
      }
    }
  }
}

/** Values only — never property keys — descending through nested objects,
 *  `as` casts, and the bodies of arrow functions that return a template. */
function objectValues(node, out) {
  node = unwrap(node);
  if (!node) return;
  if (node.type === "ObjectExpression") {
    for (const p of node.properties) {
      if (p.type !== "ObjectProperty") continue;
      objectValues(p.value, out);
    }
    return;
  }
  if (node.type === "ArrayExpression") {
    for (const el of node.elements) if (el) objectValues(el, out);
    return;
  }
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
    if (node.body && node.body.type !== "BlockStatement") objectValues(node.body, out);
    else if (node.body) walk(node.body, (n) => { if (n.type === "ReturnStatement" && n.argument) objectValues(n.argument, out); });
    return;
  }
  const lit = litText(node);
  if (lit != null) out.push(lit);
}

// ── AST helpers ───────────────────────────────────────────────────────────
function unwrap(n) {
  while (n && (n.type === "TSAsExpression" || n.type === "TSSatisfiesExpression" || n.type === "ParenthesizedExpression" || n.type === "TSNonNullExpression")) n = n.expression;
  return n;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visit);
    return;
  }
  if (typeof node.type === "string") visit(node);
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "leadingComments" || k === "trailingComments" || k === "innerComments") continue;
    const v = node[k];
    if (v && typeof v === "object") walk(v, visit);
  }
}

/** A literal's rendered text, with `${...}` holes as sentinels. */
function litText(node) {
  node = unwrap(node);
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral") return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join(SENT);
  return null;
}

/** Literals reachable as a rendered alternative: through ?: and &&/||/?? into
 *  BOTH branches, so neither arm of a conditional escapes the check. */
function altLiterals(node, out) {
  node = unwrap(node);
  if (!node) return;
  if (node.type === "ConditionalExpression") {
    altLiterals(node.consequent, out);
    altLiterals(node.alternate, out);
    return;
  }
  if (node.type === "LogicalExpression") {
    altLiterals(node.left, out);
    altLiterals(node.right, out);
    return;
  }
  const lit = litText(node);
  if (lit != null) out.push(lit);
}

function jsxName(node) {
  if (!node) return "";
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") return jsxName(node.property);
  if (node.type === "JSXNamespacedName") return `${node.namespace.name}:${node.name.name}`;
  return "";
}

// ── position whitelist ────────────────────────────────────────────────────
const TEXT_ATTRS = new Set([
  "aria-label", "aria-description", "aria-placeholder", "aria-valuetext",
  "aria-roledescription", "title", "placeholder", "alt",
]);
// Our own components (capitalized) take copy through props.
const COMPONENT_ATTRS = new Set([
  "label", "title", "body", "heading", "hint", "caption", "tip", "summary", "empty", "note",
]);
const SINKS = new Set(["toast", "confirm", "alert", "setError"]);

/** Reconstruct one element's sentence. deep=false replaces element children
 *  with a sentinel; deep=true splices in their own text, so a sentence broken
 *  across <b>…</b> still has a chance to match the catalog verbatim. */
function childrenText(children, deep) {
  let s = "";
  for (const c of children) {
    if (c.type === "JSXText") s += c.value;
    else if (c.type === "JSXExpressionContainer") {
      const lit = deep ? litText(c.expression) : null;
      s += lit != null ? lit : SENT;
    } else if ((c.type === "JSXElement" || c.type === "JSXFragment") && deep) {
      s += childrenText(c.children, true);
    } else s += SENT;
  }
  return s;
}

function extractFile(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join("/");
  const src = readFileSync(absPath, "utf8");
  const strict = src.split("\n").slice(0, 3).join("\n").includes("@copy-strict");
  let ast;
  try {
    ast = babel.parse(src, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy", "explicitResourceManagement"],
    });
  } catch (e) {
    return { file: rel, parseError: e.message, hits: [] };
  }

  // A brand name is not copy. "Marinara" and "Console" have no catalog entry
  // and never will, because a product does not translate or re-word its own
  // name — routing them would put a permanent do-not-touch string in the
  // allowlist, where the next reader would read it as an ordinary coinage.
  // The exemption is explicit and greppable rather than a hardcoded word list:
  // an element marked data-brand is skipped, subtree and all. It is a separate
  // axis from data-contrast-exempt (which is about ink, not vocabulary), so it
  // is a separate attribute.
  const brandSkip = new Set();
  walk(ast, (n) => {
    if (n.type !== "JSXElement") return;
    const marked = n.openingElement.attributes.some(
      (a) => a.type === "JSXAttribute" && jsxName(a.name) === "data-brand");
    if (marked) walk(n, (m) => brandSkip.add(m));
  });

  const hits = [];
  const add = (text, alt) => {
    if (text == null) return;
    if (!isCandidate(text)) return;
    hits.push({ text: text.replace(/\s+/g, " ").trim(), norm: norm(text), alt: alt != null ? norm(alt) : null });
  };

  walk(ast, (n) => {
    if (brandSkip.has(n)) return;
    if (n.type === "JSXElement" || n.type === "JSXFragment") {
      // 1. the element's own reconstructed sentence
      const flat = childrenText(n.children, false);
      const deep = childrenText(n.children, true);
      add(flat, deep === flat ? null : deep);

      // 2. literal alternatives inside child expression containers
      for (const c of n.children) {
        if (c.type !== "JSXExpressionContainer") continue;
        const outs = [];
        altLiterals(c.expression, outs);
        for (const o of outs) add(o);
      }

      // 3. copy-carrying attributes
      const opening = n.type === "JSXElement" ? n.openingElement : null;
      if (opening) {
        const el = jsxName(opening.name);
        const isComponent = /^[A-Z]/.test(el);
        for (const a of opening.attributes) {
          if (a.type !== "JSXAttribute") continue;
          const name = jsxName(a.name);
          const ok = TEXT_ATTRS.has(name) || (isComponent && COMPONENT_ATTRS.has(name));
          if (!ok) continue;
          if (!a.value) continue;
          if (a.value.type === "StringLiteral") add(a.value.value);
          else if (a.value.type === "JSXExpressionContainer") {
            const outs = [];
            altLiterals(a.value.expression, outs);
            for (const o of outs) add(o);
          }
        }
      }
      return;
    }

    // 4. copy sinks
    if (n.type === "CallExpression" || n.type === "NewExpression") {
      const callee = unwrap(n.callee);
      const name =
        callee?.type === "Identifier" ? callee.name
        : callee?.type === "MemberExpression" && callee.property?.type === "Identifier" ? callee.property.name
        : "";
      if (!SINKS.has(name)) return;
      for (const arg of n.arguments || []) {
        const outs = [];
        altLiterals(arg, outs);
        for (const o of outs) add(o);
      }
    }
  });

  // 5. @copy-strict files: every literal with a letter and a space. This is
  //    how the copy TABLES get covered; no position rule can reach them.
  if (strict) {
    walk(ast, (n) => {
      if (brandSkip.has(n)) return;
      if (n.type !== "StringLiteral" && n.type !== "TemplateLiteral") return;
      const t = litText(n);
      if (t == null) return;
      if (!/ /.test(t) || !HAS_LETTER.test(t)) return;
      add(t);
    });
  }

  // de-duplicate by normalized form
  const seen = new Map();
  for (const h of hits) if (!seen.has(h.norm)) seen.set(h.norm, h);
  return { file: rel, parseError: null, hits: [...seen.values()], strict };
}

// ── file discovery ────────────────────────────────────────────────────────
function listSources(roots) {
  const out = [];
  const visit = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      if (/(^|\/)(node_modules|dist|\.git)$/.test(p.split(sep).join("/"))) return;
      for (const f of readdirSync(p).sort()) visit(join(p, f));
      return;
    }
    if (/\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  };
  for (const r of roots) if (existsSync(r)) visit(r);
  return out;
}

// ── baseline ──────────────────────────────────────────────────────────────
const AREA_STATES = new Set(["clean", "baselined"]);

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { _areas: {} };
  const b = readJson(BASELINE_PATH);
  if (!b || typeof b !== "object") {
    integrity.push("design/copy-baseline.json is unreadable");
    return { _areas: {} };
  }
  for (const [dir, state] of Object.entries(b._areas || {})) {
    if (!AREA_STATES.has(state)) integrity.push(`design/copy-baseline.json: area "${dir}" has unknown state "${state}"`);
  }
  return b;
}

function areaOf(areas, file) {
  let best = null;
  for (const dir of Object.keys(areas)) {
    if (file === dir || file.startsWith(dir.endsWith("/") ? dir : dir + "/")) {
      if (!best || dir.length > best.length) best = dir;
    }
  }
  return best;
}

// ── mockup mode (unchanged) ───────────────────────────────────────────────
const META_CLASSES = /\b(caption|intro|legend|spec-label|subtitle|revband|okband|clab|mk|secno)\b/;

function mockupMode(path, CAT, OUR) {
  const html = readFileSync(path, "utf8");
  const stripped = html.replace(/<(figcaption|ul|p|h1|h2)\b[^>]*>[\s\S]*?<\/\1>/g, (m) =>
    META_CLASSES.test(m) ? "" : m);

  const strings = new Set();
  for (const m of stripped.matchAll(/<(button|span|div|b|h3|h4|summary)\b([^>]*)>([^<>]{2,90})</g)) {
    if (META_CLASSES.test(m[2])) continue;
    const t = m[3].replace(/\s+/g, " ").trim();
    if (!t || /^[\d\s·—…✓✗+−(){}[\]%\/.,-]+$/.test(t)) continue;
    strings.add(t);
  }
  const covered = (s) => CAT.has(norm(s)) || OUR.has(norm(s));
  const uncovered = [...strings].filter((s) => !covered(s)).sort();
  console.log(`${strings.size} user-visible strings · ${strings.size - uncovered.length} trace to the catalog or OURS\n`);
  if (uncovered.length) {
    console.log("NOT TRACED — each must be found in the catalog, or registered in OURS with a reason:");
    for (const s of uncovered) console.log("  " + s);
  }
  return uncovered.length ? 1 : 0;
}

// ── main ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const paths = argv.filter((a) => !a.startsWith("--"));
const asJson = flags.has("--json");
const prune = flags.has("--prune");
const adopt = flags.has("--adopt");

const vendored = loadVendored();
const ours = loadConsole();
checkCatalog(ours.entries, vendored.data);
const CAT = new Set(vendored.strings.map((s) => norm(s)));
const OUR = new Set(ours.strings.map((s) => norm(s)));
CAT.delete("");
OUR.delete("");

const htmlArgs = paths.filter((p) => p.endsWith(".html"));
if (htmlArgs.length) {
  // Catalog integrity still gates the mockup path — a check running against an
  // empty allowlist passes everything.
  if (integrity.length) {
    console.error("CATALOG INTEGRITY FAILURE — the check itself is compromised:");
    for (const m of integrity) console.error("  " + m);
    process.exit(2);
  }
  let code = 0;
  for (const p of htmlArgs) code = Math.max(code, mockupMode(p, CAT, OUR));
  process.exit(code);
}

const roots = paths.length ? paths.map((p) => join(ROOT, p)) : [join(ROOT, "src")];
const files = listSources(roots);
const baseline = loadBaseline();
const areas = baseline._areas || {};

// Integrity: a `clean` area may hold no baseline entries at all.
for (const key of Object.keys(baseline)) {
  if (key === "_areas") continue;
  const a = areaOf(areas, key);
  if (a && areas[a] === "clean") integrity.push(`baseline lists ${key}, but ${a} is declared clean`);
}

const results = [];
const parseErrors = [];
for (const f of files) {
  const r = extractFile(f);
  if (r.parseError) parseErrors.push(r);
  results.push(r);
}
if (parseErrors.length) {
  for (const r of parseErrors) integrity.push(`parse failure ${r.file}: ${r.parseError}`);
}

const covered = (h) => CAT.has(h.norm) || OUR.has(h.norm) || (h.alt && (CAT.has(h.alt) || OUR.has(h.alt)));

const report = { world: ours.world, files: [], failures: [], warnings: [], integrity: [] };
const perDir = new Map();
let totalStrings = 0;
let totalUntraced = 0;
let failCount = 0;

const nextBaseline = { _areas: { ...areas } };

for (const r of results) {
  if (r.parseError) continue;
  const dir = r.file.split("/").slice(0, -1).join("/");
  const area = areaOf(areas, r.file);
  const state = area ? areas[area] : "clean";
  const based = Array.isArray(baseline[r.file]) ? baseline[r.file] : null;
  const baseSet = new Set(based || []);

  const untraced = r.hits.filter((h) => !covered(h));
  totalStrings += r.hits.length;
  totalUntraced += untraced.length;

  // clean: nothing is forgiven. baselined: only the exact strings already
  // listed for THIS file are forgiven — per string, so a swap cannot pass as
  // progress.
  const failures = state === "clean" ? untraced : untraced.filter((h) => !baseSet.has(h.norm));

  const gone = based ? based.filter((b) => !untraced.some((h) => h.norm === b)) : [];
  if (gone.length) report.warnings.push({ file: r.file, resolved: gone });

  if (untraced.length) nextBaseline[r.file] = untraced.map((h) => h.norm).sort();

  const agg = perDir.get(dir) || { dir, files: 0, strings: 0, untraced: 0, failing: 0, state };
  agg.files++;
  agg.strings += r.hits.length;
  agg.untraced += untraced.length;
  agg.failing += failures.length;
  perDir.set(dir, agg);

  failCount += failures.length;
  report.files.push({ file: r.file, area, state, strings: r.hits.length, untraced: untraced.length, failing: failures.length, strict: !!r.strict });
  for (const h of failures) report.failures.push({ file: r.file, text: h.text });
}

// `--prune` only ever REMOVES entries. Growth is a code change, never a tool
// side effect — otherwise the ratchet turns into a rubber stamp.
if (prune) {
  const pruned = { _areas: { ...areas } };
  for (const [k, v] of Object.entries(baseline)) {
    if (k === "_areas" || !Array.isArray(v)) continue;
    const keep = Array.isArray(nextBaseline[k]) ? v.filter((s) => nextBaseline[k].includes(s)) : [];
    if (keep.length) pruned[k] = keep;
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(pruned, null, 2) + "\n");
}

// `--adopt` records the current untraced set as the baseline, but ONLY for
// areas declared `baselined`. A `clean` area refuses adoption, because there
// the whole point is that nothing may be forgiven, and a flag that grants
// forgiveness on request is not a ratchet.
if (adopt) {
  const next = { _areas: { ...areas } };
  const refused = [];
  const keys = new Set([...Object.keys(baseline), ...Object.keys(nextBaseline)]);
  for (const k of [...keys].sort()) {
    if (k === "_areas") continue;
    const a = areaOf(areas, k);
    const st = a ? areas[a] : "clean";
    if (st !== "baselined") {
      if (Array.isArray(baseline[k])) { next[k] = baseline[k]; refused.push(`${k} [${st}]`); }
      continue;
    }
    if (nextBaseline[k]) next[k] = nextBaseline[k];
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  if (refused.length) {
    console.error(`--adopt refused ${refused.length} file(s) outside a \`baselined\` area:`);
    for (const r of refused) console.error("  " + r);
  }
}

report.integrity = integrity;

if (asJson) {
  console.log(JSON.stringify({ ...report, totals: { files: results.length, strings: totalStrings, untraced: totalUntraced, failing: failCount }, byDir: [...perDir.values()] }, null, 2));
} else {
  const worldNote = ours.world === "catalog"
    ? `console copy: ${ours.source} (${OUR.size} entries)`
    : `console copy: pre-catalog fallback — ${ours.source} OURS (${OUR.size} entries); src/copy/*.json not built yet`;
  console.log(`copycheck · source mode · ${results.length} files`);
  console.log(`  vendored catalog: ${vendored.path} (${CAT.size} entries)`);
  console.log(`  ${worldNote}\n`);
  console.log(`${totalStrings} user-visible strings · ${totalStrings - totalUntraced} trace to the catalog or OURS · ${totalUntraced} untraced\n`);
  const dirs = [...perDir.values()].sort((a, b) => a.dir.localeCompare(b.dir));
  console.log("per directory:");
  for (const d of dirs) {
    console.log(`  ${d.dir.padEnd(24)} ${String(d.untraced).padStart(4)} untraced / ${String(d.strings).padStart(4)} strings   [${d.state}]${d.failing ? `  ${d.failing} FAILING` : ""}`);
  }
  if (report.warnings.length) {
    const n = report.warnings.reduce((s, w) => s + w.resolved.length, 0);
    console.log(`\nWARN: ${n} baseline entries no longer appear (routed or deleted). Run --prune to drop them.`);
    for (const w of report.warnings) for (const s of w.resolved) console.log(`  ${w.file}: ${s}`);
  }
  if (report.failures.length) {
    console.log("\nNOT TRACED — each must be found in the catalog, or registered with a reason:");
    let last = null;
    for (const f of report.failures) {
      if (f.file !== last) { console.log(`  ${f.file}`); last = f.file; }
      console.log(`    ${f.text}`);
    }
  }
  if (integrity.length) {
    console.log("\nCATALOG INTEGRITY FAILURE — the check itself is compromised:");
    for (const m of integrity) console.log("  " + m);
  }
}

process.exit(integrity.length ? 2 : failCount ? 1 : 0);
