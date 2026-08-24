import type { ReactNode } from "react";
import "./DetailSection.css";

/** One section of a memory — §core, §appearance — with its heading and body.
 *
 *  The §key is an address, not a title: mono, text tone, and never accent,
 *  because accent means interactive and a §key is not a link.
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
        <span className="skey">§{props.sectionKey}</span>
        {props.meta}
      </h4>
      {props.meter}
      {props.children}
    </section>
  );
}
