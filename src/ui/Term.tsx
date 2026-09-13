import type { ReactNode } from "react";
import { useState } from "react";
import { cva } from "./cn";

const term = cva(
  "term-tip relative inline-flex cursor-help items-center [border-bottom-style:dotted] border-b-faint font-data text-data-s text-dim",
  {
    variants: {
      chip: {
        true: "rounded-sm border border-edge px-2 py-[2px]",
        false: "border-b has-[svg]:border-b-transparent",
      },
    },
    defaultVariants: { chip: false },
  },
);

/** A word or icon that explains itself in place, on hover, focus or tap. */
export function Term(props: {
  tip: string;
  children: ReactNode;
  chip?: boolean;
  /** -1 takes it out of the tab order, for a Term inside a roving composite. */
  tabIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={term({ chip: props.chip })}
      tabIndex={props.tabIndex ?? 0}
      data-tip={props.tip}
      data-open={open || undefined}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(!open);
      }}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {props.children}
    </span>
  );
}
