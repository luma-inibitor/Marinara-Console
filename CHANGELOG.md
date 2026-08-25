# Changelog

What has shipped in Marinara Console, written for the person using it. `BACKLOG.md` is what is owed and `.decisions/` is what was chosen; this is what was delivered.

One sentence per change, phrased as what you now see or can do, with the pull request in parentheses. There are no releases and no version tags — `package.json` carries the npm default and means nothing — so everything sits under Unreleased until that changes. Purely mechanical changes with no product impact do not need an entry; the Internal section below is a summary, not a log.

## Unreleased

### Added

- The memory console arrived: a review queue for proposed memory changes, a vault of saved memories, and a sources importer (#5).
- A memory opens as one screen where every section expands in place, a long section's header sticks so you can collapse it without scrolling back, and the retrieval block is the only bordered surface — boxed means metadata, unboxed means content (#13).
- Scope filters the vault and the review queue on the same rule, so the two can no longer disagree about whether a memory belongs to the current scope (#13).
- A presets tool lets you browse prompt presets and open an editor where each section is one full-width tap row carrying role, token count, marker and group, with a per-mode meter totalling what the preset spends; stock presets are read-only, with a duplicate-to-edit path (#1).
- A fullscreen text editor is available from both the lorebook and the preset tools (#1).
- `g l`, `g p` and `g m` jump between tools, `?` opens a cheat sheet, and Cmd-K finds prompt presets and deep-links into their editor (#1).
- Going offline raises a persistent banner that says what still works, distinguishes "no network" from "engine asleep", and reconnects on its own with backoff (#4).
- A dead link lands on a real not-found state with a way back instead of hanging on "Loading…", and a slow load admits it is slow at three seconds and offers a Try again at twelve (#4, #7).

### Changed

- Editing is explicitly saved: a draft buffer means nothing reaches the engine until you press Save (#3).
- Sources says "Ready to import" instead of "Pending", and the rail lists every source you can act on rather than only the ones never imported — the same corpus that read "Pending 0" over a cleared-backlog empty state now reads "Ready to import 6 · Already imported 8 · All 8" (#44).
- The SOURCES nav badge counts sources waiting for any work, and the empty state explains that the wider view also refills from sources already imported (#44).
- The tooltip for "extraction incomplete" no longer says "extraction finished with rejections" — that state means extraction never finished at all (#44).
- The vault's delete control reads "Archive with extracted memories", its confirm says archiving excludes memories from recall without deleting them, and it has lost the red danger styling because nothing about it is destructive (#24).
- Archived memories no longer appear in the vault list, its tab counts, its type chips or the nav badge, and a list emptied by archiving says "Everything here has been archived." (#24).
- A memory's keyword cap counts only the keywords you added by hand, so memories whose keywords the engine wrote itself no longer read as at-cap or float to the top of the pressure sort; the card lists the effective keywords the engine matches on (#18).
- The note peek renders a memory exactly as the vault's detail screen does — prose relation labels, the keyword tally, the link fold, section counts and collapse-all — while still closing rather than going back (#27).
- A link row in the vault editor reads "extracted from → Devi Okonkwo" instead of a raw relation key and a raw note id (#25).
- A relation reads as prose wherever it appears: "Extracted from" when it starts a row, "— caused by →" mid-sentence in a claim preview (#21, #22).
- On the memory detail head, Edit sits at the right end of the title row and the status pill on the meta row below, trading the places they held (#37).
- Every grouping's header in the review queue carries a glyph — the source's lorebook, chat or character icon when grouped by source, the operation glyph when grouped by change kind — and a group header grouped by source has a kebab with "Open source" (#46).
- Eighteen hand-typed text glyphs are real icons, the character type colour is no longer the selection accent (so a selected filter chip and the character chip are finally distinguishable), and type icons carry their category's hue (#8).
- The 44 elements marked as prose render in the prose face (#9).
- The preset editor's unsaved-changes bar matches the lorebook save bar it was copied from, and small labels such as "dependency", "blocked" and "source:" come from the copy catalog instead of being hand-typed (#45).
- The design mockups are served at `/mockups/`, which no longer 404s when you omit `index.html` (#6).
- The old no-build phone app at `/legacy/` is gone and `/` serves the console (#2).

### Fixed

- The group header's kebab no longer opens behind the next header when the group is collapsed; Escape closes it, and clicking the console bar dismisses it (#41).
- A group header is one 42px line at every width and grouping instead of wrapping its controls onto a second line — nine rows per screen at 390px instead of seven (#46).
- The retrieval card's link rows are no longer padded 52px apart with a slab of blank under the last one; a two-link card is 164px tall instead of 204px (#39).
- The vault list underneath an open detail screen is no longer tabbable, announced to screen readers, or reachable as a tap target while the opaque screen covers it (#37).
- The audit tool's Find and Test segments, the detail card's link rows, and its Edit and collapse-all controls meet the 44px tap floor (#30).
- The "Generated …" line under the queue header is readable — it was 10px faint text at 3.88:1 carrying real data — and the preset editor's role control is announced as a group (#28).
- The fullscreen editor no longer closes itself about ten milliseconds after opening (#13).
- Duplicate detection reports the strongest match, so the queue no longer shows 70% while a verbatim copy sits in the same batch (#13).
- A section being replaced with over-cap content can raise a cap warning, and a section at exactly 20,000 characters is no longer over the cap in one place and under it in another (#13).
- Closing a panel no longer leaks an overlay-stack and browser-history entry, a stale `g` sequence no longer disarms a live one, and filtering the vault by a cap flag re-evaluates when cap pressure changes instead of freezing (#10, #11).
- A save the engine rejects no longer leaves the rejected value on screen; the engine's own field-level message renders at the field (#3).
- Escape or back out of a dirty fullscreen entry rewrite confirms before discarding (#3).
- A concurrent edit from another client is no longer silently clobbered — the conflict names the colliding fields and offers discard-mine or re-apply-mine (#3).
- The lorebook picker no longer renders failed stats as real zeros; loading, failed and empty are distinct, with per-book retry (#3).
- The "×" on an undo toast used to commit the delete immediately; undoable toasts offer no dismiss, the Undo control is a 44px target with a ticking countdown, and bursts coalesce (#4).
- A list emptied by filters names the active filters and lets you clear them individually, instead of claiming nothing matched a search box you never typed in (#4).
- An error page no longer offers "Back to lorebooks" from an unrelated tool, and no longer says "Cannot reach engine" over a 500 or a 403 where the engine answered and said no (#7).
- A green keep-tick no longer appears next to claims you have not decided on (#8).
- The lorebook "untagged" group's heading, styling and Show action work again; a NUL character where a space belonged had killed all three (#8).
- Three buttons that rendered raw catalog key names now show real words, and "{n} match" pluralises correctly in three tools — one of them was rendering "1 drafts" (#8).
- A hint offering "Enter to edit" on desktop, where it did nothing, is gone (#4).

### Internal

- The app was ported from Preact to React 19, and shared components consolidated into one `src/ui/` with co-located stylesheets (#6, #7, #10, #11).
- Layering is enforced rather than described: fetches have an owner in the state layer, an import cycle and a toast store/view tangle are broken, and dead exports and dead CSS ratchet against a recorded baseline (#15, #17, #20, #38, #49).
- The mechanical checks run on every pull request, on the Node version the build pins (#32, #33).
- The browser checks report what they could not reach instead of passing quietly, and several of their own defects are fixed (#14, #23, #31, #34, #35).
- Comments in the stylesheets and provenance stamps in the design docs are cut back to what DESIGN.md §8 allows, and a lint now catches JSX text that never went through the copy catalog (#40, #42, #43, #45).
