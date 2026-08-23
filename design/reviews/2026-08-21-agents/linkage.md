# Memory tool UX review — navigation, cross-surface linkage, missing connections

> **Status: audited 2026-08-22.** This is the report as it was written on
> 2026-08-21, and its findings have not been edited. The codebase has moved
> substantially since — the P0 batch shipped and a shared `src/ui/` component
> layer was extracted — so the line numbers cited below no longer resolve and
> some findings describe surfaces that have since been rebuilt. Every finding
> at **[critical]** or **[high]** severity now carries an inline status marker
> (`SHIPPED`, `OPEN`, `SUPERSEDED` or `UNVERIFIED`) naming the evidence.
> Findings without a marker were not audited: check them against the current
> code before acting on them. The reason this header exists is that the next
> reader, human or agent, will otherwise re-fix a bug that is already fixed, or
> "restore" a bug while reverting what looks like drift.

Scope: `#/memory/review|vault|sources` at 1280x800 and 390x844, driven via Playwright against the shared instance (read-only), cross-checked against source in `/Users/eli/code/mc-port/src/tools/memory/`. BACKLOG-known gaps (rejected-suggestion "would have targeted" hints, Cmd-K palette entries, review query language, dupe/add_link cluster actions, tap-target sweep) are excluded.

## Findings

- **[high] [bug]** — On mobile, tapping a claim row never opens the claim detail; ClaimDetail is unreachable by touch. Tried tapping `.mem-mid` on the first row at 390x844, then tapping again: only the focus highlight appears, no stacked detail. Cause: `focusRow` in `Review.tsx` only sets `detailKey` when `desktop` is true, and the only other setter is the Enter/o/e key handler — which touch users don't have. (Vault rows work fine — `NoteRow` sets `openId` directly.) Fix: in `focusRow`, set `detailKey` unconditionally (or on non-desktop, on second tap of the focused row). **[SHIPPED — the roving-focus `onFocus` callback sets `detailKey` unconditionally, so a tap opens the stacked detail; verified by tapping `.mem-mid` at 486x1085 (`Review.tsx`).]**

- **[high] [missing-linkage]** — A vault note has no path to the drafts/claims that target it (the review↔vault round trip is one-way). The vault editor for a note offers only: link NoteRefs, Dedupe, Save, Archive, Delete; nothing like upstream's "Review related drafts". The irony: the editor's own helper text says "pruning here is what unblocks the queue," yet offers no way to get to those blocked/pending claims. Fix: a "related claims (n)" affordance on the vault editor (and NotePeek) that navigates to review pre-filtered — the target-facet infrastructure already exists (`activeFacets` + `GROUPERS.target`). **[OPEN — `NoteEditor` still offers only status, links, per-section dedupe, Save, Archive and Delete; grepping the tool finds no related-claims affordance and no writer of `activeFacets` outside Review and the Sources handoff (`src/tools/memory/Vault.tsx`).]**

- **[medium] [bug]** — On a `create_note` claim, the target NoteRef is a dead link: clicking "Harbour 904998" in ClaimDetail produced the error toast `world_harbour_904998: 404 Not Found — Long-term memory note not found`. The note doesn't exist yet, but the link renders identically to live links. Fix: for `create_note`, either peek the *proposed* note (the full payload is right there in `m.note`) or render a non-link "will be created" chip.

- **[medium] [missing-interaction]** — Escape does not close NotePeek, and the peek has no focus management. Opened the source-note peek from ClaimDetail, pressed Escape → peek still open; only scrim-click or × closes it. `NotePeek.tsx` has no key handler, doesn't move focus into the dialog on open, and doesn't restore focus to the trigger on close — DESIGN §3 mandates all three. A keyboard user must tab across the whole page to reach ×.

- **[medium] [missing-linkage]** — NotePeek is terminal: there is no "open in vault editor" from a peek. Peek buttons are only link-refs and ×. To act on what you're reading (prune a near-cap section, fix keywords) you must close the peek, switch to Vault, re-find the note by title by hand. Fix: an "edit in vault" action in the peek header — which needs note deep links or a `vaultOpenId` signal.

- **[medium] [missing-interaction]** — Chained peeks replace with no way back. From vault editor "Sherlock Holmes and Watson" → peeked `timeline_sherlock_64af50_2` → clicked its `caused_by` link → peek replaced by "Sherlock Holmes", one panel, only "×". Following a `caused_by` chain two hops deep and returning means re-navigating from the original surface. Fix: a small breadcrumb/back stack inside the peek (the no-nesting rule is right; replacement just needs history).

- **[medium] [missing-linkage]** — No deep link exists to a specific note or claim. `#/memory/vault/note_whatever` loads the plain vault list, silently ignoring the rest segment; `openId`/`detailKey` are never reflected in the hash. DESIGN §0 names hash routing "for deep links" as a stack rationale, and the BACKLOG's Cmd-K item ("open note") has nothing to target without this. Fix: `#/memory/vault/:noteId` and `#/memory/review/:draftId/:mutationId`, read on mount, written on open.

