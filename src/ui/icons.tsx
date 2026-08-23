// The console's single icon import surface.
//
// This is the ONLY module in src/ that may import from "@tabler/icons-preact".
// Everything else imports a *semantic* name from here, so the question "which
// glyph means X" has exactly one answer and changing it is a one-line edit
// instead of a grep across seventeen files.
//
// ── The silhouette families (DESIGN.md §5, owner-decided; do not re-litigate)
//
//   circles      decision states ONLY — keep / drop / undecided
//   flag         exception flags ONLY
//   files+script content ops — script = the whole note, file = one section;
//                the shared + marks the two additive ops, the pencil marks the
//                one op that replaces instead of adds
//
// No icon may borrow another family's silhouette. That rule killed `flag-2`
// for status and a bare pencil for the edited mark. If you reach for a circle
// and you are not naming a decision, you have the wrong icon.
//
// Domain mappings that are *taxonomies* (note types, mutation ops, source
// kinds) live next to their meaning in this file too, keyed by the domain
// value rather than by glyph — callers pass meaning, never a component.

import {
  // disclosure + direction
  IconChevronRight, IconChevronDown, IconArrowRight, IconExternalLink,
  // search
  IconSearch,
  // actions
  IconCopy, IconCheck, IconPencil, IconWriting, IconPlus, IconX,
  IconDotsVertical, IconEye, IconCode,
  // signals
  IconInfoCircle, IconFlag, IconAlertTriangle, IconSparkles,
  // the decision family — circles, reserved
  IconCircleCheck, IconCircleX, IconCircleDashed,
  // empty states
  IconInbox, IconQuestionMark,
  // memory tool views
  IconFileImport, IconLibrary, IconListCheck,
  // chat modes
  IconMessage, IconMasksTheater, IconDeviceGamepad2,
  // source kinds
  IconBook2, IconMessageCircle,
  // note types
  IconUser, IconHeartHandshake, IconTimelineEvent, IconPin,
  IconWorld, IconMusic, IconDatabase, IconMovie, IconUsers,
  // mutation ops — the files/script family
  IconScriptPlus, IconFilePlus, IconFilePencil, IconLinkPlus, IconTags,
  IconActivity,
  // source freshness
  IconRefreshAlert, IconAdjustments, IconUnlink,
  type Icon,
} from "@tabler/icons-preact";

export type { Icon };

/** The size scale, read off the 63 call sites that existed before it did.
 *  Stroke is 1.75 everywhere except the small glyphs, which need 2+ to stay
 *  legible — `strokeFor` encodes that rather than leaving it to each caller. */
export const ICON_SIZE = {
  xs: 12,   // inline help, cost, fold markers, small actions
  sm: 13,   // inline body glyphs, chevrons, flags
  md: 14,   // row glyphs, search bar, disclosure triggers
  lg: 15,   // nav tabs, group headers, bulk actions
  xl: 16,   // kebab, modal headers
  hero: 22, // empty-state icons — 11/11 consistent before this existed
} as const;

export type IconSize = keyof typeof ICON_SIZE;

/** Small glyphs need a heavier stroke to survive at 11–13px. */
export function strokeFor(size: number): number {
  return size <= 13 ? 2 : 1.75;
}

// ── Semantic names ──────────────────────────────────────────────────
// Grouped by what they MEAN. Two names may point at one glyph when the
// concepts are genuinely the same thing seen twice; they must never point at
// one glyph because nobody checked.

// disclosure + direction
export const ChevronRight = IconChevronRight;   // collapsed / drill in
export const ChevronDown = IconChevronDown;     // expanded
export const Forward = IconArrowRight;          // forward navigation on an action
export const ExternalLink = IconExternalLink;   // leaves for another tool

// search
export const Search = IconSearch;               // the live search affordance
export const NoMatches = IconSearch;            // empty state: filtered to nothing

// actions
export const Copy = IconCopy;
export const Copied = IconCheck;                // transient copy confirmation
export const Confirm = IconCheck;               // commit / checkbox tick
export const Edit = IconPencil;                 // the "edit" ACTION
export const EditedMark = IconWriting;          // "edited by you" STATE.
                                                // Not a pencil: bare pencil
                                                // collides with file-pencil's
                                                // silhouette (BACKLOG 2026-08-21).
