# Backlog — memory tool and console

The implementation queue: feedback received, bugs reported, and mined prior-art
not yet carried into the console. Working document — prune entries when they
ship, note the commit. Items marked **[Luma]** are owner feedback; do not drop
them without asking.

> **Lost message:** one batch of Luma's feedback (~2026-08-21 afternoon) never
> arrived. The mobile round below (2:18 PM screenshot) may reconstruct part of
> it; Luma — if more of the lost batch surfaces, send it and it lands here.

## UX review 2026-08-21

Five-reviewer audit consolidated at
[design/reviews/2026-08-21-ux-review.md](design/reviews/2026-08-21-ux-review.md):
58 unique findings in 7 clusters (A decision/apply correctness · B mobile
fundamentals · C visibility of computed state · D linkage · E copy · F a11y ·
G wiring).

**Owner triage (2026-08-21 interview):** P0 (cluster A + mobile tap-detail +
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

- **[Luma] Navigation + scope wireframes — IN REVIEW (2026-08-22).**
  public/mockups/nav-wire.html (low fidelity, greyscale, layout only). Four
  views confirmed: Review Queue / Memory Vault / Sources / **Activity** (job
  history + running jobs). Scope moves into the top navigation and stays
  visible across all views. The shoehorned status line is dismantled: counts
  attach to scope, index health becomes an alert that says nothing when fine,
  and the engine instance sits beside the tool name. Upstream comparison from
  Luma's screenshot: their picker is three stacked labelled menus
  (wireframe C) with the counts line beneath, and their bottom nav carries
  **Settings** as a peer view with counts as badges.
  - **Undo — backlog by owner request.** Needs durable job history first;
    Activity is the prerequisite.
  - **Mode filter is missing from this console entirely.** Upstream has a
    Mode menu (All / roleplay / conversation) beside scope; it filters what a
    source imports as, which is a different question from scope.
  - **Settings has no surface in this console at all.** The engine exposes
    recall weights, caps, extraction prompt templates, AI keyword extraction
    and the Active toggle; none of it is reachable.


- **Sources screen SHIPPED (2026-08-22, 5307601 + follow-ups).** Built from
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


- **[Luma] Source import UI — IN REVIEW (2026-08-22).** Luma is blocked on
  using the tool for real ("i can't really use it yet... we first have to
  implement a decent source import ui"). Interview answers: (1) browse-to-
  import is the only job that happens; maintenance never does. (2) Repair
  lives in Sources, Review links to it. (3) Revalidate wanted. (4) Bulk for
  lorebooks, curate+edit one at a time for chat summaries. (5) Confirm only
  above a threshold. (6) Imported-visibility left to implementer (chose:
  default view hides them, quick rail brings them back). (7) Title + state
  only, no snippet body. Specimens: public/mockups/sources-v1.html (test
  corpus, committable).
  **Adversarially reviewed 2026-08-22** (6 dimension reviewers + 8 verifiers
  against the guideline docs). 2 findings survived refutation, 6 were
  refuted, 13 high-severity findings were triaged by hand. Applied: state
  names and action verbs replaced with catalog strings (New / Already
  imported / Update available / Context changed / Extraction incomplete /
  Source missing; "Import and extract", "Re-extract", "Select all {n}",
  "Retry original selection"); rail made a real partition (117 + 96 = 213)
  with blocked drafts as a separately-labelled unit; the running-import
  state added (progress + Stop with stated consequences, using
  savingAndExtracting); state word rendered beside every glyph so state is
  not colour-only; Context changed moved off the warn hue; the edit mode
  drawn with an autosave-draft / explicit-spend save model, dirty marker and
  resumable counter; curate path given a 390px projection with 44px targets;
  3B/3C reordered to match the real sequence.
  **Owner round 2 (2026-08-22):** curate path rebuilt as an in-place row
  expander instead of a separate paged screen - measured on the live
  instance, a chat summary is ~1,772 ch (median), roughly 440 tokens, 779 at
  the worst, so it inlines comfortably; the phone therefore needs no pushed
  screen, back entry or scroll restoration. Price moved onto the buttons as
  a sparkle+count (Import and extract always extracts, so model calls always
  equal the selection - a separate cost chip only repeated the button).
  Result card rebuilt on the list's row grammar. Edited mark moved onto the
  row so the list says which summaries you have touched.
  **Owner round 3 (2026-08-22):** the import result card was rebuilt around
  the decision rather than the data. It now leads with the outcome as a
  sentence, gives the failed source its own block (its name was being
  truncated to "Nam..." - the one name in the card that must survive), folds
  the per-source ledger away as audit material, and carries one help line
  under one information icon. Import buttons show the price once (sparkle +
  count), not twice.
  **Owner round 4 (2026-08-22):** phone specimens dropped at owner request;
  added S1B import scope (tool-level control, and the specimen states that
  scope is recorded into the extraction context - the cause of the 44 blocked
  drafts), S7 what a source produced (first item in the linkage order: an
  imported source expands to its derived memories and its pending claims,
  linking into vault and review queue), and S8 empty states (zero-result with
  the binding constraint named, nothing-in-scope, and the terminal
  everything-imported state). Still unmocked and agreed as a later pass:
  Refresh vs Re-extract for "Update available", and deleting an imported
  source (the catalog already has the delete-with-or-without-memories copy).

- **DIAGNOSED (2026-08-22): the live 44x `source_stale` mystery is context
  drift, not stale text.** Compared every blocked draft's
  `extractionFingerprint` against its source note's current one: 0 of 45 have
  changed source text; 44 differ only in context (note modes widened
  roleplay -> roleplay+conversation, and personaId/personaIds added to
  scope); 1 has a missing source note. Re-extracting all 45 would spend 45
  model calls regenerating byte-identical claims. Open engineering question:
  does the engine expose a cheap re-bless of an unchanged fingerprint
  (needed for the "revalidate" action Luma asked for)? **ANSWERED 2026-08-22:
  no.** Tested against the local engine: the staleness check is enforced at
  preflight (`ltm_draft_source_stale` blocks every mutation), there is no
  PATCH/refresh/revalidate route for a draft, and the failure reproduces
  exactly by widening one source note's `modes` (restoring them un-blocks it
  instantly). The catalog's `Refresh` is a different action - it updates
  imported source text and metadata without a model call, and does not clear
  the block. **Engine request:** a route that re-blesses a draft whose
  `sourceHash` is unchanged. Highest-value change to this flow; until then
  re-extraction (1 model call per source) is the only unblock.

- **BUG (live, 2026-08-22): import preview reports everything as `new`.**
  All 213 candidates come back `freshness: new` with `importedCount: 0`
  while the vault holds 96 source notes. Also scans cap at 100 per kind with
  no signal in the payload. The Sources UI cannot currently tell the user
  what they already imported.

- **[Luma] Detail surfaces pass — SHIPPED (2026-08-22, "go fix all yes").** Luma: both detail
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
  **Feedback round 1 (2026-08-22) applied:** char footers show signed net +
  total after (+86 - 272 ch); headline is a plain sentence, op icon moved
  to the preview zone label; paragraph keys in text tone (accent is links-only
  now); extraction colon; whole-memory toggle on append/update
  previews (superseded the open-memory peek button, owner feedback
  2026-08-22): the preview re-renders with every section present and the
  change marked in place; diff folds open up in whole mode.
  **S7 inline-object cards — APPROVED ("s7 lgtm") and shipped:** link and
  status previews inline the object under review (vault memories first, then
  batch-pending creates; fold past 3 lines; live sizes: threads median 242
  ch, timeline events median 479, p90 771). Help text carries a small
  info-circle glyph to mark it as education.


### Tabled by Luma (2026-08-21 evening brainstorm)

- **[Luma] Op icon mapping — DECIDED T5 (2026-08-21 evening).**
  `script-plus` create · `file-plus` append · `file-pencil` update ·
  `link-plus` link · `tags` keywords · `activity` status · `users` subjects.
  Semantics: script = whole note, file = one section; shared + = the two
  additive ops; pencil = the one op that replaces. Note types: `movie` for
  scene, masks-theater stays RP-mode only. Use `@tabler/icons-preact`.
- **[Luma] Review redesign specimens APPROVED (2026-08-21 evening) — "let's
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
- **[Luma] New-target marker: green edge bar (2a) — chosen** 2026-08-21
  late, superseding the dot (2b): the dot either shifted titles or floated;
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


### Mobile round 2 — 2026-08-21 2:18 PM (port build, phone)

- **[Luma] Mode display: segmented pill.** Exactly three chat modes exist
  (conversation/DM · roleplay · GM/game). Render mode eligibility as a
  fixed-width three-segment pill with active/inactive color per segment —
  constant width makes rows skimmable regardless of which modes are on.
- **[Luma] At-a-glance information design.** The three views don't yet answer
  "lay of the land / what needs review" at a glance. Think through what
  matters most per view, then interview Luma for his user opinions. (Interview
  sent 2026-08-21; answers pending.)
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
- **279 soft tap-target warnings** from verify.mjs (24–39px secondary targets).
  Within DESIGN's secondary floor, but worth one pass — the chip rail and tri
  rail dominate the count.
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
