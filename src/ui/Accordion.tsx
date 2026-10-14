/* eslint-disable local/no-raw-button -- an accordion header, stretched under its label so the help tip can sit inside the row */
import type { ReactNode } from "react";
import { useId } from "react";
import { t } from "../copy";
import { cn } from "./cn";
import { HelpTip } from "./HelpTip";
import { ChevronRight, ICON_SIZE } from "./icons";

/** A collapsible row of a settings card. The header carries the current value in the card's value column. */
export function Accordion(props: {
  label: string;
  /** The section's state while closed: a count, a value, or why it is unavailable. */
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  tip?: string;
  error?: boolean;
  /** `set` marks a value the user chose; `flag` and `danger` mark one that can stop the thing it describes. */
  summaryTone?: "set" | "flag" | "danger";
  /** Keeps the header reachable and closed; the summary says why. */
  unavailable?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const open = (props.open || !!props.error) && !props.unavailable;
  return (
    <section className="border-t border-edge first:border-t-0">
      <div
        className={cn(
          "relative grid min-h-tap grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2",
          "@md:grid-cols-[12rem_minmax(0,1fr)_auto]",
        )}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none",
            props.unavailable ? "cursor-default" : "hover:bg-surface-2",
          )}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          aria-labelledby={`${id}-label ${id}-summary`}
          aria-disabled={props.unavailable || undefined}
          onClick={() => {
            if (!props.unavailable) props.onToggle();
          }}
        />
        <span className="pointer-events-none relative flex min-w-0 items-center gap-2">
          <span id={`${id}-label`} className={cn("t-label text-ink", props.unavailable && "text-dim")}>
            {props.label}
          </span>
          {props.error && (
            <span className="t-data text-data-s text-danger" role="img" aria-label={t("ui.accordion.hasError")}>
              ●
            </span>
          )}
          {props.tip && <HelpTip className="pointer-events-auto" tip={props.tip} subject={props.label} />}
        </span>
        <span
          id={`${id}-summary`}
          className={cn(
            "pointer-events-none relative col-start-1 row-start-2 min-w-0 truncate t-data text-data",
            "@md:col-start-2 @md:row-start-1",
            props.summaryTone === "flag"
              ? "text-flag"
              : props.summaryTone === "danger"
                ? "text-danger"
                : props.summaryTone === "set"
                  ? "text-ink"
                  : "text-dim",
          )}
        >
          {props.summary}
        </span>
        <ChevronRight
          size={ICON_SIZE.sm}
          stroke={2}
          aria-hidden
          className={cn(
            "pointer-events-none relative col-start-2 row-start-1 text-dim transition-transform motion-reduce:transition-none",
            "@md:col-start-3",
            open && "rotate-90",
            props.unavailable && "opacity-45",
          )}
        />
      </div>
      {open && (
        <div id={`${id}-body`} className="flex flex-col gap-3 px-4 pt-1 pb-4">
          {props.children}
        </div>
      )}
    </section>
  );
}
