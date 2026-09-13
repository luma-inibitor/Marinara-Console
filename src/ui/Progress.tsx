import type { ReactNode } from "react";
import { percent } from "./Meter";
import { cn } from "./cn";

/** Completion of a task, drawn as a track with a fill. */

export type ProgressProps = {
  label?: string;
  value?: number;
  max?: number;
  text?: ReactNode;
  size?: "sm" | "md";
  inline?: boolean;
  className?: string;
};

export function clamp(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(value, max);
}

const HEIGHT = { sm: "h-1", md: "h-2" } as const;

const TRACK = {
  block: "block min-w-0 flex-1",
  inline: "inline-block w-tap shrink-0 align-middle",
} as const;

const WRAP = {
  block: "flex",
  inline: "inline-flex",
} as const;

export function Progress(props: ProgressProps) {
  const { label, value, max = 100, text, size = "sm", inline = false, className } = props;
  const form = inline ? "inline" : "block";
  const now = value == null ? undefined : clamp(value, max);

  const aria =
    label == null
      ? { "aria-hidden": true }
      : {
          role: "progressbar",
          "aria-label": label,
          "aria-valuemin": 0,
          "aria-valuemax": max,
          ...(now == null ? {} : { "aria-valuenow": now }),
        };

  const track = (
    <span
      {...aria}
      className={cn("overflow-hidden rounded-full bg-surface-3", HEIGHT[size], TRACK[form], text == null && className)}
    >
      {now == null ? (
        <span className="block h-full w-1/3 bg-accent motion-safe:animate-progress motion-reduce:w-full motion-reduce:bg-faint" />
      ) : (
        <span className="block h-full bg-accent" style={{ width: `${percent(now, max)}%` }} />
      )}
    </span>
  );

  if (text == null) return track;
  return (
    <span className={cn(WRAP[form], "min-w-0 items-center gap-2", className)}>
      {track}
      <span className="shrink-0 t-data text-data-s text-dim">{text}</span>
    </span>
  );
}
