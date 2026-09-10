// Subsequence matching with a score, so "hh" finds "Harbour Household" and
// "thw" finds "Thread The Whistling". Plain substring search cannot do that,
// and the titles in this console are long, repetitive and mostly composed of
// words the reviewer half-remembers.
//
// Deliberately not a library. The whole ranking rule is four bonuses, listed
// below, and a search that surprises you is worse than one that misses.

/** Score a needle against a haystack. Higher is better. Null means no match.
 *
 *  A match requires every needle character to appear in order. Score rewards,
 *  in descending weight: an exact substring hit, characters that start a word,
 *  runs of adjacent characters, and matching early in the string. */
export function fuzzyScore(needle: string, haystack: string): number | null {
  const n = needle.trim().toLowerCase();
  if (!n) return 0;
  const h = haystack.toLowerCase();

  const exact = h.indexOf(n);
  if (exact >= 0) return 1000 - exact; // a real substring always wins

  let score = 0;
  let hi = 0;
  let prevHit = -2;
  for (const ch of n) {
    const at = h.indexOf(ch, hi);
    if (at < 0) return null; // not a subsequence: no match
    if (at === prevHit + 1) score += 8; // adjacent run
    if (at === 0 || /[\s\-_:/·]/.test(h[at - 1]!)) score += 12; // word start
    score += Math.max(0, 10 - at / 4); // early in the string
    prevHit = at;
    hi = at + 1;
  }
  return score;
}

/** Filter and rank a list. Returns the original order when the needle is empty,
 *  so an untouched search box never reorders what the reviewer was reading. */
export function fuzzyFilter<T>(items: T[], needle: string, key: (item: T) => string): T[] {
  if (!needle.trim()) return items;
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const score = fuzzyScore(needle, key(item));
    if (score !== null) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
