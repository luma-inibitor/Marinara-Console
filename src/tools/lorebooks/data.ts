/* @copy-strict */
// Lorebook tool: types, derived data, and engine-faithful evaluation.
//
// The copy TABLES below (status labels and hints, position labels) are enum ->
// label maps living in object initialisers, not rendered slots, so no position
// rule in design/copycheck.mjs reaches them. Hence the @copy-strict marker
// above: in a strict file EVERY string literal with a letter and a space is
// read as copy, so a label added to one of these maps without a catalog entry
// fails the check instead of shipping unnoticed. Do not drop the marker.
import * as v from "valibot";
import { api, tokensOf } from "../../shell/api";
import { parseItems, parseWrite } from "../../shell/wire";
import { tAny } from "../../copy";
import { testPrimaryKeys, testSecondaryKeys } from "../../lib/lorebook-keyword-matching.js";

const id = v.pipe(v.string(), v.minLength(1));
const strings = v.array(v.string());

export const LorebookSchema = v.looseObject({
  id,
  name: v.string(),
  tokenBudget: v.number(),
  enabled: v.boolean(),
});

/** `selectiveLogic` is closed because `testSecondaryKeys` answers `true` for a
 *  logic it does not recognise, which would draw the entry as always firing. */
export const EntrySchema = v.looseObject({
  id,
  name: v.string(),
  content: v.string(),
  description: v.string(),
  keys: strings,
  secondaryKeys: strings,
  enabled: v.boolean(),
  constant: v.boolean(),
  selective: v.boolean(),
  selectiveLogic: v.picklist(["and", "and_all", "or", "not", "not_all"]),
  useRegex: v.boolean(),
  matchWholeWords: v.boolean(),
  caseSensitive: v.boolean(),
  position: v.number(),
  outletName: v.string(),
  depth: v.number(),
  order: v.number(),
  tag: v.string(),
  /** Not the engine's: server.mjs swaps the vector out for whether there was one. */
  hasEmbedding: v.optional(v.boolean()),
  updatedAt: v.optional(v.string()),
});

export type Lorebook = v.InferOutput<typeof LorebookSchema>;
export type Entry = v.InferOutput<typeof EntrySchema>;

export type EntryStatus = "normal" | "constant" | "selective" | "disabled";

// Engine vocabulary — deriveStatus()/STATUS_LABEL in LorebookEntryRow.tsx upstream.
const STATUSES: EntryStatus[] = ["normal", "constant", "selective", "disabled"];

const byStatus = (key: (s: EntryStatus) => string): Record<EntryStatus, string> =>
  Object.fromEntries(STATUSES.map((s) => [s, tAny(key(s))])) as Record<EntryStatus, string>;

export const STATUS_LABEL = byStatus((s) => `lorebooks.status.${s}`);
export const STATUS_HINT = byStatus((s) => `lorebooks.statusHint.${s}`);

/** Engine position code -> the name its copy keys are filed under. */
const POS_NAME: Record<number, string> = { 0: "beforeChar", 1: "afterChar", 2: "depth", 7: "outlet" };

const byPosition = (key: (name: string) => string): Record<number, string> =>
  Object.fromEntries(Object.entries(POS_NAME).map(([p, name]) => [Number(p), tAny(key(name))]));

export const POS_COMPACT = byPosition((name) => `lorebooks.pos.${name}.compact`);
// `outlet` reads the same at both densities, and one string may hold only one
// key (design/copycheck.mjs), so the full table borrows the compact label there
// rather than registering a second entry with identical text.
export const POS_FULL = byPosition((name) =>
  name === "outlet" ? "lorebooks.pos.outlet.compact" : `lorebooks.pos.${name}.full`);

export const ADVANCED_FIELDS: Array<[string, unknown]> = [
  ["selectiveLogic", "and"], ["probability", null], ["scanDepth", null],
  ["matchWholeWords", false], ["caseSensitive", false], ["useRegex", false],
  ["sticky", null], ["cooldown", null], ["delay", null], ["ephemeral", null],
  ["group", ""], ["groupWeight", null], ["locked", false],
  ["preventRecursion", false], ["excludeRecursion", false], ["delayUntilRecursion", false],
  ["excludeFromVectorization", false], ["role", "system"],
  ["characterFilterMode", "any"], ["characterTagFilterMode", "any"],
  ["generationTriggerFilterMode", "any"],
];

