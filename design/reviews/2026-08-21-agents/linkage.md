# Memory tool review — navigation, cross-surface linkage, missing connections

> **Status: audited 2026-08-22.** This report carries the findings as written
> on 2026-08-21, unedited. The codebase moved a long way since. The P0 batch
> shipped and a shared `src/ui/` component layer came out of it, so the line
> numbers cited below no longer resolve. Every **[critical]** or **[high]**
> finding now carries an inline status marker (`SHIPPED`, `OPEN`,
> `SUPERSEDED`, `UNVERIFIED`) naming the evidence. Findings without a marker
> went unaudited: check them in the current code before acting on them, or
> you'll re-fix something already fixed.

Scope: `#/memory/review|vault|sources` at 1280x800 and 390x844, driven through
Playwright on the shared read-only instance, cross-checked with source in
`/Users/eli/code/mc-port/src/tools/memory/`. Gaps already in BACKLOG.md are out
of scope: rejected-suggestion `would have targeted` hints, Cmd-K palette
entries, review query language, dupe and add_link cluster actions, the
tap-target sweep.

## Findings

- **[high] [bug]** — On mobile, tapping a claim row never opens the claim detail. Touch can't reach ClaimDetail at all. Tapping `.mem-mid` twice on the first row at 390x844 showed only the focus highlight and no stacked detail. Cause: `focusRow` in `Review.tsx` sets `detailKey` only when `desktop` is true, and the only other setter is the Enter/o/e key handler. Vault rows work, because `NoteRow` sets `openId` directly. Fix: set `detailKey` unconditionally in `focusRow`. **[SHIPPED — the roving-focus `onFocus` callback sets `detailKey` unconditionally, so a tap opens the stacked detail. Verified by tapping `.mem-mid` at 486x1085 (`Review.tsx`).]**

- **[high] [missing-linkage]** — A vault note has no path to the drafts or claims that target it. The review↔vault round trip is one-way. The vault editor offers link NoteRefs, Dedupe, Save, Archive, and Delete, with nothing like upstream's "Review related drafts." Its own helper text says "pruning here is what unblocks the queue," yet it offers no route to those pending claims. Fix: a "related claims (n)" affordance on the vault editor and NotePeek that navigates to review pre-filtered. The target-facet infrastructure already exists (`activeFacets` + `GROUPERS.target`). **[`OPEN` — `NoteEditor` still offers only status, links, per-section dedupe, Save, Archive, and Delete. Grepping the tool finds no related-claims affordance, and no writer of `activeFacets` outside Review and the Sources handoff (`src/tools/memory/Vault.tsx`).]**

- **[medium] [bug]** — On a `create_note` claim, the target NoteRef is a dead link. Clicking "Harbour 904998" in ClaimDetail produced the error toast `world_harbour_904998: 404 Not Found — Long-term memory note not found`. The note doesn't exist yet, but the link renders identically to a live one. Fix: for `create_note`, peek the *proposed* note (the payload is right there in `m.note`) or render a non-link `will be created` chip.

- **[medium] [missing-interaction]** — Escape doesn't close NotePeek, and the peek has no focus management. Opening the source-note peek from ClaimDetail and pressing Escape left it open. Only a scrim-click or × closes it. `NotePeek.tsx` has no key handler, doesn't move focus into the dialog on open, and doesn't restore focus to the trigger on close. DESIGN §3 mandates all three. A keyboard user must tab across the whole page to reach ×.

- **[medium] [missing-linkage]** — NotePeek is terminal: no "open in vault editor" from a peek. Peek buttons are only link-refs and ×. To act on what you're reading, you must close the peek, switch to Vault, and re-find the note by title by hand. Fix: an "edit in vault" action in the peek header, which needs note deep links or a `vaultOpenId` signal.

- **[medium] [missing-interaction]** — Chained peeks replace with no way back. In the vault editor for "Sherlock Holmes and Watson" a peek on `timeline_sherlock_64af50_2` and a click on its `caused_by` link replaced the peek with a one-panel "Sherlock Holmes" carrying only ×. Following a `caused_by` chain two hops deep and returning means re-navigating from the original surface. Fix: a small breadcrumb or back stack inside the peek. The no-nesting rule is right. Replacement just needs history.

- **[medium] [missing-linkage]** — Nothing deep-links to a specific note or claim. `#/memory/vault/note_whatever` loads the plain vault list and ignores the rest segment. The hash never reflects `openId` or `detailKey`. DESIGN §0 names hash routing "for deep links" as a stack rationale, and the BACKLOG's Cmd-K item ("open note") has nothing to target without it. Fix: `#/memory/vault/:noteId` and `#/memory/review/:draftId/:mutationId`, read on mount, written on open.

