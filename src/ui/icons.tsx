// The console's single icon import surface.
//
// This is the ONLY module in src/ that may import from "@tabler/icons-react".
// Everything else imports a *semantic* name from here.
//
// Reserved silhouette families (DESIGN.md §5) — no icon may borrow another
// family's silhouette:
//
//   decision     decision states ONLY (keep / drop / undecided). What is
//                reserved is the INTERIOR MARK on a round outline: a solid
//                circle holding a tick or a cross, plus the 12-dot dotted
//                circle. A round outline holding anything else — an `i`, an
//                `!`, an arc, a speech tail — is a different object and is
//                free, as is the 5-segment `progress-*` arc family and the
//                8-segment dashed circle.
//   flag         exception flags ONLY
//   files+script content ops — script = the whole note, file = one section;
//                the shared + marks the two additive ops, the pencil marks the
//                one op that replaces instead of adds
//
// If you reach for a round glyph whose interior is a tick, a cross, or the
// dotted edge, and you are not naming a decision, you have the wrong icon.
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
  // affordances
  IconArrowsDiagonal, IconStar, IconCheckbox, IconHash, IconSelector,
  type Icon,
} from "@tabler/icons-react";

export type { Icon };

/** The size scale. Stroke is 1.75 everywhere except the small glyphs, which
 *  need 2+ to stay legible; call sites pass `stroke={2}` at xs/sm. */
export const ICON_SIZE = {
  xs: 12,   // inline help, cost, fold markers, small actions
  sm: 13,   // inline body glyphs, chevrons, flags
  md: 14,   // row glyphs, search bar, disclosure triggers
  lg: 15,   // nav tabs, group headers, bulk actions
  xl: 16,   // kebab, modal headers
  hero: 22, // empty-state icons
} as const;

// ── Semantic names ──────────────────────────────────────────────────
// Grouped by what they MEAN. Two names may point at one glyph only when the
// concepts are genuinely the same thing seen twice.

// disclosure + direction
export const ChevronRight = IconChevronRight;   // collapsed / drill in
export const Back = IconChevronLeft;            // up one level in a mobile stack
export const ChevronDown = IconChevronDown;     // expanded
export const ExpandSet = IconSelector;          // opens or closes a whole SET
                                                // of rows at once. Deliberately
                                                // not the row chevron: a
                                                // control that acts on the set
                                                // must not read as one more
                                                // member of it.
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
export const EditedMark = IconWriting;          // "edited by you" STATE
export const Add = IconPlus;
export const Remove = IconX;
export const More = IconDotsVertical;           // kebab / overflow
export const Refresh = IconRefresh;             // re-fetch what is already here
export const Download = IconDownload;           // hand the user a file
export const Preview = IconEye;                 // show the rendered thing
export const Raw = IconCode;                    // show the source thing
export const Close = IconX;                     // dismiss a SURFACE (sheet,
                                                // modal, toast). Shares
                                                // `Remove`'s glyph; the names
                                                // differ because Close takes a
                                                // surface away and Remove takes
                                                // an ITEM out of a set.
export const Fullscreen = IconArrowsDiagonal;   // open this field in the
                                                // fullscreen text editor
export const Duplicate = IconCopy;              // make a second copy of a
                                                // record. Shares `Copy`'s
                                                // glyph: both are "make another
                                                // one of this".
export const SetDefault = IconStar;             // mark the record the app
                                                // reaches for when unasked
export const SelectMode = IconCheckbox;         // enter multi-select on a list
export const Tags = IconHash;                   // the tag DISTRIBUTION panel.
                                                // Not IconTags — that names the
                                                // `set_keywords` mutation op.

// signals
export const Info = IconInfoCircle;             // help text, always this one
export const Flag = IconFlag;                   // exception flags + computed outliers
export const Cost = IconSparkles;               // spends model calls

// ── the state signals ───────────────────────────────────────────────
// One glyph per state, so a banner, a row mark and an empty state that all
// report the same condition look like the same condition.
export const Failure = IconAlertCircle;         // error: the thing did not work
export const Incomplete = IconAlertTriangle;    // an extraction that stopped
                                                // short — not a failure, a
                                                // partial harvest that needs
                                                // re-running
// PartialResult and Degraded have no call site yet. They are the state-signal
// vocabulary DESIGN.md §207 commits to; use these rather than a new glyph.
export const PartialResult = IconProgressX;     // partial: some of the batch
                                                // landed, some did not
export const Degraded = IconProgressAlert;      // degraded: it ran, but on a
                                                // fallback path or with a
                                                // reduced guarantee
export const ValidationOk = IconZoomCheck;      // an *inspection* passed — not
                                                // `Confirm`'s "you ticked this"
                                                // nor `AllClear`'s "nothing is
                                                // left"
// loading → no icon. Loading.tsx carries none: a spinner that is also a glyph
//           reads as a state you can act on, and you cannot.

// the decision family — the reserved interiors (see header)
export const DECISION_ICON: Record<"keep" | "drop" | "undecided", Icon> = {
  keep: IconCircleCheck,
  drop: IconCircleX,
  // circle-dotted, not circle-dashed: 8 dashes are the same arc vocabulary as
  // the `progress-*` family, so a dashed circle collides with it.
  undecided: IconCircleDotted,
};

// empty states
export const FirstRun = IconInbox;              // nothing added yet
export const Missing = IconQuestionMark;        // record does not exist
export const AllClear = IconChecks;             // nothing is left in this set.
                                                // The double tick counts a whole
                                                // set, where `Confirm` (single
                                                // check) ticks one thing.

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

// source freshness
export const SOURCE_STATE_ICON: Record<string, Icon> = {
  current: IconCheck,
  source_updated: IconRefreshAlert,
  context_updated: IconAdjustments,
  extraction_incomplete: Incomplete,   // the triangle: an extraction that
                                       // stopped short is not a failure
  source_missing: IconUnlink,
};

// note types — the eight in MEMORY-SCHEMA.md
export const TYPE_ICON: Record<string, Icon> = {
  character: IconUser,
  relationship: IconHeartHandshake,
  timeline_event: IconTimelineEvent,
  thread: IconPin,
  world: IconWorld,
  tone: IconMusic,
  source: IconDatabase,
  // `scene` is a real schema type in MEMORY-SCHEMA.md; the live corpus has no
  // scene notes today, so this entry reads unused.
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

export const Pending = VIEW_ICON.review;        // "work still waiting on you".
                                                // Bound to the Review tab's
                                                // glyph so a pending count names
                                                // the destination it sends you to.