export const statusOf = (e: Entry): EntryStatus =>
  !e.enabled ? "disabled" : e.constant ? "constant" : e.selective ? "selective" : "normal";

export const entryTokens = (e: Entry) => tokensOf(e.content);

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

export interface Evaluation { fires: boolean; hits: string[]; tested: boolean; }

/** Would this entry activate on `text`? Uses the vendored engine matcher. */
export function evaluate(e: Entry, text: string): Evaluation {
  if (!text.trim()) return { fires: false, hits: [], tested: false };
  if (!e.enabled) return { fires: false, hits: [], tested: true };
  if (e.constant) return { fires: true, hits: [], tested: true };
  const opts = { useRegex: !!e.useRegex, matchWholeWords: !!e.matchWholeWords, caseSensitive: !!e.caseSensitive };
  const { matched, matchedKeys } = testPrimaryKeys(e.keys ?? [], text, opts);
  if (!matched) return { fires: false, hits: [], tested: true };
  const ok = !e.selective
    || testSecondaryKeys(e.secondaryKeys ?? [], text, e.selectiveLogic ?? "and", opts);
  return { fires: ok, hits: matchedKeys, tested: true };
}

export function matchesQuery(e: Entry, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return e.name.toLowerCase().includes(s)
    || e.content.toLowerCase().includes(s)
    || e.description.toLowerCase().includes(s)
    || e.keys.some((k) => k.toLowerCase().includes(s))
    || (e.tag ?? "").toLowerCase().includes(s);
}

interface TagStat { tag: string; n: number; tokens: number; constant: number; disabled: number; ids: string[]; }

/** Sentinel bucket for entries with no tag. The leading space keeps it sorting
 *  and comparing distinctly from any tag a user could type; compare against
 *  this export rather than re-spelling the literal. */
export const UNTAGGED = " untagged";

export function tagStats(entries: Entry[]): TagStat[] {
  const m = new Map<string, TagStat>();
  for (const e of entries) {
    const key = (e.tag ?? "").trim() || UNTAGGED;
    const s = m.get(key) ?? { tag: key, n: 0, tokens: 0, constant: 0, disabled: 0, ids: [] };
    s.n++; s.tokens += entryTokens(e); s.ids.push(e.id);
    if (e.constant) s.constant++;
    if (!e.enabled) s.disabled++;
    m.set(key, s);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

// ── API ──

/** Two arguments because @copy-strict reads "GET /x" as copy. */
const wire = (method: string, path: string) => `${method} ${path}`;

export const fetchBooks = async () =>
  parseItems(LorebookSchema, await api("/lorebooks"), wire("GET", "/lorebooks"));
export const fetchEntries = async (bookId: string) =>
  parseItems(EntrySchema, await api(`/lorebooks/${bookId}/entries`), wire("GET", "/lorebooks/:id/entries"));

/** `nullish` because the route may answer 204 rather than the saved row. */
export const patchEntry = async (bookId: string, entryId: string, patch: Record<string, unknown>) =>
  parseWrite(v.nullish(EntrySchema), await api(`/lorebooks/${bookId}/entries/${entryId}`, { method: "PATCH", body: patch }), wire("PATCH", "/lorebooks/:id/entries/:entryId"));
export const createEntry = async (bookId: string, body: Record<string, unknown>) =>
  parseWrite(EntrySchema, await api(`/lorebooks/${bookId}/entries`, { method: "POST", body }), wire("POST", "/lorebooks/:id/entries"));
export const deleteEntry = (bookId: string, id: string) =>
  api<null>(`/lorebooks/${bookId}/entries/${id}`, { method: "DELETE" });
export const bulkPatch = (bookId: string, entryIds: string[], changes: Record<string, unknown>) =>
  api(`/lorebooks/${bookId}/entries/bulk`, { method: "PATCH", body: { entryIds, changes } });
