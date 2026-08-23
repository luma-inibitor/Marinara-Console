// The console's single icon import surface.
//
// This is the ONLY module in src/ that may import from "@tabler/icons-preact".
// Everything else imports a *semantic* name from here, so the question "which
// glyph means X" has exactly one answer and changing it is a one-line edit
// instead of a grep across seventeen files.
//
// ── The silhouette families (DESIGN.md §5, owner-decided; do not re-litigate)
//
//   decision     decision states ONLY — keep / drop / undecided. What is
//                reserved is the INTERIOR MARK on a SOLID round outline: a
//                solid circle holding a tick or a cross, plus the 12-dot
//                dotted circle that means undecided. A round outline holding
//                anything else (an `i`, an `!`, an arc, a speech tail) is a
//                different object and is free — info-circle, message-circle
//                and alert-circle are all fine. So is the whole `progress-*`
//                family: its 5-segment arc is a different visual vocabulary
//                from the dotted circle, so `progress-x` and `progress-alert`
//                no longer read as neighbours of undecided and drop. A DASHED
//                circle is likewise free — the decision family left it when
//                `undecided` moved to `circle-dotted`, precisely because
//                circle-dashed's 8 arc segments and progress-*'s 5 arc
//                segments are the same vocabulary and the two families were
//                colliding. Only the reserved interiors can be misread as a
//                decision, which is the whole point of the rule
//                — owner-decided 2026-08-23.
//   flag         exception flags ONLY
//   files+script content ops — script = the whole note, file = one section;
//                the shared + marks the two additive ops, the pencil marks the
//                one op that replaces instead of adds
//
// No icon may borrow another family's silhouette. That rule killed `flag-2`
// for status and a bare pencil for the edited mark. If you reach for a solid
// round glyph whose interior is a tick or a cross, or for the dotted circle,
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
  IconInfoCircle, IconFlag, IconAlertCircle, IconAlertTriangle, IconSparkles,
  IconProgressX, IconProgressAlert, IconZoomCheck,
  // the decision family — reserved interiors: tick / cross / dotted edge
  IconCircleCheck, IconCircleX, IconCircleDotted,
  // empty states
  IconInbox, IconQuestionMark, IconChecks,
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
  // navigation + transfer
  IconChevronLeft, IconRefresh, IconDownload,
  // affordances that were ad-hoc text glyphs before 2026-08-23
  IconArrowsDiagonal, IconStar, IconCheckbox, IconHash,
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
export const Back = IconChevronLeft;            // up one level in a mobile stack
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
export const Refresh = IconRefresh;             // re-fetch what is already here
                                                // (distinct from Retry, which
                                                // re-runs a FAILED action)
export const Download = IconDownload;           // hand the user a file
export const Preview = IconEye;                 // show the rendered thing
export const Raw = IconCode;                    // show the source thing
export const Close = IconX;                     // dismiss a SURFACE — sheet,
                                                // modal, toast, result card.
                                                // Same glyph as `Remove` on
                                                // purpose, and checked rather
                                                // than assumed: an X is the one
                                                // dismiss mark users already
                                                // read, and every Tabler
                                                // alternative (circle-x,
                                                // square-x) borrows the
                                                // reserved decision family.
                                                // Two names because the
                                                // concepts differ — Close takes
                                                // a surface away, Remove takes
                                                // an ITEM out of a set (a key
                                                // chip, a filter chip) — so if
                                                // one ever needs its own glyph
                                                // the call sites are already
                                                // sorted.
export const Fullscreen = IconArrowsDiagonal;   // open this field in the
                                                // fullscreen text editor
export const Duplicate = IconCopy;              // make a second copy of a
                                                // record. Shares `Copy`'s
                                                // glyph: both are "make another
                                                // one of this", the only
                                                // difference being where it
                                                // lands. copy-plus and files
                                                // were both rejected — the +
                                                // and the file shape belong to
                                                // the content-ops family.
