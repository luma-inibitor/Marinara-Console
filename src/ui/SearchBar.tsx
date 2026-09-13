import { ICON_SIZE, Search } from "./icons";
import { t } from "../copy";
import { cn } from "./cn";

/** A search field with its magnifier, and a match tally while there is a query. */

// The ring goes on the box rather than the input, so the tally sits inside it.
const BOX =
  "flex min-h-tap min-w-0 flex-auto items-center gap-[7px] rounded-md border border-edge bg-surface-1 px-[10px] " +
  "text-dim focus-within:border-accent focus-within:shadow-[var(--focus-ring)]";
const INPUT =
  "min-h-[40px] min-w-0 flex-auto bg-transparent font-prose text-ink outline-none placeholder:text-dim " +
  "focus-visible:shadow-none [&::-webkit-search-cancel-button]:hidden";
const COUNT =
  "pointer-events-none shrink-0 rounded-[5px] bg-accent-wash px-[6px] py-1 t-data text-data-s font-bold " +
  "whitespace-nowrap text-accent";

export function SearchBar(props: {
  value: string;
  onInput: (v: string) => void;
  /** Placeholder and accessible name, since the field has no visible label. */
  label: string;
  /** Shown only while there is a query. */
  count?: number;
  className?: string;
}) {
  const showCount = props.count !== undefined && props.value.trim() !== "";
  return (
    <label className={cn(BOX, props.className)}>
      <Search size={ICON_SIZE.md} stroke={1.75} aria-hidden />
      <input
        className={INPUT}
        type="search"
        placeholder={props.label}
        aria-label={props.label}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
      {showCount && <span className={COUNT}>{t("ui.search.matches", { count: props.count! })}</span>}
    </label>
  );
}