- **[medium] [usability]** — (mobile) Browser or hardware back exits the surface instead of closing the stacked screen. Opening the vault editor stack at 390x844 and pressing browser back landed on `#/memory/review` with the editor gone, only because Vault unmounted. The peek behaves the same way, and so will the claim stack once it opens on tap. None of them participate in history, so the Android back gesture is a context-loss trap. Fix: hash-backed detail state, or a `history.pushState` guard for overlays.

- **[medium] [usability]** — The Sources→Review handoff filter applies, but it's invisible and no control removes it on its own. In the simulated handoff for `source_lorebook_8a229bc7f90b7590` the queue correctly shows "7 of 17" with the Facets chip badged 1, and nothing says *which* source is filtering it. The value is discoverable only inside the facet sheet. DESIGN §4 asks for "active filters as removable chips." Fix: render active facet values as labeled removable chips in the second chiprail, beside the "7 of 17" count.

- **[medium] [usability]** — Clicking the "Review Queue" tab wipes active facets with no warning. With the source filter applied, clicking the already-active Review tab cleared it, and so did returning from Vault through the tab. `MemoryTool.tsx`: `onClick={() => { if (v.id === "review") activeFacets.value = new Map(); … }}`. That's a nav control with a hidden destructive side effect, and an inconsistent one, since `detailKey` and `cursor` *survive* the same round trip. Fix: don't clear on tab click. Filters are already visibly clearable.

- **[medium] [usability]** — Vault loses all its state on any tab round trip, while Review keeps its state. Typing "harbour" (7 match), opening a note, then going Review → Vault leaves the query empty, the editor closed, and the sort and type filters reset. Cause: Vault state is `useState` in a component that unmounts, and Review state is module-level signals. Every review→vault→review errand, such as prune-then-retry after a cap failure, pays this tax twice. Fix: hoist vault query, filter, and `openId` to signals like Review's.

- **[medium] [missing-linkage]** — On the sources surface, nothing links onward to the review queue or the vault, except in the transient just-imported result card. Live rows show *Already imported*, *Context changed* and *Extraction incomplete* with no link to the existing source note and no "n claims pending review" affordance. The word *review* appears nowhere on the surface, despite 2 pending drafts from these sources. The `focusSource` handoff exists but is reachable only in the seconds after an import. Fix: on non-new rows, show a pending-draft count linking through `focusSource` to review, plus a NoteRef to the imported source note.

- **[medium] [missing-linkage]** *(code-verified: no blocked drafts on the test instance)* — Blocked-draft cards show only aggregates. `Obligations` in `Review.tsx` renders the reason code, draft count, summed `mutationCount` ("N claims held"), message and a re-extract button. `b.sourceNoteId` is in the data but never rendered, so there's no NoteRef to the blocked source and no way to see which claims a card holds. On the live corpus (45 blocked drafts per BACKLOG) that's one opaque card summarizing 44 sources. Fix: expandable per-source rows inside the card, each with a source NoteRef and held-claim summaries.

- **[low] [missing-linkage]** — No backlink traversal: links are one-way. Peeking the lorebook source note shows no links section at all, though a memory note points at it through `extracted_from`, and `caused_by` targets behave the same way. So "what came from this source?" and "what did this revision cause?" are unanswerable from the object itself. Fix: a computed reverse-links section in NotePeek and the vault editor, since `notesById` already holds every note client-side.

- **[low] [missing-linkage]** — Group headers aren't linked to their object. Grouped by source, the header "Lorebook - Ashgate…" has zero interactive elements, so you can't peek the source note from its own group. Grouped by target, "open note" exists only if the stored note has sections and you expand the stored block first. Group heads for create-targets and empty notes have no affordance. Fix: make the group label a NoteRef when the id resolves to a note.

- **[low] [usability]** — The status line numbers dead-end. "23 memories · 4 sources · index healthy" in the nav bar has zero interactive elements at either viewport. "23 memories" → vault and "4 sources" → vault-sources toggle are the obvious hops, and index health links nowhere even when it's unhealthy. Fix: make the counts navigate.

- **[low] [usability]** *(code-verified: no restating rows live at test time)* — Link labels in the "restates the vault" section use the raw note id, not a title. `ClaimDetail.tsx` renders `<NoteRef id={r.restates.noteId} />` with no `label`, unlike every other ref, which shows a title. `notesById` can supply it. Fix: `label={notesById.value.get(r.restates.noteId)?.title}`.

## Count summary

**16 findings** — 2 high, 10 medium, 4 low. Precise tags: bug 2, missing-interaction 2, missing-linkage 7, usability 5.

The connective tissue that exists is good: NoteRef→peek, claim→source/target, sources→review handoff, stored-group→note. The systemic gaps are the *reverse* directions, meaning vault→claims, source→its products, and backlinks. No object has an address, and that missing per-object deep link is also the root of the mobile back-button trap and the peek's dead end.