export const SetDefault = IconStar;             // mark the record the app
                                                // reaches for when unasked
export const SelectMode = IconCheckbox;         // enter multi-select on a list.
                                                // A square, not a ticked round
                                                // glyph: that interior belongs
                                                // to the decision family.
export const Tags = IconHash;                   // the tag DISTRIBUTION panel.
                                                // Not IconTags — that is the
                                                // `set_keywords` mutation op,
                                                // and this opens a stats view
                                                // rather than changing anything.

// signals
export const Info = IconInfoCircle;             // help text, always this one
export const Flag = IconFlag;                   // exception flags + computed outliers
export const Cost = IconSparkles;               // spends model calls

// ── the state signals (owner-decided 2026-08-23) ────────────────────
// One glyph per state, so a banner, a row mark and an empty state that all
// report the same condition look like the same condition.
//
// `Failure` and `Incomplete` were one name (`Alert`, alert-triangle) doing two
// jobs: generic "this failed" and the source-freshness state
// `extraction_incomplete`. They are different concepts, so they are now
// different names — a failure is a circle, an incomplete extraction keeps the
// triangle. Splitting the names makes the split explicit at the call site.
export const Failure = IconAlertCircle;         // error: the thing did not work
export const Incomplete = IconAlertTriangle;    // an extraction that stopped
                                                // short — not a failure, a
                                                // partial harvest that needs
                                                // re-running
export const PartialResult = IconProgressX;     // partial: some of the batch
                                                // landed, some did not. The
                                                // progress arc is its own
                                                // vocabulary and no longer
                                                // collides with the decision
                                                // family (see header).
export const Degraded = IconProgressAlert;      // degraded: it ran, but on a
                                                // fallback path or with a
                                                // reduced guarantee
export const ValidationOk = IconZoomCheck;      // a check was performed and it
                                                // passed — the *inspection*
                                                // succeeded, which is not the
                                                // same as `Confirm`'s "you
                                                // ticked this" or `AllClear`'s
                                                // "there is nothing left"
// info    → `Info` above (info-circle), unchanged
// loading → no icon. Loading.tsx deliberately carries none: a spinner that is
//           also a glyph reads as a state you can act on, and you cannot.

// the decision family — the reserved interiors (see header)
export const DECISION_ICON: Record<"keep" | "drop" | "undecided", Icon> = {
  keep: IconCircleCheck,
  drop: IconCircleX,
  // circle-dotted, not circle-dashed: dashed is 8 arc segments and the
  // `progress-*` family is 5 arc segments — one vocabulary, so the decision
  // family and the progress family were colliding. 12 dots is a different
  // vocabulary and the collision is gone (owner-decided 2026-08-23).
  undecided: IconCircleDotted,
};

// empty states
export const FirstRun = IconInbox;              // nothing added yet
export const Missing = IconQuestionMark;        // record does not exist
export const AllClear = IconChecks;             // "all of them are handled" —
                                                // nothing is left in this set.
                                                // The double tick is the point:
                                                // it counts a whole set, where
                                                // `Confirm` (single check) ticks
                                                // one thing. No circle, so it
                                                // never reads as a decision
                                                // (owner-decided 2026-08-23).

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
  extraction_incomplete: Incomplete,   // the triangle, kept: an extraction
                                       // that stopped short is not a failure
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
  className?: string;
  label?: string;
}) {
  const I = props.icon;
  const size = props.size ?? ICON_SIZE.md;
  return (
    <I
      size={size}
      stroke={props.stroke ?? strokeFor(size)}
      className={props.className}
      aria-hidden={props.label ? undefined : true}
      aria-label={props.label}
    />
  );
}

export const Pending = VIEW_ICON.review;        // "work still waiting on you".
                                                // Deliberately the same binding
                                                // as the Review nav tab, not a
                                                // second one: this glyph means
                                                // "the review queue" in both
                                                // places, so a pending count
                                                // names the destination the
                                                // user should go to
                                                // (owner-decided 2026-08-23).
