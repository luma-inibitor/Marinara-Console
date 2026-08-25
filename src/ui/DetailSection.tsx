import type { ReactNode } from "react";
import { SectionKey } from "./SectionKey";
import "./DetailSection.css";

/** One section of a memory — §core, §appearance — with its heading and body.
 *
 *  `meta` is the trailing run — a character count, a control. `meter` is the
 *  fill bar that belongs under the heading when the section has a cap. */
export function DetailSection(props: {
  sectionKey: string;
  meta?: ReactNode;
  meter?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dsec ${props.className ?? ""}`}>
      <h4 className="dsec-head t-label t-label-s">
        <SectionKey k={props.sectionKey} />
        {props.meta}
      </h4>
      {props.meter}
      {props.children}
    </section>
  );
}
