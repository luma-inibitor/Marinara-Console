import type { ComponentChildren } from "preact";
import "./EmptyState.css";

/** The nothing-here state: an optional icon, a title, an optional explanation,
 *  and optional actions.
 *
 *  One component for every flavour — loading, error, filtered-to-nothing,
 *  finished, and genuinely empty — because the console had grown two separate
 *  treatments (a bare centred paragraph and a richer icon pane) and which one
 *  a screen got was down to who wrote it. The parts are optional; the
 *  typography is not.
 *
 *  `tone` colours the icon only. It never carries meaning alone, so every
 *  toned state still says what happened in the title. */
export function EmptyState(props: {
  icon?: ComponentChildren;
  title: ComponentChildren;
  body?: ComponentChildren;
  actions?: ComponentChildren;
  tone?: "ok" | "danger";
}) {
  return (
    <div class="emptystate">
      {props.icon && (
        <span class={`es-icon ${props.tone ? `es-${props.tone}` : ""}`} aria-hidden>
          {props.icon}
        </span>
      )}
      <div class="es-title t-prose">{props.title}</div>
      {props.body && <p class="es-body t-prose dim">{props.body}</p>}
      {props.actions && <div class="es-acts">{props.actions}</div>}
    </div>
  );
}
