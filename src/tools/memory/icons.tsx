// Memory-domain rendering wrappers over the glyph tables (TYPE_ICON / OP_ICON /
// DECISION_ICON) in the central registry at src/ui/icons.tsx: the hue span, the
// default sizes, the aria treatment.
//
// Op semantics, for picking an icon: script = the whole note (a bundle of
// sections), file = one section; the shared + marks the two additive ops; the
// pencil marks the one op that replaces instead of adds. The decision family is
// reserved, as is the flag (exception flags only) — no op or type icon may take
// either. What the decision family reserves is the INTERIOR MARK on a solid
// round outline — a tick or a cross — plus the 12-dot dotted circle that means
// undecided. A round glyph holding anything else — the chat_summary speech
// tail, an `i`, an `!`, a segmented arc — is a different object and is free.

import { TYPE_ICON, OP_ICON, DECISION_ICON, type Icon as IconC } from "../../ui/icons";
import type { Mutation } from "./api/types";

/** Type icon in the note's categorical hue. Decorative next to a title. */
export function TypeIcon(props: { type: string; size?: number }) {
  const I = TYPE_ICON[props.type] ?? TYPE_ICON.source;
  return (
    <span className={`ti type-${props.type}`} aria-hidden="true">
      <I size={props.size ?? 15} stroke={1.75} />
    </span>
  );
}

export function OpIcon(props: { kind: Mutation["kind"]; size?: number }) {
  const I: IconC = OP_ICON[props.kind];
  return <I size={props.size ?? 14} stroke={1.75} aria-hidden />;
}

export function DecisionIcon(props: { d: "keep" | "drop" | null | undefined; size?: number }) {
  const state = props.d ?? "undecided";
  const I = DECISION_ICON[state];
  return (
    <span className={`dec dec-${state}`} aria-hidden="true">
      <I size={props.size ?? 17} stroke={1.75} />
    </span>
  );
}
