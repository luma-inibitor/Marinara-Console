/* @copy-strict */
// What the audit reads across a whole book: the distribution it calls a row
// hot, and the per-tag totals the tag panel draws. Strict because the untagged
// sentinel reads as copy and has to keep tracing to the catalog.
import type { Entry } from "../api/schema";
import { entryTokens } from "./entry";

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
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
