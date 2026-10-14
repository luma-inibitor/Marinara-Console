/* eslint-disable local/no-raw-button -- an accordion header spanning a summary line */
import type { ReactNode } from "react";
import { useId } from "react";
import { t } from "../copy";
import { cn } from "./cn";
import { HelpTip } from "./HelpTip";
import { ChevronRight, ICON_SIZE } from "./icons";

/** A collapsible section whose header carries its current value. */
export function Accordion(props: {
  label: string;
  /** The section's state while closed: a count, a value, or why it is unavailable. */
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  tip?: string;
  error?: boolean;
  /** Colours the summary when its value can stop the thing it describes; the text still says what. */
  summaryTone?: "flag" | "danger";
  /** Keeps the header reachable and closed; the summary says why. */
  unavailable?: boolean;
  children: ReactNode;
}) {
  const bodyId = useId();
  const open = (props.open || !!props.error) && !props.unavailable;
  return (
    <section className="border-b border-edge">
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          className={cn(
            "flex min-h-tap min-w-0 flex-1 items-center gap-2 pl-3 text-left",
            "focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none",
            props.unavailable ? "cursor-default" : "hover:bg-surface-1",
          )}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-disabled={props.unavailable || undefined}
          onClick={() => {
            if (!props.unavailable) props.onToggle();
          }}
        >
          <ChevronRight
            size={ICON_SIZE.sm}
            stroke={2}
            aria-hidden
            className={cn(
              "shrink-0 text-dim transition-transform motion-reduce:transition-none",
              open && "rotate-90",
              props.unavailable && "opacity-45",
            )}
          />
          <span
            className={cn(
              "shrink-0 t-label t-label-s whitespace-nowrap",
              open ? "text-ink" : "text-dim",
              props.unavailable && "opacity-60",
            )}
          >
            {props.label}
          </span>
          {props.error && (
            <span className="t-data text-data-s text-danger" role="img" aria-label={t("ui.accordion.hasError")}>
              ●
            </span>
          )}
          <span
            className={cn(
              "ml-auto min-w-0 truncate pl-2 text-right t-data text-data-s",
              props.summaryTone === "flag" ? "text-flag" : props.summaryTone === "danger" ? "text-danger" : "text-dim",
            )}
          >
            {props.summary}
          </span>
        </button>
        {props.tip && <HelpTip tip={props.tip} subject={props.label} align="end" />}
      </div>
      {open && (
        <div id={bodyId} className="flex flex-col gap-3 px-3 pt-2 pb-4">
          {props.children}
        </div>
      )}
    </section>
  );
}