export const Add = IconPlus;
export const Remove = IconX;
export const More = IconDotsVertical;           // kebab / overflow
export const Preview = IconEye;                 // show the rendered thing
export const Raw = IconCode;                    // show the source thing

// signals
export const Info = IconInfoCircle;             // help text, always this one
export const Flag = IconFlag;                   // exception flags + computed outliers
export const Alert = IconAlertTriangle;         // failure
export const Cost = IconSparkles;               // spends model calls

// the decision family — circles, reserved (see header)
export const DECISION_ICON: Record<"keep" | "drop" | "undecided", Icon> = {
  keep: IconCircleCheck,
  drop: IconCircleX,
  undecided: IconCircleDashed,
};

// empty states
export const FirstRun = IconInbox;              // nothing added yet
export const Missing = IconQuestionMark;        // record does not exist
export const AllClear = IconCircleCheck;        // empty state: everything handled.
                                                // Borrows the decision family's
                                                // circle today, which the header
                                                // rule says it should not — known
                                                // DESIGN.md tension, flagged for
                                                // the owner. Glyph unchanged for
                                                // now so the refactor stays pure.

// memory tool views. `database` is taken — it is the source-note type icon.
export const VIEW_ICON: Record<string, Icon> = {
  sources: IconFileImport,
  vault: IconLibrary,
  review: IconListCheck,
};

// chat modes — exactly three exist
export const MODE_ICON: Record<string, Icon> = {
  conversation: IconMessage,
  roleplay: IconMasksTheater,
  game: IconDeviceGamepad2,
};

// source kinds
export const SOURCE_KIND_ICON: Record<string, Icon> = {
  lorebook: IconBook2,
  chat_summary: IconMessageCircle,
  character: IconUser,
};

// scope levels — the same two objects the scope bar walks
export const SCOPE_ICON: Record<string, Icon> = {
  character: IconUser,
  chat: IconMessageCircle,
};

// source freshness. Open design item (BACKLOG: "Sources freshness icons");
// the mapping is centralised here so revisiting it is one edit.
export const SOURCE_STATE_ICON: Record<string, Icon> = {
  current: IconCheck,
  source_updated: IconRefreshAlert,
  context_updated: IconAdjustments,
  extraction_incomplete: IconAlertTriangle,
  source_missing: IconUnlink,
};

// note types — the eight in MEMORY-SCHEMA.md
export const TYPE_ICON: Record<string, Icon> = {
  character: IconUser,
  relationship: IconHeartHandshake,
  timeline_event: IconTimelineEvent,
  thread: IconPin, // needle-thread rejected: illegible at 14px (Luma 2026-08-21)
  world: IconWorld,
  tone: IconMusic,
  source: IconDatabase,
  scene: IconMovie,
};

// mutation ops — the files/script family
export const OP_ICON: Record<string, Icon> = {
  create_note: IconScriptPlus,
  append_section: IconFilePlus,
  update_section: IconFilePencil,
  add_link: IconLinkPlus,
  set_keywords: IconTags,
  set_status: IconActivity,
  set_subjects: IconUsers,
};

/** Render a registry glyph at a scale step. Decorative by default: an icon
 *  that repeats a label next to it must not be read out twice. */
export function Glyph(props: {
  icon: Icon;
  size?: number;
  stroke?: number;
  class?: string;
  label?: string;
}) {
  const I = props.icon;
  const size = props.size ?? ICON_SIZE.md;
  return (
    <I
      size={size}
      stroke={props.stroke ?? strokeFor(size)}
      class={props.class}
      aria-hidden={props.label ? undefined : true}
      aria-label={props.label}
    />
  );
}

export const Pending = IconCircleDashed;        // "work still waiting on you".
                                                // Like `AllClear`, this borrows
                                                // the reserved decision-family
                                                // circle — known DESIGN.md
                                                // tension, flagged for the
                                                // owner. Glyph unchanged for
                                                // now so the refactor stays pure.
