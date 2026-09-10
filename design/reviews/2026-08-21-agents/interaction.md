# Review Queue — interaction correctness and review-flow usability

> **Status: audited 2026-08-22.** This report carries the findings as written
> on 2026-08-21, unedited. The codebase moved a long way since. The P0 batch
> shipped and a shared `src/ui/` component layer came out of it, so the line
> numbers cited below no longer resolve. Every **[critical]** or **[high]**
> finding now carries an inline status marker (`SHIPPED`, `OPEN`,
> `SUPERSEDED`, `UNVERIFIED`) naming the evidence. Findings without a marker
> went unaudited: check them in the current code before acting on them, or
> you'll re-fix something already fixed.

Scope: desktop 1280×800, live interface at `#/memory/review` driven through
Playwright. Sources: `src/tools/memory/Review.tsx`, `ClaimDetail.tsx`,
`store.ts`, `facets.ts`. Items already in BACKLOG.md go unreported here:
mobile round, tap targets, missing search, cluster actions, blocker-list,
conflict resolution, re-extract cost confirm, rejected-suggestion actions.
Blocked-drafts and apply failure cards weren't exercisable: 0 blocked drafts
in this corpus, and exercising Failures requires Apply. Those get
code-read-only notes.

## Findings

- **[critical] [bug]** Unsaved edit text leaks between claims, and Save can write it onto the wrong claim. Typing into an `append_section` claim's textarea, then clicking the next `append_section` row, showed the first claim's text verbatim in the second textarea: same 101-char value, Save enabled. `ClaimDetail`'s `drafts` state keys by section id (`"__text"` for every append/update row), and nothing keys the component by `row.key`, so state survives row switches. One click on Save writes claim A's text as claim B's pending edit. Fix: `<ClaimDetail key={row.key} …/>`, or key drafts by `row.key + sectionId`. **[SHIPPED — `Review.tsx` renders `<ClaimDetail key={detailRow.key} …/>` at both call sites, the detail pane and the stacked screen, so a row change tears the `drafts` state down.]**

- **[high] [bug]** Keyboard decisions land on invisible, filtered-out rows. With the Undecided quick chip on, `a` on the last row removes it from view while the cursor stays on the hidden row. The next `d` then flipped that hidden row keep→drop, with only the dock numbers moving. With a fully empty filtered list ("No proposals match…"), pressing `a` still recorded a keep on an off-screen row. Cause: `cursorRow()` looks up `rows.value`, not the filtered list, and `move()` clamps onto stale keys. A bonus symptom: after deciding the hidden row, the cursor teleports to the top of the list. Fix: resolve the cursor through `visibleKeys`, advancing to the nearest visible neighbor when the cursor row drops out of the filter, and no-op when the list is empty. **[SHIPPED — `cursorRow()` returns null unless `visibleKeys.includes(key)`, and `decideAndAdvance` picks its next row out of `visibleKeys` before deciding (`Review.tsx`).]**

- **[high] [bug]** Single-key shortcuts hijack focused buttons. Space on a focused chip mutates an unrelated claim, and Enter on a chip goes nowhere. Tabbing to the "Undecided" filter chip and pressing Space left the chip alone and cycled the cursor row's decision to keep. Enter didn't activate the chip either, since its keydown-click gets `preventDefault`ed and re-opens the cursor row's detail instead. `onListKey` exempts only `INPUT`, `TEXTAREA` and `SELECT`, not `BUTTON`. Keyboard users can't operate any chip, and Space is destructive. Fix: bail out of `onListKey` when `ev.target` is a button, or scope single-key handling to the roving list item. **[SHIPPED — `useRovingFocus`'s `ignore()` now holds the guard. It bails when the event target is a button outside `rowSelector` and the key isn't a nav key, so Space and Enter belong to a focused chip again (`src/ui/useRovingFocus.ts`, `Review.tsx`).]**

