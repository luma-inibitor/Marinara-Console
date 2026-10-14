/* eslint-disable local/no-raw-button -- a switch, which carries role="switch" and aria-checked */
import { cn } from "./cn";

/** An on/off control that applies at once. The track is 36×20 inside a 44px hit area. */
export function Switch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The accessible name; the switch draws no text of its own. */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      className={cn(
        "group inline-grid min-h-tap min-w-tap shrink-0 place-items-center rounded-md",
        "focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none",
        props.className,
      )}
      onClick={() => props.onChange(!props.checked)}
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors motion-reduce:transition-none",
          props.checked ? "border-accent bg-accent" : "border-edge-control bg-canvas",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] left-[2px] size-3.5 rounded-full transition-transform motion-reduce:transition-none",
            props.checked ? "translate-x-4 bg-accent-ink" : "bg-dim",
          )}
        />
      </span>
    </button>
  );
}
