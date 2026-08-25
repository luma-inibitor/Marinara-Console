# Backlog — memory tool and console

The implementation queue: feedback received, bugs reported, and mined prior-art
not yet carried into the console. Working document — prune entries when they
ship, note the commit. Items marked **[Luma]** are owner feedback; do not drop
them without asking.

> **Lost message:** one batch of Luma's feedback (~2026-08-21 afternoon) never
> arrived. The mobile round below may reconstruct part of
> it; Luma — if more of the lost batch surfaces, send it and it lands here.

## Found during the component refactor

- **The Sources badge counts the wrong thing.** `MemoryTool.tsx` sets it from
  `s.notes.sourceNotes`, which is *imported* source notes. The Review badge
  next to it counts what is *waiting*. Same channel, opposite meanings — and
  it currently reads 8 beside Sources when there is nothing pending at all.
  It read 4 before, matching pending only by coincidence. Should almost
  certainly be the pending count. **[needs Luma's yes]**
- **Nav badge semantics need writing down** once the above is settled, so
  Activity does not have to guess when it is built.

## Still open from the 2026-08-21 UX review

Every **[critical]** and **[high]** finding in the five raw reports and the
consolidation was re-checked against the current code and marked
inline; 24 of the 30 markers read SHIPPED. These three are what survived, and
they are here because a live bug buried in a raw report is a bug nobody fixes.

- **The apply dock double-counts an auto-included dropped create.**
  `applyCount = (pf?.ready ?? 0) + c.drop` in `Review.tsx` `ApplyDock` never
  reconciles `pf.ready` against local drops. Drop a `create_note` while keeping
  its dependent `add_link` and preflight auto-includes the create, so it lands
  in `ready` and in `drop` at once, and it is still listed under "added as
  dependencies" although it will be skipped rather than sent. The dangerous
  half of this finding shipped — `applyDecided` filters `dropIds` out of the
  ids it sends, and `droppedDependencyWarnings` now checks
  `mutation.link.target` so the warning fires — so what is left is a dock that
  states a number no longer matching what Apply will do. Fix: intersect
  `readyMutationIds` with the current keeps for both the count and the
  auto-included list. [interaction.md high, review item 2]
- **No roving tabindex in the review list.** `useRovingFocus` moves the cursor
  and calls `focus()`, but nothing sets `tabindex=-1` on the controls of
  non-cursor rows: measured 279 tabbable elements inside `.audit-list` at
  390x844 and 486x1085, three per row, so crossing the list to reach the apply
  dock takes most of a hundred Tab presses. DESIGN §3 mandates one tab stop per
  composite, and `BookAudit.tsx` already does it with
  `tabIndex={props.isFocused ? 0 : -1}` — the queue needs the same on the row
  and its two buttons, driven off `cursor`. [mobile-a11y.md high, review
  item 50]
- **A vault memory has no path to the claims that target it.** `NoteEditor`
  offers status, links, per-section dedupe, Save, Archive and Delete, and its
  own helper text says pruning here is what unblocks the queue, but there is no
  way to reach the queue from it. The target facet and `activeFacets` already
  exist, so a "related claims (n)" control can navigate to review pre-filtered.
  This is second in the owner's linkage order, after Sources → pending drafts.
  [linkage.md high, review item 31]

## UX review 2026-08-21

Five-reviewer audit consolidated at
[design/reviews/2026-08-21-ux-review.md](design/reviews/2026-08-21-ux-review.md):
58 unique findings in 7 clusters (A decision/apply correctness · B mobile
fundamentals · C visibility of computed state · D linkage · E copy · F a11y ·
G wiring).

**Owner triage (interview):** P0 (cluster A + mobile tap-detail +
ledger flush) ships first, as one batch. **P0 shipped** (regression-tested:
mobile tap-detail, visible-only keyboard decisions, chip-focus safety,
edit-leak, preflight-drop reconciliation, skippedMutationIds, ledger
flush-on-hide, undo hygiene, 400 on malformed state, badge=claims,
diff→overwrites). Then **mobile structure (B)** before
visibility (C). Linkage order: **Sources→pending drafts, then vault→related
claims, then deep links/history**. P2 stands as proposed. Big-hitters
(query language, keyword curation) stay post-P1; conflict three-way pending
owner decision after explanation.

**Interview outcomes (Q1-Q7):**
- At-a-glance redesign: **punted** until Luma does a real-world sweep.
- "Careful" lane = conflicts · low confidence · restates · dupes · overwrites.
  The "diff" chip is renamed **overwrites** — the old label was itself a
  finding (Luma didn't know what it meant).
- Vault: search-first + health hotspots; *unhealthy includes archived/resolved
  pile-up* — and the UI must say what to do about it.
- **NEW: activity/history viewer** — persist import results (kept/discarded
  per entry, expandable) and apply reports; a place to revisit recent write
  activity. Merges with the workbench's apply-report item.
- Scope: tool-level selector in the memory header (not console-wide).
  **Prep task: study how the official LTM package UI does scope selection**
  (SourcesWorkspace/MemoryVault in Marinara-Agents client source).
- Mode pill approved: fixed 3 segments DM · RP · GM, active/inactive per
  segment, constant width.
- Mobile rail: [Filter] [Group] [Sort] constant-width buttons, then quick
  chips in the same row; buttons may carry state (filter count, current
  key + direction) — implementer's choice.

## Owner feedback queue

- **Navigation SHIPPED.** Scope lives in the memory tool header
  above the views (it decides what they show, and it is the phone's order
  too); views are Sources / Vault / Review with icons and counts as badges;
  the shoehorned status line is gone. Mode is a segmented DM/RP/GM filter on
  Sources, not a scope level. Verify green at 390/486/768/1280.
  - **Branch scope needs an endpoint.** The wireframes draw character → chat →
    branch. Only the first two ship: this console has no `/branches` route and
    chats carry no branch field, so branch is left out rather than rendered as
    a control that can never work. Upstream has it, so the capability exists;
    the console needs the route exposed.
  - **Activity view is designed, not built.** The fourth tab is in the
    wireframes with its badge. It is the prerequisite for undo.
  - **Index health has no home now.** It left the status line; the design says
    it becomes an alert that is silent when fine. Not built.


- **[Luma] Navigation + scope wireframes — IN REVIEW.**
  public/mockups/nav-wire.html (low fidelity, greyscale, layout only). Four
  views confirmed: Review Queue / Memory Vault / Sources / **Activity** (job
  history + running jobs). Scope moves into the top navigation and stays
  visible across all views. The shoehorned status line is dismantled: counts
  attach to scope, index health becomes an alert that says nothing when fine,
  and the engine instance sits beside the tool name. Upstream comparison from
  Luma's screenshot: their picker is three stacked labeled menus
  (wireframe C) with the counts line beneath, and their bottom nav carries
  **Settings** as a peer view with counts as badges.
  - **Undo — backlog by owner request.** Needs durable job history first;
    Activity is the prerequisite.
  - **Mode filter is missing from this console entirely.** Upstream has a
    Mode menu (All / roleplay / conversation). Confirmed against the engine:
    it is **not** a scope level. A draft's fingerprint records
    `scope` (chatIds, characterIds) and `modes` / `extractionMode` as separate
    fields, and every source carries its own `importMode`. Mode does not
    cascade - picking roleplay does not change which chats exist - so it
    belongs with the Sources list's filter control beside search, which is
    also where upstream puts it.
  - **Settings has no surface in this console at all.** The engine exposes
    recall weights, caps, extraction prompt templates, AI keyword extraction
    and the Active toggle; none of it is reachable.


- **Sources screen SHIPPED (5307601 + follow-ups).** Built from
  the approved specimens; verify green at 390/768/1280; exercised read-only
  against the live instance (213 sources, 45 blocked drafts, no console
  errors). Still to do on this screen, deferred by the owner:
  - **Refresh vs Re-extract** for `Update available`. The catalog ships a
    Refresh family that updates imported source text and metadata without a
    model call and does not create a draft; the honest flow is probably
    Refresh then Re-extract. Undrawn and unimplemented.
  - **Deleting an imported source.** Catalog already has the copy, including
    the with-or-without-extracted-memories choice. Destructive, so it needs
    the blast-radius treatment.
  - **Live load is ~13s** for the Sources screen against the phone: it fetches
    all three previews, 500 notes and the full review payload before first
    paint. Wants progressive rendering per kind, or a lighter derived-memory
    query.
  - **Import scope is read but not yet written by Review or Vault** - the
    signal is tool-level in store.ts, only Sources uses it so far.


- **[Luma] Source import UI — IN REVIEW.** Luma is blocked on
  using the tool for real ("i can't really use it yet... we first have to
  implement a decent source import ui"). Interview answers: (1) browse-to-
  import is the only job that happens; maintenance never does. (2) Repair
  lives in Sources, Review links to it. (3) Revalidate wanted. (4) Bulk for
  lorebooks, curate+edit one at a time for chat summaries. (5) Confirm only
  above a threshold. (6) Imported-visibility left to implementer (chose:
  default view hides them, quick rail brings them back). (7) Title + state
  only, no snippet body. Specimens: public/mockups/sources-v1.html (test
  corpus, committable).
  **Adversarially reviewed** (6 dimension reviewers + 8 verifiers
  against the guideline docs). 2 findings survived refutation, 6 were
  refuted, 13 high-severity findings were triaged by hand. Applied: state
  names and action verbs replaced with catalog strings (New / Already
  imported / Update available / Context changed / Extraction incomplete /
  Source missing; "Import and extract", "Re-extract", "Select all {n}",
  "Retry original selection"); rail made a real partition (117 + 96 = 213)
  with blocked drafts as a separately-labeled unit; the running-import
  state added (progress + Stop with stated consequences, using
  savingAndExtracting); state word rendered beside every glyph so state is
  not color-only; Context changed moved off the warn hue; the edit mode
  drawn with an autosave-draft / explicit-spend save model, dirty marker and
  resumable counter; curate path given a 390px projection with 44px targets;
  3B/3C reordered to match the real sequence.
  **Owner round 2:** curate path rebuilt as an in-place row
  expander instead of a separate paged screen - measured on the live
  instance, a chat summary is ~1,772 ch (median), roughly 440 tokens, 779 at
  the worst, so it inlines comfortably; the phone therefore needs no pushed
  screen, back entry or scroll restoration. Price moved onto the buttons as
  a sparkle+count (Import and extract always extracts, so model calls always
  equal the selection - a separate cost chip only repeated the button).
  Result card rebuilt on the list's row grammar. Edited mark moved onto the
  row so the list says which summaries you have touched.
  **Owner round 3:** the import result card was rebuilt around
  the decision rather than the data. It now leads with the outcome as a
  sentence, gives the failed source its own block (its name was being
  truncated to "Nam..." - the one name in the card that must survive), folds
  the per-source ledger away as audit material, and carries one help line
  under one information icon. Import buttons show the price once (sparkle +
  count), not twice.
  **Owner round 4:** phone specimens dropped at owner request;
  added S1B import scope (tool-level control, and the specimen states that
  scope is recorded into the extraction context - the cause of the 44 blocked
  drafts), S7 what a source produced (first item in the linkage order: an
  imported source expands to its derived memories and its pending claims,
  linking into vault and review queue), and S8 empty states (zero-result with
  the binding constraint named, nothing-in-scope, and the terminal
  everything-imported state). Still unmocked and agreed as a later pass:
  Refresh vs Re-extract for "Update available", and deleting an imported
  source (the catalog already has the delete-with-or-without-memories copy).

- **DIAGNOSED: the live 44x `source_stale` mystery is context
  drift, not stale text.** Compared every blocked draft's
  `extractionFingerprint` against its source note's current one: 0 of 45 have
  changed source text; 44 differ only in context (note modes widened
  roleplay -> roleplay+conversation, and personaId/personaIds added to
  scope); 1 has a missing source note. Re-extracting all 45 would spend 45
  model calls regenerating byte-identical claims. Open engineering question:
  does the engine expose a cheap re-bless of an unchanged fingerprint
  (needed for the "revalidate" action Luma asked for)? **ANSWERED:
  no.** Tested against the local engine: the staleness check is enforced at
  preflight (`ltm_draft_source_stale` blocks every mutation), there is no
  PATCH/refresh/revalidate route for a draft, and the failure reproduces
  exactly by widening one source note's `modes` (restoring them un-blocks it
  instantly). The catalog's `Refresh` is a different action - it updates
  imported source text and metadata without a model call, and does not clear
  the block. **Engine request:** a route that re-blesses a draft whose
  `sourceHash` is unchanged. Highest-value change to this flow; until then
  re-extraction (1 model call per source) is the only unblock.

- **BUG (live): import preview reports everything as `new`.**
  All 213 candidates come back `freshness: new` with `importedCount: 0`
  while the vault holds 96 source notes. Also scans cap at 100 per kind with
  no signal in the payload. The Sources UI cannot currently tell the user
  what they already imported.

- **[Luma] Detail surfaces pass — SHIPPED ("go fix all yes").** Luma: both detail
  surfaces are rough; the claim pane is the worse one ("assaulted by
  information i have no idea what to do with and how it would impact my
  memory vault"). Direction agreed: reorganize the pane around the decision
  (headline sentence / op-specific consequence rendering / trust zone /
  decide bar at bottom), merged after-state + diff confirmed, dedicated edit
  affordance replaces the always-on textarea. Long entries handled by
  diff-style context folding. Specimens: public/mockups/detail-v5.html
  (seeded test corpus only — committable). NotePeek de-uglification rides in
  the same wave (resolved titles, type icons, §section typography, mode
  pill's first home). Shipped: ClaimDetail v5 (headline / op-specific
  preview with diff + context folds / evidence zone with live source snippet /
  bottom decide bar, edit as a mode), NotePeek v2 (mode pill, resolved links,
  §keys, id demoted), note→memory copy sweep, flags.ts editorial trims,
  stacked header shows queue position. Open leans Luma can still veto:
  4B extraction line (vs 4A fold), folding thresholds (3 preview lines /
  2 stored context lines).
  **Feedback round 1 applied:** char footers show signed net +
  total after (+86 - 272 ch); headline is a plain sentence, op icon moved
  to the preview zone label; paragraph keys in text tone (accent is links-only
  now); extraction colon; whole-memory toggle on append/update
  previews (superseded the open-memory peek button, owner
  feedback): the preview re-renders with every section present and the
  change marked in place; diff folds open up in whole mode.
  **S7 inline-object cards — APPROVED ("s7 lgtm") and shipped:** link and
  status previews inline the object under review (vault memories first, then
  batch-pending creates; fold past 3 lines; live sizes: threads median 242
  ch, timeline events median 479, p90 771). Help text carries a small
  info-circle glyph to mark it as education.


### Tabled by Luma

- **[Luma] Op icon mapping — DECIDED T5.**
  `script-plus` create · `file-plus` append · `file-pencil` update ·
  `link-plus` link · `tags` keywords · `activity` status · `users` subjects.
  Semantics: script = whole note, file = one section; shared + = the two
  additive ops; pencil = the one op that replaces. Note types: `movie` for
  scene, masks-theater stays RP-mode only. Use `@tabler/icons-preact`.
- **[Luma] Decision + state icons — DECIDED.** `undecided` moves
  `circle-dashed` → `circle-dotted`: dashed is 8 arc segments and `progress-*`
  is 5, the same visual vocabulary, so the decision family and the progress
  family were colliding; 12 dots is a different vocabulary. `keep`
  (`circle-check`) and `drop` (`circle-x`) unchanged, and `circle-dashed` plus
  the whole `progress-*` family are thereby released. States: error
  `alert-circle` · partial `progress-x` · degraded `progress-alert` · waiting
  on the user `list-check` (the Review-queue glyph, reused not re-bound, so it
  names where to go) · info `info-circle` · loading no icon. Empty-state
  all-clear is `checks` (double tick = "all of them"), distinct from the
  single `check` checkbox tick. Claim-detail high-confidence row gets
  `zoom-check` (validation passed). `alert-triangle` narrows to
  `extraction_incomplete` only.
- **[Luma] Review redesign specimens APPROVED — "let's
  rock". SHIPPED in 3d57d32** (row v2, header v4, detail zones, icon system,
  education pattern, unified flags; verify green at 390/768/1280).
  Edited-mark decision inside the wave: `writing` icon (bare pencil collides
  with file-pencil's silhouette, same rule that killed flag-2).**Original scope:** Implementation queue: row v2 (status-icon cycling, op-icon slot,
  quiet severity-tinted flags chip, contribution chars, green-dot new
  marker) · group header v4 (aggregates, bar tally, icon bulk, 390px
  priority collapse) · detail card v4 (proposal / computed signals / stored
  zones, enum chips with field-prefixed tooltips) · §section typography ·
  education tooltips everywhere icons/enums render. Kebab contents still
  open (candidates: open note, clear group decisions, deep link).
- **[Luma] List view column controls.** Power users get resize / reorder /
  add / remove columns in the review list. Ship with the default column set
  first; the controls come later.
- **[Luma] Chars ⇄ estimated tokens toggle** on the contribution display —
  "nice to not have to divide by 4". Stopgap: moot once column controls
  exist (an est-tokens column covers it); until then, a display toggle.
- **[Luma] New-target marker: green edge bar (2a) — chosen**, superseding
  the dot (2b): the dot either shifted titles or floated;
  Luma killed it and took 2a's edge, explicitly accepting the color-only
  accessibility tradeoff. Applies to note group headers; rows in flat
  contexts keep the small dot beside the target ref for now.
- **[Luma] Enum tooltips prefix their owning field** ("claim kind · static —
  ..."), so the value is anchored to the field it belongs to.
- **[Luma] Icon education pattern — approved direction.** Every type/op icon
  is clickable/hoverable with a tooltip naming the concept, everywhere it
  appears (tap-to-reveal on touch; tooltips are never hover-only). Feeds the
  glossary-surface item above.
- **[Luma] Scene note type uses the `movie` icon** (masks-theater stays RP
  mode only).
- **[Luma] Char counts surfaced per mutation** — long entries need manual
  review (both risky and impactful); show contribution size, flag `long`.

- **[Luma] Terminology/glossary surface in-app** — closely related fields have
  subtle, important distinctions (claim kind static/change vs disposition vs
  risk vs confidence; restates vs duplicate). Some part of the app must help
  surface what these terms mean. Tabled during the group-header brainstorm;
  design open (glossary panel? info popovers? first-use hints?).
- **[Luma] Sources freshness icons** — icon treatment for
  new/imported/update-available/context-changed/extraction-incomplete;
  revisit when focus returns to the Sources view.


### Mobile round 2 (port build, phone)

- **[Luma] Mode display: segmented pill.** Exactly three chat modes exist
  (conversation/DM · roleplay · GM/game). Render mode eligibility as a
  fixed-width three-segment pill with active/inactive color per segment —
  constant width makes rows skimmable regardless of which modes are on.
- **[Luma] At-a-glance information design.** The three views don't yet answer
  "lay of the land / what needs review" at a glance. Think through what
  matters most per view, then interview Luma for his user opinions. (Interview
  sent; answers pending.)
- **[Luma] Import scope global?** Open question: should the Sources chat-scope
  selector be a tool-wide (or console-wide) scope across all views?
- **[Luma] Facets + search constant across Review and Vault.** Same facet rail
  and search bar on both surfaces (Vault has search but different facets;
  Review has facets but no search).
- **[Luma] BUG: facet sheet doesn't fit one mobile screen** in the port build
  (regression vs. the prototype's column layout, or content growth).
- **[Luma] BUG: tapping a claim row on mobile doesn't open details.** Cause
  found: `Review.tsx` `focusRow` gates `detailKey` on `desktop`; mobile tap
  only moves the cursor. Fix: open stacked detail on mobile tap.
- **[Luma] BUG/copy: Review tab badge says 2 with 17 pending items.** Badge
  shows draft count, not claim count — internal packaging leaking into nav.
  Show pending claims (17) to match the Decided meter.
- **[Luma] Mobile chip rail: three buttons only.** Default mobile rail should
  be [Filter] [Group by] [Sort by] (each opening its chooser), plus a sort
  direction toggle; today's group/sort chips overflow offscreen.

- **[Luma] Categorical type colors everywhere** — landed in the memory tool
  (`.type-*` + DESIGN.md rule). Sweep the rest of the console when other tools
  name memory types.
- **[Luma] (from workbench notes) Keyword curation, not blind trimming** —
  `set_keywords` mutations constantly hit the 30-keyword cap; the old app
  auto-trimmed to 10, which "loses the curated list". Wanted: a smarter default
  the user can see and override — surface the proposed keyword set against the
  cap, let the reviewer pick; possibly LLM-assisted. Nothing in the port
  trims automatically today (the failure is classified and named instead).
- **[Luma] (from workbench notes) add_link near-dupes have no obvious action** —
  e.g. 4 near-dupe `add_link` claims pointing at timeline events. Note refs are
  clickable now (NotePeek), but the *decision* is still unclear: drop the
  links? also drop the duplicate timeline creates? Design a cluster action that
  resolves link + target together.
- **[Luma] (from workbench notes) facet ergonomics** — Clear button reachable
  without scrolling on mobile (now in the sheet header — verify on device);
  Esc dismisses the sheet (done).

## Queued from the tooling audits

Findings from four audits. Reports live outside the repo at `~/code/luma/`: `scripts-audit.md`, `bespoke-audit.md`, `domsnap-evaluation.md`, `engine-harvest.md`.

### Defects found, not yet fixed

- **No sheet actually traps focus, locks scroll, or hides the page behind it**, though every sheet reads as if it does. Seven shipped bugs trace to this. Recommended fix is Radix's dialog inside `ui/Sheet.tsx`, leaving `overlays.ts` alone — one file, five call sites.
- **Most of what the engine sends is still an unchecked cast.** Valibot schemas now guard the read paths the vault and the review queue depend on — `GET /notes`, `GET /notes/:id`, `GET /drafts/review` — and the three note write paths — `PATCH /notes/:id`, `DELETE /notes/:id`, `POST /notes/:id/extract` — through `src/shell/wire.ts` and `src/tools/memory/api/schema.ts`. Writes parse whole or throw (`parseWrite`); the `putNote` guard that patched the `{note, rebuild}` defect is gone, its job now done by `NoteWriteSchema` at the boundary. `lorebooks/data.ts` and `presets/data.ts` — where the `"false"` bug actually happened — now parse too, in schemas beside their endpoint functions: a lorebook row is JSON so its flags are `v.boolean()`, a preset row is TEXT columns so `wireBool` takes exactly `true`/`false`/`"true"`/`"false"` and `jsonText` decodes a JSON column against the shape the tool needs. Everything else still travels on `as T`: `drafts.ts` preflight/accept/skip, `import.ts`, `status.ts`, `backup.ts`, `chats.ts`, `characters.ts`, `ledger.ts`, and the tool writes whose replies nothing reads (`bulkPatch`, `patchPreset`, `setDefaultPreset`). Extend the same pattern outward; the hand-written interfaces still in `api/types.ts` mark what is left.
- **The two tool `data.ts` files are still UNCLASSIFIED to `layercheck`**, because they mix wire types, endpoint functions and domain transforms in one module — the tangle `memory/data.ts` was split out of. Their schemas sit beside their fetchers rather than under an `api/` they do not have, so nothing about them is layer-checked. The shape is a split into `api/` + `model/` per ARCHITECTURE §2, and it is a layering change rather than a validation one.
- **No PATCH or POST reply on either tool route family has been observed.** The dev engine holds a writer lease, so the write schemas are read off what the console already assumed — `createSection` and `duplicatePreset` normalized their replies as bare rows — plus `v.nullish` for a 204. If the engine wraps a reply in an envelope, saving throws a wire mismatch instead of corrupting the row, which is the safe direction to be wrong in, but it wants one live write to settle.
- **`Sources.tsx` and `MemoryTool.tsx` form an import cycle** via `focusSource`. It only loads because that is a hoisted function declaration, and `src/lib/store.ts` computes eagerly, so a cycle is a `ReferenceError` at load rather than a soft failure. Fix by moving the handoff into `store/sources.ts`. Listed as the sole `import/no-cycle` exemption until then.
- **Six untraced strings in `src/tools/presets/PresetsTool.tsx`**, held by the copy baseline ratchet: `"{n} unsaved {n}"`, `"change"`, `"changes"`, `"fields"`, the overwrite warning, and `"— the same {n} you changed"`.
- **`ScopeBar.tsx` carries a `data-contrast-exempt` that is now redundant** after the `aria-hidden` skip landed.
- **`store/sources.ts` and `store/scope.ts` both fetch the chat list.** Not a defect today; see the decision file.

### Do not do yet

- **Title truncation outside the review queue.** DESIGN.md §2 now says titles truncate to one line in list rows, and the vault, lorebook entries and preset section rows still wrap under one shared `.nm` rule. Luma: "dont worry about vault's list view for now, it's gonna be revamped." Leave all of them until that redesign lands.

### Adopt

- **`eslint-plugin-i18next`, jsx-text mode.** Catches hardcoded UI text that `copycheck` structurally cannot — copycheck asks whether a word exists in a catalog, the rule asks whether it came from `t()`. Run on the real tree it found 25 hits, about 16 genuinely hardcoded, nine of them in directories copycheck calls clean. Four lines of config silence the unit-suffix noise. A lint rule also cannot scan nothing and report success.
- **`noUncheckedIndexedAccess`.** Measured at roughly 60 diagnostics, half a day. Several look like live bugs, including a percentile lookup in `lorebooks/data.ts:90` and a diff-op scan in `ClaimDetail.tsx`. Deferred only until the review-queue redesign lands, to avoid colliding with it.
- **A `CHANGELOG.md`.** We record what is owed here and what was chosen in `.decisions/`, but not what shipped, which is why the audit had to re-check thirty findings against the code by hand.
- **A tracked-artifact tripwire** over `git ls-files`, after the near-miss that nearly committed 33 build artifacts.
- **`shots.mjs` folds into `verify.mjs`**; **`components.mjs`** can be deleted.
- **Re-evaluate `deadexports.mjs` and `deadcss.mjs` against knip.** The scripts audit kept them partly because knip, ts-prune and typescript-eslint were all believed blocked by TypeScript 7. That premise was wrong: 7.0.2 ships a working API under an "unstable" name (a run over this tree read 73 files and checked 240 exports in about a third of a second), knip dropped its TypeScript dependency in March so our version is invisible to it, and oxlint offers type-aware linting that requires TS 7 rather than breaking on it. ts-prune is archived. Only typescript-eslint is still blocked, with no date. The scripts may still win, but the comparison has to be redone on merit. See `~/code/luma/typescript7-tooling.md`.

### Known check failures

`node scripts/verify.mjs` reports **9 failures / 213 warnings** as of PR #34. All nine are tap targets below the primary floor:

| Screen | Element | Measured |
|---|---|---|
| `memory-review` | `.mem-mid` rows | 35px, 6.1px clearance |
| `preset-editor` | `.row-summary` rows | 39px, 1px clearance |
| `narrow/memory-sources` | ModePill `.mseg` segments | 42px, 2px clearance |

The ModePill case is newly visible: `.mseg` carries `.hit`, but `.modepill { overflow: hidden }` clips the 44px pad down to the pill's 42px padding box, so the pad never worked and the old skip hid it.

Luma is separately deciding whether to lower the primary floor from 44px, so these numbers may be settled by moving the floor rather than the elements.

### Decided, do not revisit without a reason

- **Keep `domsnap`.** Measured against Playwright's aria snapshot and screenshots on the real PR #21 commits: domsnap caught the class change, aria reported identical, and aria and screenshots each flaked twice in six runs on an unchanged commit. Text-immunity is load-bearing, since 87–95% of aria lines carry copy we reword constantly.
- **Keep the router, the store, toasts, fuzzy search, the JSON viewer, and date handling.** TanStack Query specifically rejected: the data here is one shared map with cross-derivation, so it would sit beside the stores rather than replace them.
- **No Prettier.** It reflows the hand-formatted rationale blocks.

## Bugs / unverified

- **Port not yet exercised against the live instance** (100.112.53.9, 45 blocked
  drafts, 251 memories). Read-only pass done for the prototype only. Needs:
  `MARINARA_URL=… MARINARA_ADMIN_SECRET=… node server.mjs` + a browse.
- **Live 44× `source_stale` diagnosis unfinished** — are those drafts genuinely
  stale, or the fingerprint trap wearing the stale message? Check one draft's
  `extractionFingerprint` against its source before recommending re-extraction.
- **Re-extract on the blocked-drafts card costs real model calls** on a live
  instance (44 sources × extraction). Needs a cost-aware confirm naming the
  count and connection before firing.
- **9 tap-target failures** from verify.mjs, re-derived after the checker was
  repaired (clipping, `.hit` measurement, layer-aware clearance, `color-mix`
  parsing, opacity, `fonts.ready`). Under §2's primary floor and too tightly
  spaced to count as secondary:
  - review rows `.mem-mid` 35px at 6.1px, all four viewports.
  - preset-editor `.row-summary` 39px at 1px, all four viewports. Row height on
    both is a density tradeoff awaiting Luma's call.
  - **NEW — ModePill's interactive segments are 42px, 2px from a neighbour**
    (Sources at 390px). `.mseg` carries `.hit`, but `.modepill` sets
    `overflow: hidden`, which clips the 44px `::after` pad back to the pill's
    42px padding box. The pad has never done anything on this control; the check
    used to take it on faith and skip the segment. Fixing it means either
    dropping the pill's `overflow: hidden` or sizing the segment itself.
  - The memory-detail sort chips are no longer among these: they sit scrolled
    off the end of `.chiprail` and were being measured against whatever their
    unclipped rect landed on.
- **213 soft tap-target warnings** from verify.mjs (24–43px secondary targets,
  correctly spaced). Within DESIGN's secondary floor, but worth one pass — the
  chip rail and tri rail dominate the count. The old 767 counted controls that
  were scrolled out of view.
- **`ScopeBar.tsx`'s `data-contrast-exempt` is now redundant.** verify skips
  every `aria-hidden` element, which is what that attribute and the `.scopesep`
  exemption were arranging by hand. The `.sep` / `.mdc-sep` / `.meta::before`
  separators are *not* aria-hidden, so those three entries stay; making them
  aria-hidden in the markup would retire them too.
- **verify.mjs still measures what an overlay covers.** Contrast and the density
  numerator read elements sitting under a fixed `.stack-screen`, which a reader
  cannot see. Clearance no longer pairs across that boundary, but the ink and
  row counts do not know about it. No current finding depends on it.
- **Mobile device pass on the port** — the prototype's mobile feedback round
  (bottom bar flush, facet fit, sticky toolbar) is believed carried, but only
  screenshot-verified at 390px headless, not on the phone.

## Mined prior-art not yet carried (review workbench / triage app)

- **Conflict three-way resolution** — keep existing / take proposed / **keep
  both, ordered** (design-directions: forcing a binary is how a memory system
  loses its timeline). Conflicts render read-only today. Include the recall-use
  count on the existing text when available.
- **Checks-style one-tap fixes** — dropped-dependency warnings are shown in the
  dock, but the fix is manual. Wanted: per-blocker actions ("keep the dropped
  create", "drop the dependents"), and surfacing preflight blockers as a
  grouped list, not only counts.
- **Query language** — `note:` `type:` `kind:` `sec:` `risk:` field terms,
  `-negation`, `"phrases"`, ANDed with facets. The port's review has no text
  search yet (vault does).
- **Draft-level "reviewed" marks** — explicit reviewed/unreviewed override
  (workbench SEEN), with "mark shown reviewed" bulk. Useful once drafts number
  in the dozens.
- **Cluster actions for duplicate-incoming** — "keep longest, drop rest" per
  cluster; "drop all restates-vault" bulk. Signals exist as facets/chips only.
- **Rejected suggestions: actions + hints** — dismiss (`DELETE
  /rejected-suggestions/:id`) and the "would have targeted: note (n)" rollup.
  Read-only grouped display today.
- **Apply job niceties** — retry-failed; persisted per-run apply report
  (the workbench wrote `review-apply-<job>.json` as an audit trail).

## Future (design directions / journeys)

- **Recall surfaces (J5)** — per-turn recall history, "why didn't it remember",
  correction-in-place. Deliberately out of scope so far; the standalone app can
  poll `/last-injection/:chatId` and keep its own history, which the package
  cannot.
- **Maintenance (J6)** — cap pressure across the vault as a dashboard,
  compaction preview (what would be removed before it is removed).
- **Saved slices** — named facet combinations persisted to the ledger store
  (design-directions open question; the workbench's QUICK presets are the
  starting set).
- **Cmd-K palette entries** — memory records and actions (open note, jump to
  review filtered to a source) are not searchable from the palette yet.
- **Virtualize the review list at 500+ rows** (DESIGN §3 latency) — the live
  corpus is 124 mutations today; the study's was 1,142.
- **Editing beyond section text** — create_note title and keywords in the claim
  editor (the accept route re-validates whatever is sent).
- **Prototype retirement** — `~/code/me-ltm-console` stays as the reference
  until the port reaches parity; fold anything left and archive it.

## Process notes

- **Standing rule [Luma]:** whenever Luma says "punt" or "revisit" about
  anything, it goes in this backlog immediately.
- Copy policy: product strings from the vendored catalog (`ltm-en.json`,
  1.2.9); coined words only via `OURS` in `strings.ts` — keep GLOSSARY
  discipline from the prototype when adding copy.
- Dev loop: local engine + st-notes mock provider with
  `~/code/me-ltm-console/dev/ltm-responder.mjs` (revision mode generates
  merge/rewrite corpus). Live instance is read-only validation until Luma says
  otherwise.
