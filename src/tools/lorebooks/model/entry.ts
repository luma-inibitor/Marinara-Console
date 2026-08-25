// One entry's status, cost, search match, and advanced fields.
import { tokensOf } from "../../../lib/tokens";
import type { Entry } from "../api/schema";

export type EntryStatus = "normal" | "constant" | "selective" | "disabled";

// Engine vocabulary — deriveStatus()/STATUS_LABEL in LorebookEntryRow.tsx upstream.
export const STATUSES: EntryStatus[] = ["normal", "constant", "selective", "disabled"];

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

export function matchesQuery(e: Entry, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return e.name.toLowerCase().includes(s)
    || e.content.toLowerCase().includes(s)
    || e.description.toLowerCase().includes(s)
    || e.keys.some((k) => k.toLowerCase().includes(s))
    || (e.tag ?? "").toLowerCase().includes(s);
}
