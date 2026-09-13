/* eslint-disable better-tailwindcss/no-unknown-classes, local/no-class-strings -- legacy */
import type { ReactNode } from "react";

/** The nothing-here state, with an optional icon, a title, an explanation and actions. */

type Tone = "ok" | "danger";

// Tone colours the icon only, so every toned state still says what happened in its title.
const ICON: Record<string, string> = {
  "": "text-faint",
  ok: "text-ok",
  danger: "text-danger",
};

export function EmptyState(props: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="emptystate px-4 py-5 text-center text-dim">
      {props.icon && (
        <span className={`mb-[9px] inline-flex ${ICON[props.tone ?? ""]}`} aria-hidden>
          {props.icon}
        </span>
      )}
      <div className="mb-[5px] font-label text-prose font-[650] text-ink">{props.title}</div>
      {props.body && <p className="mx-auto max-w-[52ch] font-prose text-data [&_b]:text-ink">{props.body}</p>}
      {props.actions && <div className="mt-3 flex flex-wrap justify-center gap-2">{props.actions}</div>}
    </div>
  );
}
