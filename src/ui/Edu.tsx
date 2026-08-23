import type { ComponentChildren } from "preact";
import { Info } from "./icons";
import "./Edu.css";

/** A line of help text.
 *
 *  Help text gets the information icon, every time, the same icon
 *  (design/CHECKLIST.md §2). That rule existed before this component and was
 *  still broken twice — one help line had no icon, the next had a clock. Now
 *  the icon is not a thing anyone remembers to add. */
export function Edu({ children }: { children: ComponentChildren }) {
  return (
    <p class="edu t-prose dim">
      <Info size={12} stroke={1.75} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
