// The console copy catalog.
//
// Every user-visible string in this app comes from here, and every string here
// is one of three things:
//
//   MIRROR   { "use": "reviewqueue.accepting" }
//            The product already has this word. The entry is a pointer into
//            the vendored catalog, so "traces to the product" is something a
//            machine can resolve rather than a comment someone has to believe.
//            A mirror MAY carry a `note`, and MUST carry one when we deviate
//            from the catalog's own name for the thing.
//
//   COINAGE  { "text": "…", "note": "why the product has no word for this" }
//            The product genuinely has no word. `note` is required, is checked
//            for length, and is checked against the vendored catalog: a coinage
//            whose text already exists upstream is a fatal error, because that
//            is the defect this whole apparatus exists to catch. A coinage that
//            deliberately declines a near-miss upstream string names it in
//            `despite`, which is verified to actually collide.
//
//   PLURAL   { "one": "1 thing", "other": "{{count}} things", "note": "…" }
//            A coinage with a count. `count` is the only selector, matching the
//            vendored catalog's own injectedOne / injectedOther convention.
//
// Keys beginning with `_` are file metadata, never copy.
//
// The files stay split per area: copycheck's per-directory state needs an area
// boundary that is a *file*.
//
// Enforcement lives in design/copycheck.mjs. What is checked HERE, at load, is
// only what needs the resolved tables: a console key that shadows a product key,
// and a `use` that points nowhere. Both throw, in dev only — in production a
// copy fault must not take down a page that would otherwise render.

import vendored from "./vendor/ltm-en.json";
import shellCopy from "./shell.json";
import uiCopy from "./ui.json";
import memoryCopy from "./memory.json";
import lorebooksCopy from "./lorebooks.json";
import presetsCopy from "./presets.json";

/** Every product key in the vendored bundle carries this prefix. */
const PREFIX = "ui.longTermMemory.";

// ── types ────────────────────────────────────────────────────────────────
// A missing key is a compile error.

type Meta = `_${string}`;

type ConsoleEntries = typeof shellCopy &
  typeof uiCopy &
  typeof memoryCopy &
  typeof lorebooksCopy &
  typeof presetsCopy;

/** Console keys, minus the `_`-prefixed metadata. */
type ConsoleKey = Exclude<Extract<keyof ConsoleEntries, string>, Meta>;

type VendoredKey = Extract<keyof typeof vendored, string>;
type Strip<K extends string> = K extends `${typeof PREFIX}${infer R}` ? R : never;

/** Product keys, with the `ui.longTermMemory.` prefix stripped. */
type ProductKey = Strip<VendoredKey>;

/**
 * Bases of the catalog's own One/Other pairs, so `t("memoryvault.archiveSuccess",
 * {count})` type-checks even though that exact key does not exist upstream.
 * Requires BOTH halves — `memoryvault.openAMemoryForDetailsOrAddOne` ends in
 * "One" and is not a plural.
 */
type PluralBase<K extends string> = K extends `${infer B}One`
  ? `${B}Other` extends ProductKey
    ? B
    : never
  : never;

type Key = ConsoleKey | ProductKey | PluralBase<ProductKey>;

export type Params = Record<string, string | number>;

interface ConsoleEntry {
  text?: string;
  one?: string;
  other?: string;
  use?: string;
  note?: string;
  despite?: string;
}

// ── tables ───────────────────────────────────────────────────────────────

const product = vendored as Record<string, unknown>;

const consoleTable: Record<string, ConsoleEntry> = {};
for (const area of [shellCopy, uiCopy, memoryCopy, lorebooksCopy, presetsCopy]) {
  for (const [key, entry] of Object.entries(area as Record<string, unknown>)) {
    if (key.startsWith("_")) continue;
    consoleTable[key] = entry as ConsoleEntry;
  }
}

// ── load-time assertions (dev only) ──────────────────────────────────────
if (import.meta.env.DEV) {
  for (const [key, entry] of Object.entries(consoleTable)) {
    if (typeof product[PREFIX + key] === "string") {
      throw new Error(
        `[copy] console key "${key}" shadows product key "${PREFIX + key}". ` +
          `A console key must never be reachable as a product key too — t() would ` +
          `resolve one of them and the other would be silently dead.`,
      );
    }
    if (entry.use != null && typeof product[PREFIX + entry.use] !== "string") {
      throw new Error(
        `[copy] "${key}" mirrors "${entry.use}", which is not in the vendored catalog. ` +
          `Either the key is misspelled or upstream dropped the string; re-point it or coin.`,
      );
    }
  }
}

// ── resolution ───────────────────────────────────────────────────────────

const fill = (s: string, params?: Params): string => {
  if (!params) return s;
  let out = s;
  for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{{${k}}}`, String(v));
  return out;
};

/** `count` is the only selector, matching the vendored catalog. */
const pluralSuffix = (params?: Params): "One" | "Other" =>
  Number(params?.count) === 1 ? "One" : "Other";

function lookup(key: string, params?: Params): string | null {
  const entry = consoleTable[key];
  if (entry) {
    if (entry.use != null) return lookup(entry.use, params);
    if (entry.one != null || entry.other != null) {
      const picked = pluralSuffix(params) === "One" ? entry.one : entry.other;
      if (typeof picked === "string") return fill(picked, params);
    }
    if (typeof entry.text === "string") return fill(entry.text, params);
    return null;
  }

  const direct = product[PREFIX + key];
  if (typeof direct === "string") return fill(direct, params);

  // The catalog's own One/Other pairs, so a call site never has to know that a
  // product string happens to be plural-selected.
  const plural = product[PREFIX + key + pluralSuffix(params)];
  if (typeof plural === "string") return fill(plural, params);

  return null;
}

/**
 * Copy by key. Console keys win over product keys; the load-time shadow check
 * guarantees a key is never both.
 */
export function t(key: Key, params?: Params): string {
  return tAny(key, params);
}

/**
 * `t` for a key computed at runtime — a schema value, a facet id, a nav slug.
 * Same resolution, no compile-time guarantee, so it warns and renders the key
 * rather than throwing in a user's face.
 */
export function tAny(key: string, params?: Params): string {
  const hit = lookup(key, params);
  if (hit != null) return hit;
  console.warn(`[copy] missing string: ${key}`);
  return key;
}

/**
 * "a", "a and b", "a, b, and c". Delegated to Intl rather than assembled from
 * a coined separator and conjunction, so the console does not own copy it has
 * no reason to own.
 */
export function joinList(items: readonly string[]): string {
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(items);
}
