import { Search } from "./icons";
import "./SearchBar.css";

/** A search field. The magnifier is part of the component, not something each
 *  screen remembers — one of the three copies this replaces had no icon at all.
 *
 *  `count` renders the match tally inside the field, and only while there is a
 *  query: a count of everything is not information. Pair it with `fuzzyFilter`
 *  from ./fuzzy so the number and the list cannot disagree.
 *
 *  Never autofocused. A search box that grabs the caret on open steals the
 *  keyboard from the list behind it (owner's call, 2026-08-22). */
export function SearchBar(props: {
  value: string;
  onInput: (v: string) => void;
  /** Placeholder and accessible name — the field has no visible label. */
  label: string;
  count?: number;
  className?: string;
}) {
  const showCount = props.count !== undefined && props.value.trim() !== "";
  return (
    <label className={`searchbar ${props.className ?? ""}`}>
      <Search size={14} stroke={1.75} aria-hidden />
      <input
        className="t-prose"
        type="search"
        placeholder={props.label}
        aria-label={props.label}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
      {showCount && <span className="searchbar-count t-data">{props.count} match</span>}
    </label>
  );
}
