# Memory tool — mobile ergonomics, keyboard and focus accessibility, design-system compliance

> **Status: audited 2026-08-22.** This report carries the findings as written
> on 2026-08-21, unedited. The codebase moved a long way since. The P0 batch
> shipped and a shared `src/ui/` component layer came out of it, so the line
> numbers cited below no longer resolve. Every **[critical]** or **[high]**
> finding now carries an inline status marker (`SHIPPED`, `OPEN`,
> `SUPERSEDED`, `UNVERIFIED`) naming the evidence. Findings without a marker
> went unaudited: check them in the current code before acting on them, or
> you'll re-fix something already fixed.

Tested live at 390x844 (isMobile+hasTouch), 768x1024 and 1280x800 on
`http://127.0.0.1:7875/#/memory/*`. Sources: `src/tools/memory/*.tsx`,
`src/styles/memory.css`, `lorebooks.css`, `base.css`, `tokens.css`,
`shell.css`.

## Findings

- **[critical] [mobile]** — Touch can't reach the claim detail. Tapping a row only sets the cursor: `focusRow` in `Review.tsx` does `if (desktop) detailKey.value = key`, and the only other paths that set `detailKey` are Enter/o/e in the list keydown handler. Measured: a tap on `.mem-mid` gives `stackOpen: false`, `rowFocused: true`. The stacked detail opened only after a hardware-keyboard Enter. Everything in `ClaimDetail` is dead weight on a phone *and* on a touch tablet, since 768px shows the same single-pane layout. That means text editing, diffs, conflicts, evidence, restates/dupe context, and deciding from the detail. Fix: in `focusRow`, set `detailKey` on mobile too, so a tap opens the stacked screen. The tri rail already covers tap-to-decide. **[SHIPPED — the roving-focus `onFocus` callback sets `detailKey.value = key` unconditionally, and `ClaimRow`'s tap handler goes through it. Verified by tapping `.mem-mid` at 486x1085, which opens `.stack-screen` (`Review.tsx`).]**

- **[high] [mobile]** — Hardware and browser back exit the app instead of closing overlays. With the stacked detail open, `history.length` stayed at 2 and back navigated to `about:blank`. Stacked detail, facet sheet and note peek push no history state, since all three are signals: `detailKey`, `facetSheetOpen`, `peeked`. On Android that feels like data loss, because a mid-triage back gesture leaves the console entirely. Fix: `pushState` on overlay open, close on `popstate`. **[SHIPPED — `src/shell/overlays.ts` pushes a history entry per overlay and closes down to the depth `popstate` reports. Measured `history.length` 2 → 3 on opening the stacked detail, and browser back closed the facet sheet while staying on `#/memory/review`.]**

- **[high] [a11y]** — The Escape contract (DESIGN §3) breaks whenever focus sits inside the thing to close, because the only keydown handler lives on `.audit-list`. Measured: Esc with focus on a decide button inside the stacked detail leaves it open, and Esc with focus on a facet row inside the sheet leaves the sheet open. Both close only with focus back on the list. The note peek **never** closes on Esc, at any viewport and any focus, since `NotePeek.tsx` has no key handling and `onListKey` doesn't know about it. BACKLOG's "Esc dismisses the sheet (done)" holds only while focus never entered the sheet. Fix: document-level Escape dispatch over an overlay stack. **[SHIPPED — a capture-phase document listener in `src/shell/overlays.ts` handles Escape by calling `history.back()`, and every layered surface, `NotePeek` included, now goes through `<Sheet>`, which registers itself. Verified with Escape from a button inside the stacked detail and from a control inside the facet sheet.]**