- **[high] [bug]** Dropping a `create_note` while keeping its dependent `add_link` produces a contradictory dock, and the promised warning never fires. Keeping the `add_link → timeline_revision_64af50` and dropping the create that makes that note left the dock reading `3 ready · 1 added as dependencies · Apply decided (4)`. It claims the dropped create will be autoapplied, and counts it twice: once in ready, once as a drop. The "kept claims depend on a dropped create" warning stayed absent. Cause: `droppedDependencyWarnings` matches on `row.targetId`, but an add_link row's targetId is the link *owner* (char note), not `mutation.link.target`. Preflight also runs over keeps only, blind to local drops. On Apply this would skip the create, then send an accept whose id list includes the now-deleted create. Fix: include `mutation.link.target` in the dependency check, and reconcile `readyMutationIds` with local drops before counting or sending. **[`OPEN` — two of the three halves shipped. `droppedDependencyWarnings` now adds `mutation.link.target` to the dependency set so the warning fires, and `applyDecided` filters `dropIds` out of the accepted ids so the deleted create never goes over the wire. The dock arithmetic stays unreconciled: `applyCount = (pf?.ready ?? 0) + c.drop` still adds the autoincluded dropped create to both terms, and still lists it under "added as dependencies" (`Review.tsx` `ApplyDock`).]**

- **[medium] [bug]** Escape doesn't close the facet sheet once focus is inside it. BACKLOG marks "Esc dismisses the sheet" as done, but it depends on focus. Escape did nothing after a click on a facet value put focus on `.facet-row`. The handler lives on `.audit-list`'s `onKeyDown`, and the sheet renders outside it. Fix: a key handler, or a `keydown` listener, on the sheet itself.

- **[medium] [bug]** Escape never closes the NotePeek dialog. Opening a peek from the stored block and pressing Escape left it open. Only × or a scrim-click closes it, and focus never returns to the trigger (`NotePeek.tsx` has no key handling). That violates DESIGN §3, "Escape closes/back" for a `role=dialog`. Fix: Escape-to-close and focus restore in the `NotePeek`/`FacetSheet` shared scrim code.

- **[medium] [bug]** Trailing decisions vanish on tab close, because the ledger has no unload or blur flush. Decisions made within ~700ms of closing the page never reached `/console/state`. Three whole test sessions persisted nothing, and savedAt stayed stale. Cause: `persist()` is a trailing debounce with no `beforeunload` or `visibilitychange` flush. DESIGN §2 specifies `debounce ~700ms, flush on blur`. Fix: flush the pending persist on `visibilitychange`/`pagehide`, for example through `navigator.sendBeacon`.

- **[medium] [usability]** Autoinclude can transmit undecided claims with zero row-level indication, and "N added as dependencies" doesn't say which. With the create undecided and its add_link kept, the dock read `15 undecided … 1 added as dependencies`. The store's own contract says undecided claims never go over the wire, yet this one will, and the row carries no marker, name, or link. Fix: badge autoincluded rows, for example `will be sent as dependency`, and make the dock phrase enumerable, so a click highlights the rows.

- **[medium] [usability]** Preflight latency makes the dock illegible right after deciding. For ~1.2s (500ms debounce plus request) the button reads "Apply decided (0)" and sits disabled with no pending indicator, then the number jumps. A user's first keep looks like nothing will apply. Fix: show a checking state (per DESIGN §3, indicator delayed ~100ms) and leave the count blank rather than 0 while `pf` is null.

- **[medium] [usability]** The facet sheet can render as a completely blank pane, and the sheet can't clear an active filter value. With the Conflicts quick chip on (0 matches in this corpus), opening Facets showed an empty dialog: no facets, no explanation. The active `has conflicts` value doesn't appear either, since the sheet drops zero-count facets. The sheet's only useful control is then Clear-everything. That violates the DESIGN §4 empty-state rule. Fix: always render selected values, even at count 0, and give the sheet an empty-state line.

- **[medium] [usability]** "Discard changes" is destructive with neither undo nor confirm. Clicking it permanently deleted the saved edit, since the undo stack covers decisions only, which contradicts DESIGN §2, `undo over confirm`. Fix: route `setEdited` through the undo stack, or offer an undo toast carrying the discarded text.

