// Icon vocabulary for the memory tool — decided with Luma 2026-08-21
// (mockups: public/mockups/layers-v4.html §S6 T5; BACKLOG "Op icon mapping").
//
// Op semantics: script = the whole note (a bundle of sections), file = one
// section; the shared + marks the two additive ops; the pencil marks the one
// op that replaces instead of adds. Circles are reserved for the decision
// family; the flag is reserved for exception flags — no op or type icon may
// use either silhouette.

import {
  IconScriptPlus, IconFilePlus, IconFilePencil, IconLinkPlus, IconTags,
  IconActivity, IconUsers,
  IconUser, IconHeartHandshake, IconTimelineEvent, IconPin,
  IconWorld, IconMusic, IconDatabase, IconMovie,
  IconCircleDashed, IconCircleCheck, IconCircleX,
  type Icon as IconC,
} from "@tabler/icons-preact";
import type { Mutation } from "./data";

const OP_ICON: Record<Mutation["kind"], IconC> = {
  create_note: IconScriptPlus,
  append_section: IconFilePlus,
  update_section: IconFilePencil,
  add_link: IconLinkPlus,
  set_keywords: IconTags,
  set_status: IconActivity,
  set_subjects: IconUsers,
};

const TYPE_ICON: Record<string, IconC> = {
  character: IconUser,
  relationship: IconHeartHandshake,
  timeline_event: IconTimelineEvent,
  thread: IconPin, // needle-thread rejected: illegible at 14px (Luma 2026-08-21)
  world: IconWorld,
  tone: IconMusic,
  source: IconDatabase,
  scene: IconMovie,
};

const DECISION_ICON: Record<"keep" | "drop" | "undecided", IconC> = {
  keep: IconCircleCheck,
  drop: IconCircleX,
  undecided: IconCircleDashed,
};

/** Type icon in the note's categorical hue. Decorative next to a title. */
export function TypeIcon(props: { type: string; size?: number }) {
  const I = TYPE_ICON[props.type] ?? IconDatabase;
  return (
    <span class={`ti type-${props.type}`} aria-hidden="true">
      <I size={props.size ?? 15} stroke={1.75} />
    </span>
  );
}

export function OpIcon(props: { kind: Mutation["kind"]; size?: number }) {
  const I = OP_ICON[props.kind];
  return <I size={props.size ?? 14} stroke={1.75} aria-hidden />;
}

export function DecisionIcon(props: { d: "keep" | "drop" | null | undefined; size?: number }) {
  const state = props.d ?? "undecided";
  const I = DECISION_ICON[state];
  return (
    <span class={`dec dec-${state}`} aria-hidden="true">
      <I size={props.size ?? 17} stroke={1.75} />
    </span>
  );
}
