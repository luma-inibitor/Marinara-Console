import type { ComponentChildren } from "preact";
import "./EmptyState.css";

/** The nothing-here state: an optional icon, a title, an optional explanation,
 *  and optional actions. One component for every shade of empty — filtered to
 *  nothing, finished, nothing selected, never had anything.
 *
 *  Waiting and failing are `Loading` and `ErrorState` instead: same shape,
 *  different roles, and §8 splits on role.
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
    <div className="emptystate">
      {props.icon && (
        <span className={`es-icon ${props.tone ? `es-${props.tone}` : ""}`} aria-hidden>
          {props.icon}
        </span>
      )}
      <div className="es-title t-prose">{props.title}</div>
      {props.body && <p className="es-body t-prose dim">{props.body}</p>}
      {props.actions && <div className="es-acts">{props.actions}</div>}
    </div>
  );
}
