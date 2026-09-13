/** A fraction of a maximum, drawn as a track with a fill. */
import { cn } from "./cn";

type MeterTone = "accent" | "ok" | "warn" | "danger" | "flag";

export type MeterSegment = { value: number; tone: MeterTone };

export type MeterProps = {
  label?: string;
  max: number;
  value?: number;
  near?: number;
  over?: number;
  segments?: MeterSegment[];
  size?: "sm" | "md";
  className?: string;
};

export type Band = "under" | "near" | "over";

export function percent(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(100, (value / max) * 100);
}

export function band(value: number, max: number, near?: number, over?: number): Band {
  if (!(max > 0)) return "under";
  const ratio = value / max;
  if (over != null && ratio >= over) return "over";
  if (near != null && ratio >= near) return "near";
  return "under";
}

const BAND_TONE: Record<Band, MeterTone> = { under: "accent", near: "flag", over: "danger" };

const FILL: Record<MeterTone, string> = {
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  flag: "bg-flag",
};

const HEIGHT = { sm: "h-1", md: "h-2" } as const;

export function Meter(props: MeterProps) {
  const { label, max, value = 0, near, over, size = "sm", className } = props;
  const segments = props.segments ?? [{ value, tone: BAND_TONE[band(value, max, near, over)] }];
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  const aria =
    label == null
      ? { "aria-hidden": true }
      : {
          role: "meter",
          "aria-label": label,
          "aria-valuemin": 0,
          "aria-valuemax": max,
          "aria-valuenow": Math.min(total, max),
        };

  return (
    <span {...aria} className={cn("flex min-w-0 overflow-hidden rounded-full bg-surface-3", HEIGHT[size], className)}>
      {segments.map((s, i) => (
        <span
          key={i}
          className={cn("block h-full shrink-0", FILL[s.tone])}
          style={{ width: `${percent(s.value, max)}%` }}
        />
      ))}
    </span>
  );
}
