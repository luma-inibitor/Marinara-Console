import type { ReactNode } from "react";
import { ICON_SIZE, Info } from "./icons";

/** A line of help text, always led by the information icon. */
export function Edu({ children }: { children: ReactNode }) {
  return (
    <p className="mt-[6px] flex items-start gap-[5px] font-prose text-data text-dim">
      <Info size={ICON_SIZE.xs} stroke={1.75} className="mt-[2px] shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
