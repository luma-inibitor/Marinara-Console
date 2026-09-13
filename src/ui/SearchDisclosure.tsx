import { useRef, useState } from "react";
import { ChevronDown } from "./icons";
import type { Icon } from "./icons";
import { Popover } from "./Popover";
import { SearchBar } from "./SearchBar";
import { fuzzyFilter } from "./fuzzy";
import { t } from "../copy";
import { closeTopOverlay } from "../shell/overlays";

export interface DisclosureOption {
  id: string;
  name: string;
  hint?: string;
}

const TRIGGER =
  "hit group inline-flex min-h-[32px] max-w-[240px] items-center gap-[5px] rounded-sm px-2 max-stack:max-w-[44vw] " +
  "text-ink hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none aria-expanded:bg-surface-2";
const VALUE = "min-w-0 truncate border-b border-dotted border-transparent text-prose group-hover:border-faint";
const OPTION =
  "flex min-h-tap items-center gap-2 rounded-sm px-2 text-left text-prose text-ink hover:bg-surface-2 " +
  "focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none aria-[current=true]:bg-accent-wash";

/** Choose one value from a searchable list, in a popover anchored to its own
 *  trigger. The trigger shows the current value, so the control reads as part
 *  of a sentence rather than as a button that hides its state.
 *
 *  Use this when the list can be long and the trigger belongs inline, as in a
 *  scope breadcrumb or a toolbar filter. Use `<Picker>` instead when the list
 *  is short and fixed, or when the trigger lives in a phone's thumb rail.
 *
 *  Focus lands on the popover rather than on the search field, so opening a
 *  picker does not take the keyboard from someone who came to click. */
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
  const trigger = useRef<HTMLButtonElement>(null);

  const shown = fuzzyFilter(props.options, q, (o) => o.name);
  const I = props.icon;
  const pick = (id: string) => {
    props.onPick(id);
    closeTopOverlay();
  };
  const current = (id: string) => (props.current === id ? "true" : undefined);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={TRIGGER}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${props.label}: ${props.value}`}
        onClick={() => {
          if (open) {
            closeTopOverlay();
            return;
          }
          setQ("");
          setOpen(true);
        }}
      >
        <I size={14} stroke={1.75} className="shrink-0 text-dim" />
        <span className={VALUE}>{props.value}</span>
        <ChevronDown size={13} stroke={1.75} className="shrink-0 text-dim" aria-hidden />
      </button>
      <Popover
        open={open}
        anchor={trigger}
        label={props.label}
        initialFocus="surface"
        className="w-[300px] p-2"
        onClose={() => setOpen(false)}
      >
        <SearchBar
          className="mb-2"
          label={t("ui.search.what", { what: props.label.toLowerCase() })}
          value={q}
          onInput={setQ}
        />
        <div className="flex max-h-[300px] flex-col overflow-y-auto">
          <button type="button" className={OPTION} aria-current={current("")} onClick={() => pick("")}>
            {props.allLabel}
          </button>
          {shown.map((o) => (
            <button key={o.id} type="button" className={OPTION} aria-current={current(o.id)} onClick={() => pick(o.id)}>
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              {o.hint && <span className="shrink-0 t-data text-dim">{o.hint}</span>}
            </button>
          ))}
          {shown.length === 0 && <p className="m-0 p-2 text-prose text-dim">{props.emptyText}</p>}
        </div>
      </Popover>
    </>
  );
}
