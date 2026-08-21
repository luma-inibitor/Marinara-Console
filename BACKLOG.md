# Backlog — memory tool and console

The implementation queue: feedback received, bugs reported, and mined prior-art
not yet carried into the console. Working document — prune entries when they
ship, note the commit. Items marked **[Eli]** are owner feedback; do not drop
them without asking.

> **Lost message:** one batch of Eli's feedback (sent ~2026-08-21 afternoon,
> after the review-workbench upload) never arrived and its contents are
> unknown. Eli: re-send, and these rows get filled in.

## Owner feedback queue

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
