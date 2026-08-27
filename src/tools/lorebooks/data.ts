// Lorebook tool: types, derived data, and engine-faithful evaluation.
//
// Gotcha: eslint-plugin-i18next skips the whole initialiser of an ALL-CAPS
// declarator, which is what the label tables below are. eslint.config.js adds
// back one case, a quoted label of two words. A template literal stays unchecked.
import { api, tokensOf } from "../../shell/api";
import { tAny } from "../../copy";
import { testPrimaryKeys, testSecondaryKeys } from "../../lib/lorebook-keyword-matching.js";
import type { SelectiveLogic } from "../../lib/lorebook-keyword-matching.js";

export interface Lorebook {
  id: string;
  name: string;
  tokenBudget: number;
  enabled: boolean;
}

/** Fields the tool reads/writes. Everything else passes through untouched. */
export interface Entry {
  id: string;
  name: string;
  content: string;
  description: string;
  keys: string[];
  secondaryKeys: string[];
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  selectiveLogic: SelectiveLogic;
  useRegex: boolean;
  matchWholeWords: boolean;
  caseSensitive: boolean;
  position: number;
  outletName: string;
  depth: number;
  order: number;
  tag: string;
  hasEmbedding?: boolean;
  updatedAt?: string;
  [extra: string]: unknown;
}

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
// key (scripts/copycatalog.mjs), so the full table borrows the compact label there
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
export const fetchBooks = () => api<Lorebook[]>("/lorebooks");
export const fetchEntries = (bookId: string) => api<Entry[]>(`/lorebooks/${bookId}/entries`);
export const patchEntry = (bookId: string, id: string, patch: Record<string, unknown>) =>
  api<Entry>(`/lorebooks/${bookId}/entries/${id}`, { method: "PATCH", body: patch });
export const createEntry = (bookId: string, body: Record<string, unknown>) =>
  api<Entry>(`/lorebooks/${bookId}/entries`, { method: "POST", body });
export const deleteEntry = (bookId: string, id: string) =>
  api<null>(`/lorebooks/${bookId}/entries/${id}`, { method: "DELETE" });
export const bulkPatch = (bookId: string, entryIds: string[], changes: Record<string, unknown>) =>
  api(`/lorebooks/${bookId}/entries/bulk`, { method: "PATCH", body: { entryIds, changes } });
