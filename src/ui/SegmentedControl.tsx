import { Button } from "./Button";
import { cn } from "./cn";

export interface Segment<T extends string | number> {
  id: T;
  label: string;
  /** The accessible name when the visible label is an abbreviation. */
  name?: string;
  /** Keeps the segment focusable and says why it cannot be chosen. */
  disabledReason?: string;
}

/** Two to five exclusive choices, one pressed. */
export function SegmentedControl<T extends string | number>(props: {
  label: string;
  value: T;
  segments: Segment<T>[];
  onChange: (id: T) => void;
  labelCase?: "upper" | "sentence";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", props.className)} role="group" aria-label={props.label}>
      {props.segments.map((s) => (
        <Button
          key={String(s.id)}
          size="sm"
          labelCase={props.labelCase}
          pressed={props.value === s.id}
          label={s.name}
          disabled={s.disabledReason != null}
          disabledReason={s.disabledReason}
          onClick={() => props.onChange(s.id)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
