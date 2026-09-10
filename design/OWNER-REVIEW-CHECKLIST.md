# Owner review checklist — draft, awaiting Luma's review

**Status: proposed. Don't treat as canon until Luma reviews each item.**
This distills Luma's UI/UX feedback into checkable invariants so automated
reviewers can catch regressions and repeat offenses.
Each item carries: the invariant, how a reviewer checks it, and the feedback
it came from. Corrections belong in this file, not in reviewers' heads.

`design.md` is canon. This file is the owner-feedback ledger in enforceable
form. Items that prove durable graduate into `design.md` §3 (interaction), and
this file then references them rather than restating them.

## Layout and slot discipline

- **L1 · Fixed slot order in repeated rows/headers.** Conditional elements
  (badges, action buttons) must not shift the horizontal position of shared
  elements across sibling rows. Absent ≠ reflow: reserve the slot or anchor
  conditionals at line end. *Check: render sibling rows with and without
  optional elements. Assert shared fields align column-wise.* (Group-header
  feedback.)
- **L2 · Titles get the full row width, then truncate.**
  Chips must not squeeze a long title into a narrow column.
  *Check: render with a 30+ char title. Assert one line, ellipsised, and no
  column narrower than ~60% of the row.*
- **L3 · Bars sit flush with their viewport edge.** No stale offsets
  reserving space for chrome that's not there. Pad for the safe area. *Check:
  bottom bar's bottom == viewport bottom (or the visible dock top).*
  (Prototype mobile.)
- **L4 · Bars flow as info-line-then-actions.** Status text gets its own
  line or region. Buttons form a clean wrapping row with non-wrapping labels.
- **L5 · Control rows (filter/group/sort) are sticky** under the header on
  scrollable lists.
- **L6 · Sticky layers may not reveal content through seams** while
  scrolling on device. Guard strips or overlap required. Verify on real
  Android, not only headless. (Sticky-gap report.)
- **L7 · Equal control heights within an action row**, with exactly one filled
  primary per row. *Check: measure button heights in every .group-actions /
  dock. Assert equal heights and at most one primary-styled button.*
  (Vault editor.)
- **L8 · Full option visibility for small enums.** An enum with ≤5 values
  the user can change renders as a one-tap segmented control showing every
  state — not a dropdown. (Status feedback, DESIGN §5 segmented.)
- **L9 · Mode eligibility renders as the fixed three-segment pill**
  (conversation/DM · RP · GM/game), constant width, active/inactive per
  segment, wherever modes appear. (Interview Q6 — pill itself not yet
  built. Checklist item activates with it.)

## Vocabulary and copy

- **V1 · Schema words, no synonyms.** When the engine schema names a
  concept (`rewrite`, `merge`, `new`, freshness values…), the UI uses that
  word. Never invent a parallel term (`overwrites`, `diff`) for the same
  concept. Coin a word only for a concept the product lacks, and only via the
  `strings.ts` `OURS` table with a rationale. *Check: grep UI strings for
  near-synonyms of the schema vocabulary.* (DIFF/overwrite feedback.)
- **V2 · Every count names a user-meaningful unit, consistently.** A badge
  or number answers a question the user has, in the unit the surrounding UI
  uses. Engine packaging (drafts vs claims) must not leak into surfaces
  speaking the other unit. *Check: for each rendered count, state its unit and
  assert siblings agree.* (Badge 2-vs-17, STORED·2.)
- **V3 · A badge must earn its tap.** An indicator is wrong when tapping or
  expanding it yields content the user can't map to a question ("what changes
  where?"). Redesign toward the question: a touch map instead of a
  stored-section count.
- **V4 · No mechanism-explainer furniture.** Don't permanently teach
  mechanics the numbers already show (cap explainer under counts, rebuild
  trivia). Guidance lives at the failure/decision site, once. *Check: flag
  static explanatory paragraphs under forms.*
- **V5 · Empty states name this view's condition and the next action** —
  never another screen's string, never onboarding copy over a filtered-empty
  result. (UX review adopted, owner-confirmed direction.)

## Interaction

- **I1 · Tap = open.** On touch, tapping a list row opens its detail.
  Keyboard-only paths (Enter) must have a touch twin. *Check: tap row at
  390px, assert detail visible.* (Bug reported by 3 reviewers.)
- **I2 · Non-interactive facts must not wear interactive styling.**
  Bordered chip/button skins belong only to things that respond to a tap.
  *Check: for each chip-styled element, assert a click handler exists.*
  (Type chip.)
- **I3 · Object references navigate.** Anything naming a note/source/claim
  is a link to it (peek or view), with a way back. (Linkage review.)
- **I4 · Workflow handoff after success.** When an action completes and the
  natural next step is another surface, offer it in the result (import →
  pre-filtered review).
- **I5 · Overlays close by back gesture and by Escape, whatever holds
  focus**, and restore focus. One overlay stack owns this. (A11y review,
  owner-experienced.)
- **I6 · Mobile control rail is [Filter] [Group] [Sort]** as constant-width
  buttons carrying their state (count / current key + direction), quick
  chips after, sort direction togglable. (Q7.)
- **I7 · Single-click for cheap reversible changes** (status flips): apply at
  once with undo and rollback, not staged behind Save.

## Separation of concerns in detail views

- **S1 · Object properties vs proposal properties never mix in one block.**
  A change-review detail separates: what the proposal does, the affected
  object's pre-existing state, and the proposal's own metadata.
- **S2 · Pre-existing vs proposed text is always explicitly labeled**
  (stored/proposed zone treatment). A reader must never infer which is which
  from position alone.

## Typography

- **T1 · Hierarchy between a label and its metadata.** Section titles carry
  the visual weight. Counts and limits sit in quiet right-aligned gutters,
  never in the same run of text at the same weight.

## Health and history (directional, from interview)

- **H1 · "Unhealthy" includes accumulation**: archived/resolved pile-up is
  a health signal, and any health state shown must say what the user should
  do about it. (Q3.)
- **H2 · Write activity is revisitable**: imports and applies persist a
  history (kept/discarded per entry, expandable) — not transient result
  cards. (Q4 — feature pending. Checklist item activates with it.)

## How reviewers should use this

Cite the item ID in findings ("violates L1"). A finding on a screen that can't
satisfy an item should say why rather than skip it. Luma's live feedback beats
this file: update the file in the same change and flag the diff for review.

## Open questions for Luma (before this becomes canon)

1. V1: whether "no synonyms" is absolute, or acceptable when the schema word
   is user-hostile. (Current rule: the schema word wins, and a plain-language
   gloss goes in a subline rather than replacing it.)
2. L8's threshold (≤5 values → segmented): the right cut-off.
3. I7's scope: which changes count as "cheap" enough for a one-click apply.
   (Current read: single-field enum/toggle PATCHes with easy rollback.)
4. Anything here that misreads what you meant.
