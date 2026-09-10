# Memory tool review — wired-but-dead, unwired, inconsistent affordances

> **Status: audited 2026-08-22.** This report carries the findings as written
> on 2026-08-21, unedited. The codebase moved a long way since. The P0 batch
> shipped and a shared `src/ui/` component layer came out of it, so the line
> numbers cited below no longer resolve. Every **[critical]** or **[high]**
> finding now carries an inline status marker (`SHIPPED`, `OPEN`,
> `SUPERSEDED`, `UNVERIFIED`) naming the evidence. Findings without a marker
> went unaudited: check them in the current code before acting on them, or
> you'll re-fix something already fixed.

`/Users/eli/code/mc-port` @ `feat/memory-tool`, scope `src/tools/memory/*` + `server.mjs`.

## Bugs

- **[high] [bug]** — Apply can use a **stale preflight**, sending a mutation to `accept` that the same run just `skip`ped. `applyDecided` snapshots `const pf = preflight.value` (`src/tools/memory/store.ts:339`), but preflight is debounced 500 ms (`store.ts:281`) and nothing awaits it. Flip a row keep→drop and hit Apply inside 500 ms: the row is in `dropsByDraft` (`store.ts:341-346`) **and** still in the stale `pf.readyMutationIds` used at `store.ts:385`. Drops run first (`store.ts:367`), then `acceptDraft` receives a deleted mutation id. The whole draft's accept fails, losing every keep in it. *Fix: in `applyDecided`, await a fresh `runPreflight()`, or drop `pf` and intersect `readyMutationIds` with current keep keys, before building `ids`.* **[SHIPPED — `applyDecided` now `await preflightNow()`s, which clears the debounce timer before running. It also filters the ids it sends by `dropIds`, so a just-skipped mutation can no longer reach `acceptDraft` (`src/tools/memory/store.ts`).]**

- **[high] [bug]** — `AcceptResponse.skippedMutationIds` (`src/tools/memory/data.ts:93`) exists and nothing reads it. `store.ts:392` does `for (const id of res.appliedMutationIds ?? ids)` and marks **all** submitted ids `appliedThisSession`, then deletes their decisions. Server-rejected mutations then stay hidden from the queue for the rest of the session whenever the engine omits `appliedMutationIds` on a partial success. Nothing ever clears the `appliedThisSession` filter at `store.ts:223`. *Fix: subtract `res.skippedMutationIds` before marking, and mark only ids present in `appliedMutationIds` when the field exists.* **[SHIPPED — `applyDecided` builds `const serverSkipped = new Set(res.skippedMutationIds ?? [])` and falls back to `ids.filter((id) => !serverSkipped.has(id))` when the engine omits `appliedMutationIds`, so a server-rejected mutation stays in the queue (`src/tools/memory/store.ts`).]**

- **[medium] [bug]** — **Decision-ledger clobber on remount.** `Review` calls `refresh(true)` on every mount (`src/tools/memory/Review.tsx:40`) → `loadPersisted()` unconditionally overwrites `decisions`/`edited` from the server (`store.ts:130-136`). Meanwhile `persist()` debounces the `PUT` by 700 ms (`store.ts:112`). Navigating Review → Vault → Review within 700 ms of a keypress reverts those decisions with no warning. *Fix: flush the pending persist, or skip `loadPersisted` while `saveState.value === "saving"` or a debounce timer is running.*

- **[medium] [bug]** — A malformed `PUT /console/state/:name` returns **500, not 400**, contradicting the inline comment. `JSON.parse(body.toString())` at `server.mjs:120` has no guard. The throw escapes `handleState` into the top-level catch at `server.mjs:249-252`, which emits `500 {"error":"Unexpected end of JSON input"}`. Empty-body `PUT`s hit this too. *Fix: wrap the parse in try/catch and `res.writeHead(400)` with `{"error":"malformed state"}`.* (Name validation at `server.mjs:100` is fine but largely unreachable, since the router regex `server.mjs:245` already restricts the charset. Only the 60-char cap is live.)

- **[medium] [bug]** — **Unhandled rejection in Vault archive-undo.** `void patchNote(n.id, { status: previous }).then(() => props.onChanged())` (`src/tools/memory/Vault.tsx:206-209`) has no `.catch`. A failed undo `PATCH` shows the user nothing, and the note stays archived while the interface implies a restore. Every sibling path (`Vault.tsx:194`, `:211`, `:223`) toasts on error. *Fix: add `.catch((e) => toast(e.message, { kind: "error" }))`.*

- **[low] [bug]** — **Undo stays armed and misfires after Apply.** `applyDecided` (`store.ts:407-418`) resets `decisions`, `edited`, `preflight`, but never clears `undoStack` (`store.ts:50`) or `canUndo` (`store.ts:145`). The dock's Undo button (`Review.tsx:451`) stays enabled. Pressing it writes decisions for already-applied keys into the ledger, then persists them. Only the next `refresh` prune cleans them up (`store.ts:229-235`). *Fix: `undoStack.length = 0; canUndo.value = false;` at the end of `applyDecided`.*

