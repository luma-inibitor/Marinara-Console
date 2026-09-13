import type { ReactNode } from "react";
import { cn, cva, type VariantProps } from "../../../ui/cn";

/** The surface the card is painted on. */
export const groundBg = cva("", { variants: { ground: { canvas: "bg-canvas", raised: "bg-surface-1" } } });

export type Ground = NonNullable<VariantProps<typeof groundBg>["ground"]>;

/** One step up from the ground. */
export const raisedBg = cva("", { variants: { ground: { canvas: "bg-surface-1", raised: "bg-surface-2" } } });

export const raisedHover = cva("", {
  variants: { ground: { canvas: "hover:bg-surface-1", raised: "hover:bg-surface-2" } },
});

/** Opaque ground over the gap a sticky repaint opens. */
export const seam = cva("", {
  variants: {
    ground: { canvas: "shadow-[0_-3px_0_0_var(--canvas)]", raised: "shadow-[0_-3px_0_0_var(--surface-1)]" },
  },
});

export const DL =
  "m-0 grid grid-cols-[minmax(64px,auto)_minmax(0,1fr)] items-center gap-x-3 gap-y-[7px] font-data text-data-s";

/** A stored string that reads as a label. */
export const PILL =
  "inline-flex min-h-6 shrink-0 items-center whitespace-nowrap rounded-md border border-edge bg-surface-1 px-[10px] font-data text-data-s text-ink";

/** A linked note and the link inside it. */
export const TARGET = "inline-flex min-w-0 items-center gap-[5px]";
export const TARGET_LINK = "inline-block min-h-6 max-w-full truncate leading-6";

export function Sep({ className }: { className?: string }) {
  return (
    <i aria-hidden className={cn("text-edge-strong not-italic", className)}>
      ·
    </i>
  );
}

/** A run item kept on one line with its separator. */
export function After({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-x-[6px]", className)}>
      <Sep />
      {children}
    </span>
  );
}

/** A catalog word as a key. */
export function Word({ children }: { children: string }) {
  return <span className="lowercase">{children}</span>;
}

/** One key and its value in a `DL` grid. */
export function Pair(props: { k: ReactNode; top?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className={cn("text-dim", props.top && "self-start pt-[2px]")}>{props.k}</dt>
      <dd className="m-0 min-w-0">{props.children}</dd>
    </>
  );
}
