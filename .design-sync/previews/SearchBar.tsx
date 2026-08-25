import { SearchBar } from "marinara-console";

/** Resting: `count` is passed but a tally of everything is not information, so
 *  the field hides it until there is a query. A card with no `count` at all
 *  renders identically, which is why only this one ships. */
export function Resting() {
  return (
    <div style={{ maxWidth: 420 }}>
      <SearchBar value="" onInput={() => {}} label="Search entries" count={213} />
    </div>
  );
}

/** With a query, the match tally renders inside the field. Pair it with
 *  `fuzzyFilter` so the number and the list cannot disagree. */
export function Matching() {
  return (
    <div style={{ maxWidth: 420 }}>
      <SearchBar value="harbour" onInput={() => {}} label="Search entries" count={12} />
    </div>
  );
}

/** Zero is a real answer and still shows, so the reader knows the field ran. */
export function NoMatches() {
  return (
    <div style={{ maxWidth: 420 }}>
      <SearchBar value="zzz" onInput={() => {}} label="Search entries" count={0} />
    </div>
  );
}