- **[low] [bug]** — **Stale focus key survives a failed load.** `refresh` reads and removes `mc-ltm-focus-source` at `store.ts:238-245`, but that block sits *inside* the `try` after the `await Promise.all` (`store.ts:214`). A rejected `fetchReview` jumps control to `catch` (`store.ts:247`) and never consumes the key. A later `refresh()`, such as the one at the end of `applyDecided` (`store.ts:418`), then applies a source pre-filter the user never asked for. *Fix: read and remove the key in a `finally`, or before the fetch.*

- **[low] [bug/fragility]** — **The sources→review pre-filter works only by accident of effect ordering.** `Sources` calls `focusSource(id)` then `navigate("memory/review")` (`Sources.tsx:176`). `MemoryTool`'s effect writes `sessionStorage["mc-ltm-focus-source"]` (`MemoryTool.tsx:51-58`), and `Review`'s effect starts `refresh(true)` (`Review.tsx:40`). Preact flushes child callbacks before parent, so `refresh` starts *first*. It works only because `refresh` awaits `loadPersisted()` (`store.ts:211`) before reading the key at `store.ts:238`. Remove that await, or make `loadPersisted` sync-cached, and the handoff stops working with no visible sign. *Fix: have `Sources` write `sessionStorage` directly and delete the `focusSource`/`consumeFocusSource` module-global hop.* (`mc-ltm-chat` is clean: written `Sources.tsx:95`, read `Sources.tsx:36`, no other consumers.)

## Unwired capabilities and dead code

- **[medium] [unwired-capability]** — **No client reads `x-ltm-restore-point`.** The proxy sets it on backup failure (`server.mjs:140`), but `api()` (`src/shell/api.ts:3-17`) never touches `res.headers`, and `grep -rn "headers.get" src/` returns nothing. Nothing shows the operator a write that proceeded with **no restore point**. The only signal is a `console.error` on the server (`server.mjs:139`). *Fix: in `api()`, check `res.headers.get("x-ltm-restore-point") === "failed"` and toast an error once per session.*

- **[medium] [unwired-capability]** — **API routes with no screen.** `data.ts` implements three routes that the proxy reaches and no component calls: `DELETE /rejected-suggestions/:id`, `rebuild`, `integrity`. BACKLOG.md:69 flags the first, and `Rejections()` at `Review.tsx:410-428` only displays them. The vocabulary is vendored (`ltm-en.json:305-307`, `:353`, `:810`). `LtmStatus.indexes.dirty/rebuildState/embeddingsAvailable` has types (`data.ts:98`), while only `.health` renders (`MemoryTool.tsx:76`). `POST /notes` (create) likewise has no caller. *Fix: add the affordances, or move the unused `LtmStatus.indexes` fields and the integrity/rebuild strings out of the shipped surface.*

- **[medium] [unwired-capability]** — **`SectionPressure.current`/`projected` never reach the screen.** `computePressure` (`data.ts:271-299`) fills a full projection map. Its only consumer is the boolean `rowOverflows` (`store.ts:72-74`), used for one chip (`Review.tsx:350`) and one quality flag (`facets.ts:31`). The number the pass exists to produce, how close a section sits to 20k after the keeps, never reaches the interface. `OURS.nearLimit` (`near a limit`, `strings.ts:36`) has **zero** call sites, so the review queue has no warning state between fine and over. *Fix: render `projected/SECTION_CAP` on the group head when `groupBy === "target"`, and wire `OURS.nearLimit` at ≥0.8.*

- **[low] [dead-code]** — The `lines` signal (`store.ts:32`) is a module export. `store.ts:221` sets it, `store.ts:224` reads it one line later in the same function, and no component imports it. *Fix: make it a local `const` in `refresh`.*

- **[low] [dead-code]** — Unused `OURS` entries: `nearLimit` (`strings.ts:36`), `restorePointDone` (`strings.ts:40`), `groupBy` (`strings.ts:47`), `sortBy` (`strings.ts:48`). The group and sort rails use `GROUPERS[].label` / `SORTERS[].label` (`Review.tsx:148-160`) instead. Unused `restorePointDone` means the restore-point download links (`Review.tsx:123`, `:449`) are bare `<a download>` with **no success feedback at all**. *Fix: delete the three unused keys, and use `restorePointDone` in an `onClick` toast on the dock link.*

- **[low] [dead-code]** — `ReviewResponse.counts` fields `sources`, `blockedDrafts`, `candidateRejections`, `deduplications` (`data.ts:82`) have types, but only `.drafts` and `.mutations` reach a reader (`MemoryTool.tsx:68-69`, `Review.tsx:109`). `counts.deduplications` is the engine's own dedup number, and the console's whole derived-signal thesis is about dedup. Surfacing it costs one span. The same goes for `ImportPreview.importedCount` / `samples[].status` (`data.ts:106-113`) and `ImportResult…extractionOutcome` (`data.ts:126`), none of which `ImportResultCard` renders (`Sources.tsx:157-184`).

- **[low] [dead-code]** — `facets.ts:14` defines a private `tokensOf` identical to the exported one in `src/shell/api.ts:20`. *Fix: import it.*

