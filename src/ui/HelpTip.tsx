/* eslint-disable local/no-raw-button -- the help trigger, which owns its tooltip */
import type { KeyboardEvent } from "react";
import { useId, useState } from "react";
import { t } from "../copy";
import { cn } from "./cn";
import { ICON_SIZE, Info } from "./icons";

const TIP =
  "invisible absolute top-[calc(100%_+_6px)] z-70 w-max max-w-[260px] rounded-sm border border-edge-strong " +
  "bg-surface-3 px-[9px] py-[6px] text-left font-prose text-data-s leading-[1.45] whitespace-normal text-ink shadow-pop " +
  "group-focus-within:visible group-hover:visible";

/** The information icon beside a heading; its text shows on hover, focus or tap. */
export function HelpTip(props: {
  tip: string;
  /** What the help is about, as in "About Primary Keys". */
  subject: string;
  /** The side the tooltip lines up with: `end` near the right edge of a panel. */
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const onKeyDown = (ev: KeyboardEvent<HTMLButtonElement>) => {
    if (ev.key === "Escape" && open) {
      ev.stopPropagation();
      setOpen(false);
    }
  };
  return (
    <span className={cn("group relative inline-flex shrink-0", props.className)}>
      <button
        type="button"
        className={cn(
          "inline-grid size-6 place-items-center rounded-sm text-dim hover:text-ink",
          "focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none aria-expanded:text-ink",
        )}
        aria-label={t("infopopover.aboutValue1", { value1: props.subject })}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(ev) => {
          ev.stopPropagation();
          setOpen(!open);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      >
        <Info size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
      </button>
      <span id={id} role="tooltip" className={cn(TIP, props.align === "end" ? "right-0" : "left-0", open && "visible")}>
        {props.tip}
      </span>
    </span>
  );
}