- **[high] [design-compliance]** — Density at 390x844: **4 rows fully visible, 5 partial**, where DESIGN §2/§7 targets ~10+/~11. Sticky chrome takes mem-nav 45px + console 120.8px + bottom rail 53px, or 219px, 26% of the screen. Rows run 57–114px. The real cost is per-group scaffolding: grouphead 46px + a `Keep group / Drop group` action row 50px = **96px per group**. With **8 of 12 groups holding a single row**, the scaffold-to-content ratio for singles exceeds 1. The Vault renders 10 rows on the identical screen, so the audit row itself is fine. Fix: suppress `group-actions` for single-row groups, where the tri does the same job, or fold bulk actions into the grouphead. **[SHIPPED — the per-group action row no longer exists. Bulk keep/drop are icon buttons in the group head, and rows measure 41px. Re-measured at 390x844 on the current corpus: 8 rows fully visible, 9 partial, 0 `.group-actions` in the list. That's short of the ~10 target, but the scaffolding this finding named no longer exists (`Review.tsx` `GroupBlock`, `src/ui/ListGroup.tsx`).]**

- **[high] [a11y]** — No roving tabindex anywhere in the review list. `.audit-list` holds 73 tabbable elements: 17 rows x 2 buttons, plus header chips, plus group actions. Crossing the list to the apply dock takes ~74 Tab presses. DESIGN §3 mandates one tab stop per composite. Note that j/k *does* work with focus on any control inside the list, since the handler bubbles, verified from a header chip. So the roving pattern needs only `tabindex=-1` on non-cursor row controls plus a focus-follow. **[`OPEN` — `useRovingFocus` moves the cursor and calls `focus()`, and nothing sets `tabindex=-1` on non-cursor row controls. Measured 279 tabbable elements inside `.audit-list` at 390x844 and 486x1085, 3 per row. The lorebook audit does set `tabIndex={props.isFocused ? 0 : -1}` per row, so the pattern exists in the repo and the queue never adopted it.]**

- **[medium] [mobile]** — The apply dock completely obscures the bottom tool nav. At 390px the dock (fixed, z-40, measured 102px, spanning y 742–844) covers the rail (top 791). You can't switch to Lorebooks or Presets while any decision exists. At ≥900px the dock starts at `left: 64px` while the rail is **84px** wide, a measured 20px overlap onto the rail (`memory.css` `.apply-dock { left: 64px }`, `shell.css` grid `84px`). List content is safe, since the last row scrolls clear (padding-bottom 132px > dock 102px). A dock with warnings and a restore link (3 info lines) will eat most of that 30px margin.

- **[medium] [usability]** — Sticky group headers vanish under the sticky console. A grouphead pins at y 45–91 after scrolling, while the console occupies 45–165.8 at higher z (grouphead `top: 0; z-index: 5`, console `z-index: 20`, `lorebooks.css`). The context sticky headers exist to hold, which memory you're deciding on, is invisible mid-scroll on all three viewports. Fix: offset `top` by console height through a CSS var, or un-stick.

- **[medium] [a11y]** — Focus rings are invisible on the active nav rail item. `.rail-item.is-active` sets `box-shadow: inset 0 0 0 1px var(--accent)` (specificity 0,2,0), which overrides the `:focus-visible` ring (0,1,0) with no other sign. Measured: a focused active item shows only the 1px inset, identical to its unfocused state. Every other sampled control shows the proper 2px+4px ring.

- **[medium] [mobile]** — Undo is touch-unreachable exactly when it's most wanted. The dock, the only touch Undo, renders only while `keep+drop > 0` (`ApplyDock` early return). `Reset shown`, or undeciding the last row, empties the tally, so the dock unmounts with `canUndo` still true and the `u` key is the only path left. Undo-over-confirm (DESIGN §2) needs a touch path that survives the tally hitting zero, such as an undo toast on bulk reset.

- **[medium] [design-compliance]** — No `?` shortcut cheat sheet exists, grepped over shell and tool, and DESIGN §3 mandates it. That's moot on mobile. On desktop the whole a/d/x/space/u vocabulary reaches the user only through the empty-detail-pane hint, which disappears once a claim is open. (The Cmd-K palette exists with proper `aria-modal`. Its missing memory entries are already in BACKLOG. The missing `?` sheet isn't.)

- **[medium] [mobile]** — Facet sheet: the header (Clear + x) is `position: static` inside the scrolling sheet. Content is 980px in a 657px sheet (26 facet rows), and at scroll bottom Clear sits at y −122, off screen. Clear *is* visible on open without scrolling (BACKLOG item verified ✓). Clearing or dismissing after browsing the long tail needs a scroll back, or the discovery of the 186px scrim strip. Fix: make `.peek-head` sticky within the sheet.

