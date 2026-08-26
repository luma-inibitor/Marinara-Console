// The three keyword arrays a memory carries, and which of them the cap counts.
//
// The engine stores keywords in three lists, not one: `keywords` holds what it
// derived itself, `manualKeywords` what a person typed, `suppressedKeywords`
// the derived ones a person removed. Recall matches the derived and the manual
// together, minus the suppressed — but the 30 cap is enforced on each array
// separately, so it is the MANUAL list a person can fill, and a write taking
// the merged list past 30 is accepted rather than refused.
//
// Accepted is not the same as used. The engine indexes only the first 30 of the
// merged list, derived ones first, so anything past that is stored and then
// silently ignored by recall.

import type { Note } from "../api/types";
import { INDEXED_KEYWORD_CAP } from "./caps";

/** Case- and whitespace-insensitive identity, as the engine folds keywords. */
function fold(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function dedupe(list: readonly string[]): string[] {
  const seen = new Set<string>();
  return list.flatMap((raw) => {
    const trimmed = raw.trim();
    const key = fold(trimmed);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

interface Split { derived: string[]; manual: string[]; suppressed: string[] }

/** A note written before the engine split the arrays has no `manualKeywords`
 *  at all, and the engine reads its whole `keywords` list as manual. */
export function splitKeywords(n: Pick<Note, "keywords" | "manualKeywords" | "suppressedKeywords">): Split {
  if (n.manualKeywords === undefined) {
    return { derived: [], manual: dedupe(n.keywords ?? []), suppressed: [] };
  }
  return {
    derived: dedupe(n.keywords ?? []),
    manual: dedupe(n.manualKeywords),
    suppressed: dedupe(n.suppressedKeywords ?? []),
  };
}

/** The keywords a person added — the only list the 30 cap is measured against. */
export function manualKeywords(n: Pick<Note, "keywords" | "manualKeywords" | "suppressedKeywords">): string[] {
  return splitKeywords(n).manual;
}

/** Derived and manual together, less the derived ones a person suppressed —
 *  the whole stored list, which the engine then truncates before indexing. */
export function effectiveKeywords(n: Pick<Note, "keywords" | "manualKeywords" | "suppressedKeywords">): string[] {
  const { derived, manual, suppressed } = splitKeywords(n);
  const hidden = new Set(suppressed.map(fold));
  return dedupe([...derived, ...manual]).filter((k) => !hidden.has(fold(k)));
}

/** What recall actually matches on: the first INDEXED_KEYWORD_CAP of the merged
 *  list. Derived keywords are ordered first and so take the slots, which means a
 *  note storing its full 30 derived indexes none of its manual keywords at all. */
export function indexedKeywords(n: Pick<Note, "keywords" | "manualKeywords" | "suppressedKeywords">): string[] {
  return effectiveKeywords(n).slice(0, INDEXED_KEYWORD_CAP);
}

/** How many stored keywords fall past the index cap and never match anything. */
export function ignoredKeywordCount(n: Pick<Note, "keywords" | "manualKeywords" | "suppressedKeywords">): number {
  return Math.max(0, effectiveKeywords(n).length - INDEXED_KEYWORD_CAP);
}