- **On the explicit question: `dedupeLines` is live** — `derived.ts` → `Vault.tsx:13`, `:228-234`, behind the per-section "Dedupe lines" chip (`Vault.tsx:262`).

## Inconsistencies and copy

- **[medium] [inconsistency]** — **The decision meter can never reach 100 %.** The denominator is `review.value?.counts.mutations` (`Review.tsx:109`), which counts mutations belonging to *blocked* drafts. `flattenReview` excludes those rows by design (`data.ts:227`: `if (blockedDraftIds.has(row.draftId)) continue;`), so they're undecidable. `tally.undecided` (`store.ts:65`) uses `rows.value.length` instead, so the header and the dock disagree about the same word. *Fix: use `rows.value.length` for the meter total.*

- **[medium] [inconsistency]** — **Vault promises a capability that doesn't exist.** The empty state renders `t("memoryvault.noSavedMemoriesYetImportASourceOrCreate")` (`Vault.tsx:120`) = *"…or create a memory manually."* (`ltm-en.json:470`). `Vault.tsx` has no create affordance anywhere, and `data.ts` has no `POST /notes` binding. *Fix: swap for a key without the create clause, or add the button.*

- **[medium] [inconsistency]** — **Wrong-screen copy in the Review empty state.** `Review.tsx:178` shows `t("sourcesworkspace.noNewOrRetryableSourcesAreReadyToImport")` = *"No new or retryable sources are ready to import."* (`ltm-en.json:618`) when the **review queue** is empty. It names the Sources screen's condition, not the queue's. *Fix: use a `reviewqueue.*` key.*

- **[medium] [inconsistency]** — **The permanent-delete confirm shows source-note copy for every note.** `Vault.tsx:217` uses `t("sourcesworkspace.deleteImportedSourceKeepExtractedMessage", …)` = *"Permanently delete {x} but keep its extracted memories?"* (`ltm-en.json:630`). On a `character`, `world` or `timeline_event` memory, which is the default Vault tab (`Vault.tsx:51` filters `type !== "source"`), the promise to keep extracted memories is false and misleading about what survives. *Fix: branch on `n.type === "source"`.*

- **[low] [inconsistency]** — **Copy-policy violation:** `Vault.tsx:158` hardcodes the literals `"over the limit"` / `"near a limit"`, while `Review.tsx:350` routes the same words through `OURS.overLimit`. BACKLOG.md's process note requires coined words to go through `OURS`. *Fix: import `OURS` in `Vault.tsx`.*

- **[low] [inconsistency]** — **Header counts go stale after an import.** `MemoryTool`'s `ltmStatus()` effect keys on `[view]` (`MemoryTool.tsx:37-48`), so an import on the Sources screen updates neither the "N memories · N sources" strip (`MemoryTool.tsx:73-78`) nor the pending badge until the user changes tabs. *Fix: re-run `ltmStatus()` after `runImport` (`Sources.tsx:82-85`) and after `applyDecided`.*

- **[low] [inconsistency]** — **Preflight blockers get a count and no itemisation, and blocked keeps never go over the wire.** The dock shows `pf.blockedN` (`Review.tsx:446`) and `applyCount = pf.ready + c.drop` (`Review.tsx:435`), while `PreflightResponse.rows[].blockers/conflicts` (`data.ts:87`) arrives and gets discarded (`store.ts:298-304` reads only the three id-array lengths). A user with 5 blocked keeps sees `· 5 blocked`, presses Apply, and those 5 keep their `keep` decision with no per-row explanation. *Fix: keep `pf.rows` and mark blocked rows in the list.* (BACKLOG.md acknowledges this under `Checks-style one-tap fixes`, but the data is already on the wire.)

- **[low] [inconsistency]** — **`isLtmWrite` prefix edge.** `server.mjs:63` requires `startsWith("/api/long-term-memory/")` with a trailing slash, and `server.mjs:64` excludes read-shaped POSTs by suffix. A request to exactly `/api/long-term-memory` (no slash), or to `/api/long-term-memory/preflight/` (trailing slash), bypasses the intended classification in opposite directions. The three paths named in the brief, `/notes/batch`, `/notes/permanent-delete` and `PUT /settings` under the long-term-memory prefix, **do** correctly trigger a restore point. No live write route slips through. *Fix: normalise trailing slashes before both tests.*

- **[low] [inconsistency]** — **Restore point is once per process**, not per session or per day (`ltmBackupDone`, `server.mjs:59`, set at `server.mjs:85`). A long-running dev server takes exactly one snapshot ever, so day-2 writes have a day-1 restore point. The comment documents this (`server.mjs:52-56`), but it's worth an expiry. *Fix: expire `ltmBackupDone` after N hours.*

## Summary

**20 findings** — 2 high, 9 medium, 9 low.
By category: **bug 7**, **unwired-capability 3**, **dead-code 4**, **inconsistency 6**.

The three highest-value fixes: the stale-preflight skip/accept collision (`store.ts:339`/`:385`), the unread `skippedMutationIds` hiding rows for the session (`store.ts:392`), and the never-read `x-ltm-restore-point` header making a missing backup invisible (`server.mjs:140` versus `src/shell/api.ts:3-17`).
