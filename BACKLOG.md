# Backlog — memory tool and console

The implementation queue: feedback received, bugs reported, and mined prior-art
not yet carried into the console. Working document — prune entries when they
ship, note the commit. Items marked **[Eli]** are owner feedback; do not drop
them without asking.

> **Lost message:** one batch of Eli's feedback (~2026-08-21 afternoon) never
> arrived. The mobile round below (2:18 PM screenshot) may reconstruct part of
> it; Eli — if more of the lost batch surfaces, send it and it lands here.

## UX review 2026-08-21

Five-reviewer audit consolidated at
[design/reviews/2026-08-21-ux-review.md](design/reviews/2026-08-21-ux-review.md):
58 unique findings in 7 clusters (A decision/apply correctness · B mobile
fundamentals · C visibility of computed state · D linkage · E copy · F a11y ·
G wiring).

**Owner triage (2026-08-21 interview):** P0 (cluster A + mobile tap-detail +
ledger flush) ships first, as one batch. Then **mobile structure (B)** before
visibility (C). Linkage order: **Sources→pending drafts, then vault→related
claims, then deep links/history**. P2 stands as proposed. Big-hitters
(query language, keyword curation) stay post-P1; conflict three-way pending
owner decision after explanation.

**Interview outcomes (Q1-Q7):**
- At-a-glance redesign: **punted** until Eli does a real-world sweep.
- "Careful" lane = conflicts · low confidence · restates · dupes · overwrites.
  The "diff" chip is renamed **overwrites** — the old label was itself a
  finding (Eli didn't know what it meant).
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

### Mobile round 2 — 2026-08-21 2:18 PM (port build, phone)

- **[Eli] Mode display: segmented pill.** Exactly three chat modes exist
  (conversation/DM · roleplay · GM/game). Render mode eligibility as a
  fixed-width three-segment pill with active/inactive color per segment —
  constant width makes rows skimmable regardless of which modes are on.
- **[Eli] At-a-glance information design.** The three views don't yet answer
  "lay of the land / what needs review" at a glance. Think through what
  matters most per view, then interview Eli for his user opinions. (Interview
  sent 2026-08-21; answers pending.)
- **[Eli] Import scope global?** Open question: should the Sources chat-scope
  selector be a tool-wide (or console-wide) scope across all views?
- **[Eli] Facets + search constant across Review and Vault.** Same facet rail
  and search bar on both surfaces (Vault has search but different facets;
  Review has facets but no search).
- **[Eli] BUG: facet sheet doesn't fit one mobile screen** in the port build
  (regression vs. the prototype's column layout, or content growth).
- **[Eli] BUG: tapping a claim row on mobile doesn't open details.** Cause
  found: `Review.tsx` `focusRow` gates `detailKey` on `desktop`; mobile tap
  only moves the cursor. Fix: open stacked detail on mobile tap.
- **[Eli] BUG/copy: Review tab badge says 2 with 17 pending items.** Badge
  shows draft count, not claim count — internal packaging leaking into nav.
  Show pending claims (17) to match the Decided meter.
- **[Eli] Mobile chip rail: three buttons only.** Default mobile rail should
  be [Filter] [Group by] [Sort by] (each opening its chooser), plus a sort
  direction toggle; today's group/sort chips overflow offscreen.

- **[Eli] Categorical type colors everywhere** — landed in the memory tool
  (`.type-*` + DESIGN.md rule). Sweep the rest of the console when other tools
  name memory types.
- **[Eli] (from workbench notes) Keyword curation, not blind trimming** —
  `set_keywords` mutations constantly hit the 30-keyword cap; the old app
  auto-trimmed to 10, which "loses the curated list". Wanted: a smarter default
  the user can see and override — surface the proposed keyword set against the
  cap, let the reviewer pick; possibly LLM-assisted. Nothing in the port
  trims automatically today (the failure is classified and named instead).
- **[Eli] (from workbench notes) add_link near-dupes have no obvious action** —
  e.g. 4 near-dupe `add_link` claims pointing at timeline events. Note refs are
  clickable now (NotePeek), but the *decision* is still unclear: drop the
  links? also drop the duplicate timeline creates? Design a cluster action that
  resolves link + target together.
- **[Eli] (from workbench notes) facet ergonomics** — Clear button reachable
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

- Copy policy: product strings from the vendored catalog (`ltm-en.json`,
  1.2.9); coined words only via `OURS` in `strings.ts` — keep GLOSSARY
  discipline from the prototype when adding copy.
- Dev loop: local engine + st-notes mock provider with
  `~/code/me-ltm-console/dev/ltm-responder.mjs` (revision mode generates
  merge/rewrite corpus). Live instance is read-only validation until Eli says
  otherwise.