- **[medium] [usability]** — (mobile) Browser/hardware back exits the surface instead of closing the stacked screen. Opened the vault editor stack at 390x844, pressed browser back → landed on `#/memory/review` with the editor gone only because Vault unmounted. Same for the peek and (once fixed) the claim stack: none participate in history, so the Android back gesture is a context-loss trap. Fix falls out of hash-backed detail state, or a `history.pushState` guard for overlays.

- **[medium] [usability]** — The Sources→Review handoff filter applies but is invisible and not individually removable. Simulated the handoff for `source_lorebook_8a229bc7f90b7590` → queue correctly shows "7 of 17" with the Facets chip badged "1" — but nothing says *which* source is filtering the queue; the value is only discoverable inside the facet sheet. DESIGN §4: "active filters as removable chips". Fix: render active facet values as labeled removable chips in the second chiprail next to "7 of 17".

- **[medium] [usability]** — Clicking the "Review Queue" tab silently wipes active facets. With the source filter applied, clicking the already-active Review tab cleared it ("7 of 17" → gone; also reproduced when returning from Vault via the tab). `MemoryTool.tsx`: `onClick={() => { if (v.id === "review") activeFacets.value = new Map(); … }}`. A nav control with a hidden destructive side effect — and inconsistent: `detailKey`/`cursor` *survive* the same round trip. Fix: don't clear on tab click; filters are already visibly clearable (and would be more so with the chips above).

- **[medium] [usability]** — Vault loses all its state on any tab round trip, while Review keeps its state. Typed "harbour" (7 match), opened a note, went Review → Vault: query empty, editor closed, sort/type filter reset. Cause: Vault state is `useState` in a component that unmounts, Review state is module-level signals. Every review→vault→review errand (the tool's core loop, e.g. prune-then-retry after a cap failure) pays this tax twice. Fix: hoist vault query/filter/openId to signals like Review's.

- **[medium] [missing-linkage]** — The sources surface never links onward to the review queue or the vault except in the transient just-imported result card. Live rows show "Already imported", "Context changed", "Extraction incomplete" with no link to the existing source note, and no "n claims pending review" affordance — the word "review" doesn't appear anywhere on the surface despite 2 pending drafts from these very sources. The `focusSource` handoff exists but is only reachable in the seconds after an import. Fix: on non-new rows, show pending-draft count linking through `focusSource` → review, and a NoteRef to the imported source note.

- **[medium] [missing-linkage]** *(code-verified; no blocked drafts on the test instance)* — Blocked-draft cards show only aggregates: `Obligations` in `Review.tsx` renders reason code, draft count, summed `mutationCount` ("N claims held"), message, and a re-extract button. `b.sourceNoteId` is in the data but never rendered — no NoteRef to the blocked source, no way to see *which* sources or *what claims* are held. Against the live corpus (45 blocked drafts per BACKLOG) that's one opaque card summarizing 44 sources. Fix: expandable per-source rows inside the card (source NoteRef + held-claim summaries).

- **[low] [missing-linkage]** — No backlink traversal: links are one-way. Peeking the lorebook source note shows no links section at all, though a memory note points at it via `extracted_from`; same for `caused_by` targets. So "what came from this source?" and "what did this revision cause?" are unanswerable from the object itself. Fix: computed reverse-links section in NotePeek/vault editor (all notes are already client-side in `notesById`).

- **[low] [missing-linkage]** — Group headers aren't linked to their object. Grouped by source, the header "Lorebook - Ashgate…" has zero interactive elements — you cannot peek the source note from its own group. Grouped by target, "open note" exists but only if the stored note has sections *and* you expand the "stored" block first; group heads for create-targets and empty notes have no affordance. Fix: make the group label a NoteRef when the id resolves to a note.

- **[low] [usability]** — The status line numbers dead-end: "23 memories · 4 sources · index healthy" (nav bar, both viewports) has zero interactive elements. "23 memories" → vault and "4 sources" → vault-sources toggle are obvious hops; index health links nowhere even when unhealthy. Fix: make the counts navigate.

- **[low] [usability]** *(code-verified; no restating rows live at test time)* — The "restates the vault" section labels its link with the raw note id: `ClaimDetail.tsx` renders `<NoteRef id={r.restates.noteId} />` with no `label`, unlike every other ref which shows a title. `notesById` can supply the title. Fix: `label={notesById.value.get(r.restates.noteId)?.title}`.

## Count summary

**16 findings** — 2 high, 10 medium, 4 low. Precise tags: bug 2, missing-interaction 2, missing-linkage 7, usability 5.

The connective tissue that exists (NoteRef→peek, claim→source/target, sources→review handoff, stored-group→note) is genuinely good; the systemic gaps are the *reverse* directions (vault→claims, source→its products, backlinks) and the fact that no object has an address (no per-note/claim deep links), which is also the root of the mobile back-button trap and the peek's dead-end nature.
