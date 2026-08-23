import { useEffect, useRef, useState } from "preact/hooks";
import { ChevronDown } from "./icons";
import type { Icon } from "./icons";
import { SearchBar } from "./SearchBar";
import { fuzzyFilter } from "./fuzzy";
import "./SearchDisclosure.css";

export interface DisclosureOption { id: string; name: string; hint?: string }

/** Choose one value from a searchable list, in a panel anchored to its own
 *  trigger. The trigger shows the current value, so the control reads as part
 *  of a sentence rather than as a button that hides its state.
 *
 *  Use this when the list can be long and the trigger belongs inline — a scope
 *  breadcrumb, a filter in a toolbar. Use `<Picker>` instead when the list is
 *  short and fixed, or when the trigger lives in a phone's thumb rail: a
 *  bottom sheet is the better projection there.
 *
 *  The search field never autofocuses. Opening a picker should not take the
 *  keyboard from someone who came to click (owner's call, 2026-08-22). */
export function SearchDisclosure(props: {
  label: string;
  value: string;
  icon: Icon;
  options: DisclosureOption[];
  /** The clear-the-filter row, always first and always present. */
  allLabel: string;
  current: string;
  onPick: (id: string) => void;
  /** Shown when the search matches nothing. Name the right noun. */
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = fuzzyFilter(props.options, q, (o) => o.name);
  const I = props.icon;
  const pick = (id: string) => { props.onPick(id); setOpen(false); };

  return (
    <div class="disclosure" ref={ref}>
      <button
        type="button"
        class="disclosure-trigger hit"
        aria-expanded={open}
        aria-label={`${props.label}: ${props.value}`}
        onClick={() => { setOpen(!open); setQ(""); }}
      >
        <I size={14} stroke={1.75} />
        <span class="disclosure-value">{props.value}</span>
        <ChevronDown size={13} stroke={1.75} aria-hidden />
      </button>
      {open && (
        <div class="disclosure-pop" role="dialog" aria-label={props.label}>
          <SearchBar class="disclosure-search" label={`Search ${props.label.toLowerCase()}`}
            value={q} onInput={setQ} />
          <div class="disclosure-list">
            <button type="button" class={`disclosure-opt hit ${props.current === "" ? "is-on" : ""}`}
              onClick={() => pick("")}>{props.allLabel}</button>
            {shown.map((o) => (
              <button key={o.id} type="button"
                class={`disclosure-opt hit ${props.current === o.id ? "is-on" : ""}`}
                onClick={() => pick(o.id)}>
                <span class="disclosure-optname">{o.name}</span>
                {o.hint && <span class="disclosure-opthint t-data">{o.hint}</span>}
              </button>
            ))}
            {shown.length === 0 && <p class="disclosure-none t-prose dim">{props.emptyText}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
