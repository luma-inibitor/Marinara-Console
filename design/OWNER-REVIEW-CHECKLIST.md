# Owner review checklist — DRAFT, awaiting Luma's review

**Status: PROPOSED. Do not treat as canon until Luma has reviewed each item.**
This distills Luma's UI/UX feedback (2026-08-21 sessions) into checkable
invariants so automated reviewers can catch regressions and repeat offenses.
Each item carries: the invariant, how a reviewer checks it, and the feedback
it came from. Corrections belong in this file, not in reviewers' heads.

Relationship to DESIGN.md: DESIGN.md is the framework; this is the
owner-feedback ledger in enforceable form. Items that prove durable should
graduate into DESIGN.md §2 (owner preferences); this file then references,
never restates.

## L · Layout and slot discipline

- **L1 · Fixed slot order in repeated rows/headers.** Conditional elements
  (badges, action buttons) must not shift the horizontal position of shared
  elements across sibling rows. Absent ≠ reflow: reserve the slot or anchor
  conditionals at line end. *Check: render sibling rows with and without
  optional elements; assert shared fields align column-wise.* (Group-header
  feedback, 3:21 PM.)
- **L2 · Titles get the full row width, then truncate.**
  A long title must not be squeezed into a narrow column beside chips.
  *Check: render with a 30+ char title; assert one line, ellipsised, and no
  column narrower than ~60% of the row.*
- **L3 · Bars sit flush with their viewport edge.** No stale offsets
  reserving space for chrome that is not there; safe-area padded. *Check:
  bottom bar's bottom == viewport bottom (or the visible dock top).*
  (Prototype mobile round 1.)
- **L4 · Bars flow as info-line-then-actions.** Status text gets its own
  line/region; buttons form a clean wrapping row with non-wrapping labels.
  (Round 1.)
- **L5 · Control rows (filter/group/sort) are sticky** under the header on
  scrollable lists. (Round 1.)
- **L6 · Sticky layers may not reveal content through seams** while
  scrolling on device — guard strips/overlap required; verify on real
  Android, not only headless. (3:21 PM sticky-gap report.)
- **L7 · Equal control heights within an action row**; exactly one filled
  primary per row. *Check: measure button heights in every .group-actions /
  dock; assert equal; count primary-styled ≤1.* (Vault editor 3:03 PM.)
- **L8 · Full option visibility for small enums.** An enum with ≤5 values
  the user can change renders as a one-tap segmented control showing every
  state — not a dropdown. (Status feedback 3:03 PM; DESIGN §5 segmented.)
- **L9 · Mode eligibility renders as the fixed three-segment pill**
  (conversation/DM · RP · GM/game), constant width, active/inactive per
  segment, wherever modes appear. (Interview Q6 — pill itself not yet
  built; checklist item activates with it.)

## V · Vocabulary and copy

- **V1 · Schema words, no synonyms.** When the engine schema names a
  concept (`rewrite`, `merge`, `new`, freshness values…), the UI uses that
  word. Never invent a parallel term (`overwrites`, `diff`) for the same
  concept. Coined words are allowed only for concepts the product lacks,
  and only via the strings.ts OURS table with a rationale. *Check: grep UI
  strings against the schema/product vocabulary list; flag near-synonyms.*
  (DIFF/overwrite feedback, 3:15 PM.)
- **V2 · Every count names a user-meaningful unit, consistently.** A badge
  or number must answer a question the user has, in the unit the
  surrounding UI uses; engine packaging (drafts vs claims) must not leak
  into surfaces speaking the other unit. *Check: for each rendered count,
  state its unit; assert siblings agree.* (Badge 2-vs-17, 2:18 PM; STORED·2,
  3:21 PM.)
- **V3 · A badge must earn its tap.** If tapping/expanding an indicator
  yields content the user can't map to a question ("what changes where?"),
  the indicator is wrong — redesign toward the question (e.g. touch map
  instead of stored-section count). (3:21 PM.)
- **V4 · No mechanism-explainer furniture.** Don't permanently teach
  mechanics the numbers already show (cap explainer under counts, rebuild
  trivia). Guidance lives at the failure/decision site, once. *Check: flag
  static explanatory paragraphs under forms.* (3:03 PM #4.)
- **V5 · Empty states name this view's condition and the next action** —
  never another screen's string, never onboarding copy over a filtered-empty
  result. (UX review adopted; owner-confirmed direction.)

## I · Interaction

- **I1 · Tap = open.** On touch, tapping a list row opens its detail;
  keyboard-only paths (Enter) must have a touch twin. *Check: tap row at
  390px, assert detail visible.* (2:18 PM bug ×3 reviewers.)
- **I2 · Non-interactive facts must not wear interactive styling.**
  Bordered chip/button skins are reserved for things that respond to a tap.
  *Check: for each chip-styled element, assert a click handler exists.*
  (Type chip, 3:21 PM.)
- **I3 · Object references navigate.** Anything naming a note/source/claim
  is a link to it (peek or view), with a way back. (Round 1; linkage
  review.)
- **I4 · Workflow handoff after success.** When an action completes and the
  natural next step is another surface, offer it in the result (import →
  pre-filtered review). (Round 1.)
- **I5 · Overlays close by back gesture AND Escape regardless of focus**,
  and restore focus. One overlay stack owns this. (Mobile round + a11y
  review; owner-experienced.)
- **I6 · Mobile control rail is [Filter] [Group] [Sort]** as constant-width
  buttons carrying their state (count / current key + direction), quick
  chips after, sort direction togglable. (2:18 PM + Q7.)
- **I7 · Single-click for cheap reversible changes** (status flips): apply
  optimistically with undo/rollback — not staged behind Save. (3:03 PM.)

## S · Separation of concerns in detail views

- **S1 · Object properties vs proposal properties never mix in one block.**
  A change-review detail separates: what the proposal does, the affected
  object's pre-existing state, and the proposal's own metadata. (3:18 PM.)
- **S2 · Pre-existing vs proposed text is always explicitly labeled**
  (stored/proposed zone treatment) — a reader must never infer which is
  which from position alone. (3:18 PM.)

## T · Typography

- **T1 · Hierarchy between a label and its metadata.** Section titles carry
  the visual weight; counts/limits are quiet right-aligned gutters — never
  the same run of text at the same weight. (3:03 PM.)

## H · Health and history (directional, from interview)

- **H1 · "Unhealthy" includes accumulation**: archived/resolved pile-up is
  a health signal, and any health state shown must say what the user should
  do about it. (Q3.)
- **H2 · Write activity is revisitable**: imports and applies persist a
  history (kept/discarded per entry, expandable) — not transient result
  cards. (Q4 — feature pending; checklist item activates with it.)

## How reviewers should use this

Cite the item ID in findings ("violates L1"). If a screen can't satisfy an
item, the finding should say why, not silently skip. When Luma's live
feedback contradicts this file, the file is wrong: update it in the same
change and flag the diff for review.

## Open questions for Luma (before this becomes canon)

1. V1: is "no synonyms" absolute, or acceptable when the schema word is
   user-hostile? (Current rule: schema word wins; plain-language gloss goes
   in a subline, never replaces.)
2. L8's threshold (≤5 values → segmented): right cut-off?
3. I7's scope: which changes count as "cheap" enough for optimistic
   single-click? (Current read: single-field enum/toggle PATCHes with easy
   rollback.)
4. Anything here that misreads what you meant?
