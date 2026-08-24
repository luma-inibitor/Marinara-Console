import type { ReactNode } from "react";
import { Info } from "./icons";
import "./Edu.css";

/** A line of help text. Help text gets the information icon, every time, the
 *  same icon (design/CHECKLIST.md §2) — so the icon lives here rather than at
 *  the call site. */
export function Edu({ children }: { children: ReactNode }) {
  return (
    <p className="edu t-prose dim">
      <Info size={12} stroke={1.75} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
