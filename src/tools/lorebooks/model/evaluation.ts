// Would an entry fire on a probe? Engine-faithful, via the vendored matcher.
import type { Entry } from "../api/schema";
import { testPrimaryKeys, testSecondaryKeys } from "../../../lib/lorebook-keyword-matching.js";

export interface Evaluation { fires: boolean; hits: string[]; tested: boolean; }

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
