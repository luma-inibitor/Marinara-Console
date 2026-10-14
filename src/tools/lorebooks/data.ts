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
  /** Messages scanned for keys; an entry's null `scanDepth` inherits it. */
  scanDepth?: number;
  /** Off makes every recursion field on every entry inert. */
  recursiveScanning?: boolean;
  /** On forces `excludeFromVectorization` on every entry (engine storage). */
  excludeFromVectorization?: boolean;
}

export type FilterMode = "any" | "include" | "exclude";
export type DecisionMode = "off" | "require" | "trigger";

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
  probability?: number | null;
  scanDepth?: number | null;
  role?: "system" | "user" | "assistant";
  sticky?: number | null;
  cooldown?: number | null;
  delay?: number | null;
  ephemeral?: number | null;
  group?: string;
  groupWeight?: number | null;
  locked?: boolean;
  preventRecursion?: boolean;
  excludeFromVectorization?: boolean;
  characterFilterMode?: FilterMode;
  characterFilterIds?: string[];
  characterTagFilterMode?: FilterMode;
  characterTagFilters?: string[];
  generationTriggerFilterMode?: FilterMode;
  generationTriggerFilters?: string[];
  additionalMatchingSources?: string[];
  decisionMode?: DecisionMode;
  decisionStatement?: string;
  hasEmbedding?: boolean;
  updatedAt?: string;
  [extra: string]: unknown;
}

export type EntryStatus = "normal" | "constant" | "disabled";

/** Engine position code -> the name its copy keys are filed under. */
const POS_NAME: Record<number, string> = { 0: "beforeChar", 1: "afterChar", 2: "depth", 7: "outlet" };

export const POSITIONS = [0, 1, 2, 7] as const;
export const POS_COMPACT: Record<number, string> = Object.fromEntries(
  Object.entries(POS_NAME).map(([p, name]) => [Number(p), tAny(`lorebooks.pos.${name}.compact`)]),
);
// `outlet` reads the same at both densities, and one string may hold only one
// key (scripts/copycatalog.mjs), so the full table borrows the compact label.
export const POS_FULL: Record<number, string> = Object.fromEntries(
  Object.entries(POS_NAME).map(([p, name]) => [
    Number(p),
    tAny(name === "outlet" ? "lorebooks.pos.outlet.compact" : `lorebooks.pos.${name}.full`),
  ]),
);

// Option ids are the engine's (LorebookEntryRow.tsx FILTER_MODE_LABEL,
// MATCHING_SOURCE_OPTIONS, GENERATION_TRIGGER_OPTIONS), labels are its copy.
export const FILTER_MODES: FilterMode[] = ["any", "include", "exclude"];
export const MATCHING_SOURCES = [
  "character_name",
  "character_description",
  "character_personality",
  "character_scenario",
  "character_tags",
  "persona_description",
  "persona_tags",
] as const;
export const GENERATION_TRIGGERS = [
  "conversation",
  "roleplay",
  "game",
  "chat",
  "continue",
  "autonomous",
  "swipe",
  "impersonate",
  "prompt_preview",
  "test_scan",
  "game_setup",
  "lorebook_assistant",
  "noodle",
  "slurp",
] as const;
export const ROLES = ["system", "user", "assistant"] as const;
export const DECISION_MODES: DecisionMode[] = ["off", "require", "trigger"];
export const SELECTIVE_LOGICS = ["and", "and_all", "not", "not_all"] as const satisfies readonly SelectiveLogic[];

/** The four timing fields, in the order the engine help names them. */
export const TIMING_FIELDS = ["sticky", "cooldown", "delay", "ephemeral"] as const;

/** `selective` only switches secondary keys on, so it is not a status of its own. */
export const statusOf = (e: Entry): EntryStatus => (!e.enabled ? "disabled" : e.constant ? "constant" : "normal");

export const entryTokens = (e: Entry) => tokensOf(e.content);

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

export interface Evaluation {
  fires: boolean;
  hits: string[];
  tested: boolean;
}

/** Would this entry activate on `text`? Uses the vendored engine matcher. */
export function evaluate(e: Entry, text: string): Evaluation {
  if (!text.trim()) return { fires: false, hits: [], tested: false };
  if (!e.enabled) return { fires: false, hits: [], tested: true };
  if (e.constant) return { fires: true, hits: [], tested: true };
  const opts = { useRegex: !!e.useRegex, matchWholeWords: !!e.matchWholeWords, caseSensitive: !!e.caseSensitive };
  const { matched, matchedKeys } = testPrimaryKeys(e.keys ?? [], text, opts);
  if (!matched) return { fires: false, hits: [], tested: true };
  const ok = !e.selective || testSecondaryKeys(e.secondaryKeys ?? [], text, e.selectiveLogic ?? "and", opts);
  return { fires: ok, hits: matchedKeys, tested: true };
}

export function matchesQuery(e: Entry, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    e.name.toLowerCase().includes(s) ||
    e.content.toLowerCase().includes(s) ||
    e.description.toLowerCase().includes(s) ||
    e.keys.some((k) => k.toLowerCase().includes(s)) ||
    (e.tag ?? "").toLowerCase().includes(s)
  );
}

interface TagStat {
  tag: string;
  n: number;
  tokens: number;
  constant: number;
  disabled: number;
  ids: string[];
}

/** Sentinel bucket for entries with no tag. The leading space keeps it sorting
 *  and comparing distinctly from any tag a user could type; compare against
 *  this export rather than re-spelling the literal. */
export const UNTAGGED = " untagged";

export function tagStats(entries: Entry[]): TagStat[] {
  const m = new Map<string, TagStat>();
  for (const e of entries) {
    const key = (e.tag ?? "").trim() || UNTAGGED;
    const s = m.get(key) ?? { tag: key, n: 0, tokens: 0, constant: 0, disabled: 0, ids: [] };
    s.n++;
    s.tokens += entryTokens(e);
    s.ids.push(e.id);
    if (e.constant) s.constant++;
    if (!e.enabled) s.disabled++;
    m.set(key, s);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

export interface CharacterOption {
  id: string;
  name: string;
  tags: string[];
}

interface CharacterRow {
  id: string;
  name?: string;
  data?: string;
}

/** The card JSON arrives as a string; an unreadable card keeps its id as its name. */
function characterOption(row: CharacterRow): CharacterOption {
  let card: { name?: string; tags?: unknown } = {};
  try {
    card = JSON.parse(row.data ?? "{}") as typeof card;
  } catch {
    card = {};
  }
  const tags = Array.isArray(card.tags) ? card.tags.filter((x): x is string => typeof x === "string") : [];
  return { id: row.id, name: row.name || card.name || row.id, tags };
}

// ── API ──
export const fetchCharacters = async (): Promise<CharacterOption[]> => {
  const rows = await api<CharacterRow[]>("/characters");
  return Array.isArray(rows) ? rows.map(characterOption).sort((a, b) => a.name.localeCompare(b.name)) : [];
};
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