- **[medium] [usability]** Dock copy contradicts itself. One keep and one drop in different drafts produced `2 drafts will be sent · 2 stay pending`, naming the *same* two drafts, because `stayPending` counts touched drafts that still hold undecided claims. It reads as nonsense. Fix: wording such as `2 drafts sent in part · undecided claims stay pending`.

- **[low] [bug]** No-op actions pollute the undo stack, making the first undo look dead. `x` on an already-undecided row, and `a` on an already-kept row, push a snapshot identical to the current state, so the next `u` does nothing visible and toasts `Undid undecide`. Fix: skip `snapshot()` when the value doesn't change.

- **[low] [usability]** Undo toast wording and stacking. Five rapid `u` presses piled up five simultaneous toasts (`Undid undecide`, `Undid drop`…), and `Undid undecide`, which means a decision came back, is confusing. Fix: coalesce or replace the undo toast, and name the restored state, such as `Restored drop on …`.

- **[low] [usability]** Keyboard `u` with an empty stack gives no feedback. Undoing your last decision also removes the whole dock, taking the only visible Undo button with it, while the stack may still hold entries. Fix: toast `Nothing to undo`, and consider keeping the dock while `canUndo`.

- **[low] [usability]** Sort and group changes preserve the cursor key but never scroll it into view. Switching risk→confidence left the focused row ~300px off the top of the viewport (`inView: -294.5`), so the next `j` acts from an off-screen anchor. Fix: `scrollIntoView` the cursor row after a group or sort change.

- **[low] [usability]** A saved edit is invisible in the list row's text. The row keeps rendering the original claim text with only a `the edited change` tag, because `ClaimRow` uses `r.text` and never `edited`. Dropping an edited claim also still counts it in the dock's `1 edited`, though the drop discards the edit, with no warning at either point. Fix: render the edited text in the row, perhaps as strike-and-replace. Also exclude dropped rows from the edited count, or warn when a drop discards an edit.

- **[low] [missing-interaction]** The desktop detail pane can't close and goes stale. Escape is mobile-only, and when filters empty the list, the pane keeps showing a claim that's no longer in view with no "filtered out" indication. Fix: let Escape clear `detailKey` on desktop too, and show a note when the open claim falls outside the current slice.

- **[low] [missing-interaction]** Tab order and discoverability diverge from DESIGN §3. Every row's tri button, every row's mid button and every chip is its own tab stop, with no roving tabindex, so a screen carries dozens of stops. The shell also has no `?` shortcut cheat sheet, since Cmd-K is the only binding, and the shortcut hint appears only in the detail pane's empty state. Fix: roving tabindex on the list, plus a `?` overlay.

- **[low] [missing-interaction]** (code-read: 0 blocked drafts in the test corpus, so not exercisable live) The blocked-drafts card's re-extract button has no busy or disabled state. `reextract` awaits N sequential model-costly extract calls with the button still enabled, so a second click double-fires the batch, and there's no per-item progress. This is distinct from BACKLOG's cost-confirm item. Fix: disable the button with a determinate "extracting i/N" while the loop runs.

## What worked well (verified, no findings)

- j/k clamp correctly at both ends, and `k` from nothing lands on the last row
- a/d autoadvance
- space cycles tri-state in the rail and from the keyboard, with correct aria-labels
- group Keep/Drop with per-group ✓/✗ tallies, and toast-Undo round-trips cleanly
- facet counts exclude each facet's own filter (verified numerically), and OR-within/`AND`-across works
- "stored · n" reveals stored sections, with a working open-note peek
- peek links replace rather than nest
- cross-session resume of the ledger works when the flush lands
- sheet-header Clear keeps the sheet open
- rejections group and expand correctly
- zero console errors throughout

## Count summary

**19 findings: 1 critical · 3 high · 8 medium · 7 low** (bug 11 · usability 8 · missing-interaction 3 by primary tag).
