import type { ReactNode } from "react";
import { SectionKey } from "./SectionKey";

/** One section of a memory, with its heading, an optional meter, and a body. */

const HEAD = "mb-1 flex items-center gap-2 t-label t-label-s";

export function DetailSection(props: {
  sectionKey: string;
  /** The trailing run after the key, a count or a control. */
  meta?: ReactNode;
  /** The fill bar under the heading when the section has a cap. */
  meter?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["mt-3", props.className].filter(Boolean).join(" ")}>
      <h4 className={HEAD}>
        <SectionKey k={props.sectionKey} />
        {props.meta}
      </h4>
      {props.meter}
      {props.children}
    </section>
  );
}
