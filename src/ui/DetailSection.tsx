import type { ComponentChildren } from "preact";
import "./DetailSection.css";

/** One section of a memory — §core, §appearance — with its heading and body.
 *
 *  The §key is an address, not a title: mono, text tone, and never accent,
 *  because accent means interactive and a §key is not a link (owner,
 *  2026-08-22). It is written the same way in every surface that shows one.
 *  Before this component the vault wrote section keys as uppercase labels
 *  while the peek and the detail pane wrote them as §keys, so the same
 *  address looked like two different things depending on where you met it.
 *
 *  `meta` is the trailing run — a character count, a control. `meter` is the
 *  fill bar that belongs under the heading when the section has a cap. */
export function DetailSection(props: {
  sectionKey: string;
  meta?: ComponentChildren;
  meter?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <section class={`dsec ${props.class ?? ""}`}>
      <h4 class="dsec-head t-label t-label-s">
        <span class="skey">§{props.sectionKey}</span>
        {props.meta}
      </h4>
      {props.meter}
      {props.children}
    </section>
  );
}