- **[medium] [design-compliance]** — Worst offenders among the known `279 soft tap-target warnings`:
    1. **facet rows at 34px min-height with 0px gap, 26 stacked adjacent**. DESIGN's secondary floor requires ≥8px spacing, so this is the largest violation cluster.
    2. **the chip rail gap of 4px, under the mandated ≥8px** (`.chiprail { gap: 4px }`).
    3. **stacked-detail and vault back buttons ‹ at 38x38 without `.hit`**, a primary navigation control on a stacked screen, which should be ≥44px.
    4. export ⭳ at 38x38 without `.hit`.
    5. `.notelink` inline note refs at ~32px height, 12px mono.

    Not a problem: the tri rail (40x24 + `.hit` → effective 44x44) and the peek x (38px + `.hit` → 44).

- **[low] [mobile]** — Chip rail discoverability: 1259px of chips in a 366px viewport (3.4 screens), scrollbar suppressed, no edge fade, though the row metaline has a fade mask. Group-by and sort live 1–2 screens off canvas, and only the clipped "Conflicts" chip hints there's more. Same pattern on `mem-nav`, where the status line ("23 memories · 4 sources · index healthy") is entirely off canvas at 390 with no indicator.

- **[low] [mobile]** — The export glyph ⭳ renders as tofu at 390, since the loaded faces lack U+2B73. The only backup-export affordance is then a meaningless box, and while the aria-label is present, sighted users get nothing. Fix: use an SVG or a covered glyph.

- **[low] [design-compliance]** — Engine identifiers set in the prose face: facet values `create_note`, `append_section`, `add_link` and `timeline_event` render in Source Sans through `.fv.t-prose` (verified computed font). DESIGN §1 puts keys and ids in the data face, ligatures off. Everything else spot-checked clean: claim text prose, metaline mono, status line mono, tally tabular.

- **[low] [design-compliance]** — `data-density="compact"` works but buys nothing here: row height 113.6 → 105.6px, still exactly 4 rows fully visible. The 4-line clamp and the wrapped metaline drive row height. Compact doesn't touch the grouphead or group-actions overhead that actually costs the screen.

- **[low] [a11y]** — Tab badges concatenate into the accessible name: the review tab announces as `Review Queue2`, from a badge `<b>2</b>` inside the button with no screen-reader context. Screen-reader users hear a mystery number. Give the badge an `aria-label` ("2 pending drafts"), or `aria-hidden` plus a label on the button. Dialog semantics are also incomplete. Sheet and peek carry `role=dialog` with no `aria-modal`, focus never moves in (measured `focusIn: false`) and never returns to the trigger. `.stack-screen` has no role at all.

- **[low] [usability]** — While preflight is in flight the dock contradicts itself. The primary reads `Apply decided (0)`, disabled, while the info line says `1 draft will be sent`. No in-flight indication separates 0 ready from still checking.

## What passed (measured)

- reduced motion fully honored (emulated → all `transitionDuration: 0s`, global kill in `base.css`)
- strong focus rings (2px canvas + 4px accent) on every sampled control except the active rail item
- zero console and page errors on all screens visited
- tri rail: no accidental-tap risk, effective 44x44, only 2px lateral overlap into the row-open target, and its vertical `.hit` overflow lands in dead rail space
- all icon-only buttons carry aria-labels, the tri label announces current state plus action, chips carry `aria-pressed` (16 toggles), tabs use `aria-current="page"`
- scrim tap dismisses sheet and peek
- the desktop keyboard loop (j/k, a/d with autoadvance, x, space, Enter, u) works, including with focus on non-row controls
- Vault: 10 rows per screen, tap opens the editor, permanent delete is confirm()-guarded
- Sources selection circles labeled per row ("Select {title}")

## Count summary

**18 findings: 1 critical, 4 high, 7 medium, 6 low.** By category: mobile 8, a11y 5, design-compliance 6, usability 2 (primary category).

The three structural fixes worth the most:

- set `detailKey` on mobile tap, which unlocks the entire detail surface
- move Escape and back handling to a document-level overlay stack with history integration
- suppress single-row group scaffolding, which about doubles visible rows toward the ~10 target
