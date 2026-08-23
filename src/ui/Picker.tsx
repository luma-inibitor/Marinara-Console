import { Sheet, SheetHead } from "./Sheet";
import { closeTopOverlay } from "../shell/overlays";
import "./Picker.css";

export interface PickerOption { id: string; label: string; hint?: string }

/** Choose one value from a short, fixed list, in a bottom sheet.
 *
 *  The sheet projection exists because these triggers live in the phone's
 *  thumb rail, and a popover anchored above a bottom-edge control opens away
 *  from the thumb. Use `<SearchDisclosure>` instead when the list can be long
 *  or the trigger sits inline in a toolbar. */
export function Picker(props: {
  open: boolean;
  label: string;
  options: PickerOption[];
  current: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  if (!props.open) return null;
  return (
    <Sheet className="option-sheet" label={props.label} onClose={props.onClose}>
      <SheetHead title={<span className="t-label t-label-s">{props.label}</span>} />
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`picker-opt ${props.current === o.id ? "is-on" : ""}`}
          aria-current={props.current === o.id ? "true" : undefined}
          onClick={() => { props.onPick(o.id); closeTopOverlay(); }}
        >
          <span className="picker-label t-data">{o.label}</span>
          {o.hint && <span className="picker-hint t-data">{o.hint}</span>}
        </button>
      ))}
    </Sheet>
  );
}
