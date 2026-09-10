# Memory tool — visibility of system state, feedback, information scent

> **Status: audited 2026-08-22.** This report carries the findings as written
> on 2026-08-21, unedited. The codebase moved a long way since. The P0 batch
> shipped and a shared `src/ui/` component layer came out of it, so the line
> numbers cited below no longer resolve. Every **[critical]** or **[high]**
> finding now carries an inline status marker (`SHIPPED`, `OPEN`,
> `SUPERSEDED`, `UNVERIFIED`) naming the evidence. Findings without a marker
> went unaudited: check them in the current code before acting on them, or
> you'll re-fix something already fixed.

Sources: the live app at `http://127.0.0.1:7875/#/memory/*` (23 memories, 4
sources, 2 drafts / 17 claims), and code in
`/Users/eli/code/mc-port/src/tools/memory/`. Display-only response mocks stood
in for the blocked-draft card and the preflight blocked/auto counts, with no
engine writes. Items already in BACKLOG.md go unreported here: grouped
preflight blockers with per-blocker fixes, re-extract cost confirm,
rejected-suggestion actions, cluster actions, persisted apply report, review
text search.

## Review queue

- **[high] [feedback]** — Preflight runs with no sign of itself, and the primary button lies during the window. Pressing `a` left the dock reading `1 keep … Apply decided (0)`, disabled, for the 500ms debounce plus the round trip, with nothing saying a check was running (`store.ts` `schedulePreflight`, `Review.tsx` `ApplyDock`). The user sees a dead button carrying a wrong number. Fix: a `preflightPending` signal. Render `checking with the engine…` in the dock's dim line while it's pending, and label the button `Apply decided (…)` rather than 0. **[SHIPPED — `schedulePreflight()` sets a `preflightPending` signal and `runPreflight()` clears it. The dock renders `· checking with the engine…` and labels the button `Apply decided (…)` rather than (0) while it's true (`store.ts`, `Review.tsx` `ApplyDock`).]**

- **[high] [visibility]** — Dependency autoinclude reports a bare number. The dock showed `1 ready · 2 blocked · 4 added as dependencies`. `pf.perDraft[].pf.autoIncludedMutationIds` and `pf.rows` (per-mutation `autoIncluded`, target, blockers) sit in the store and render nowhere. So the interface tells the user that extra claims they never kept will go over the wire, with no way to see which. Fix: make the dock phrase expandable, listing the autoincluded rows by target title. Same for the blocked count's identity. **[SHIPPED — `preflightRowState` maps every preflight row back to its row key, the dock renders autoincluded and blocked rows as expandable `<details>` lists naming each target title, and `ClaimRow` carries a `dependency` tag (`store.ts`, `Review.tsx`).]**

- **[high] [visibility]** — The decision meter's denominator counts claims the user can't decide. `total = review.counts.mutations` (`Review.tsx`), but `flattenReview` (`data.ts`) excludes blocked drafts' rows. With one blocked draft mocked, the meter read `1 · 0 / 24` over a 17-row list. `Decided x/24` can never complete, and nothing explains the shortfall. Fix: use the decidable count, `rows.value.length`, as the denominator. The blocked card already accounts for held claims (`7 claims held`). **[SHIPPED — `Review.tsx`'s meter now reads `const total = rows.value.length`, the same decidable rows the dock counts.]**

- **[med] [visibility]** — Meter counts are color-only and unlabeled. `1 · 0 / 17` separates keep from drop by emerald and red alone, which violates DESIGN §1's own never-color-alone rule, and `Decided 0 · 0 / 20` teaches a newcomer nothing. The codebase already pairs glyphs elsewhere: group headers `1✓`, dock `✗`. Fix: `✓1 · ✗0 / 17`.

- **[med] [visibility]** — Nothing shows the autosave ledger at rest. `saveState === "saved"` renders an empty string, so `Autosaving…` flashes for ~800ms and then nothing. `Saved` never appears, and no copy anywhere says decisions persist server-side and resume across devices, which is the ledger's whole point. Fix: render `Saved` persistently in the existing `.mem-save` span, and on first run say `Saved — resumes anywhere`.

- **[med] [feedback] [missing-interaction]** — Save failure has no recovery path. `failed` renders `Save FAILED` as small dim header text and nothing else: no toast, no inline error, no retry. The next persist happens only if the user makes another decision. A user who keeps deciding into a dead `/console/state` loses the whole session on another device, with no sign of it. Fix: an error toast plus a `Retry` chip that calls `persist()` immediately.

- **[med] [copy]** — `1 draft will be sent · 1 stay pending` double-counts one draft. `tally.stayPending` counts drafts that sit in `willSend` *and* hold undecided claims, so a single half-decided draft produces both numbers and reads as two drafts. Fix: `1 draft will be sent (still holds 6 undecided claims)`.

- **[med] [feedback]** — Apply is an indeterminate multi-call loop. `applyDecided` iterates drafts one at a time, and the only feedback is the button label `Accepting...`. The journey table says `applying` should show transiently, as progress on the row, and DESIGN §3 wants a determinate bar at 3s and over. Fix: per-iteration progress in the dock (`draft 2/5`) out of the existing loop, plus a transient state on affected rows.

- **[med] [visibility]** — Index-rebuild failure after Apply is toast-only. `store.ts` fires `savedButRecallIsStale` as a toast and nothing else. The journey table specifies a persistent badge, `saved, not searchable`, and DESIGN forbids toast-only errors. The degraded state survives the toast only in the header's `index …` word, which is itself stale. Fix: a persistent obligation card in the queue, plus a badge on affected memories until `indexes.health` recovers.

- **[low] [visibility]** — Preflight errors dead-end. `pf.error` renders raw in the dock and disables Apply, and the only way to retry is to make another decision. Fix: a `couldn't check with the engine — Retry` chip calling `schedulePreflight()`.

- **[low] [visibility]** — Nothing explains the Apply button's arithmetic. With mocked blockers, `3 keep · … · 2 blocked` sat over `Apply decided (1)`. The button subtracts blocked keeps without saying so, and nothing near it states `1 ready + 0 drops; 2 stay pending`. Fix: use that clause as the button's subline or title.

- **[low] [visibility]** — Pressure numbers never reach the screen. `computePressure` produces `current`/`projected` per section, and the interface emits only the binary `over the limit` flag in the row metaline and the facet. The claim detail, the place you'd trim an edit to fit, shows only `1,936 CH` with no cap context. Fix: in `ClaimDetail`, when the target section appears in `pressure`, show `canon 19.4k → 21.3k / 20k`.

- **[low] [copy]** — The claim-edit `Saved` toast overstates. `ClaimDetail.save` stages the edit in the local ledger, which goes over the wire only on Apply, and then toasts the vault's `Saved` string. Fix: `Edit staged — applies with the batch`.

- **[low] [copy]** — The row chip `RESTATES 1.00` is a bare score in the metaline. Its meaning, similarity to a stored line, becomes legible only after opening the detail. Fix: `restates stored` on the row, and keep the score in the detail beside the compared line.

- **[low] [visibility]** — Staleness and engine drops both pass unremarked. `ReviewResponse.generatedAt` and `counts.deduplications` arrive and never render. Neither Review nor Sources has a refresh affordance. Drafts arriving mid-session, and N claims deduped upstream, are both invisible. Fix: a mono meta line, `generated 21:15 · 3 deduped upstream`, plus a refresh button.

## Blocked drafts and obligations

- **[med] [visibility]** — The blocked card never names the source. It rendered `SOURCE STALE 1 draft blocked · 7 claims held`, the engine message, and `EXTRACT TO REVIEW`. `BlockedDraft.sourceTitle` carries a value that nothing uses, so with several sources held the user can't tell *which material* sits stuck, or preview its held claims. The copy also doesn't say that re-extract supersedes the old draft. Fix: list source titles as `NoteRef`s on the card, and add one clause: `re-extracting replaces this draft with a fresh one`.

## Memory vault

- **[med] [visibility] [copy]** — Zero-result searches show the onboarding empty state. Searching `zzzznope` with 23 memories present renders `No saved memories yet. Import a character, lorebook, or chat summary…`, which is the wrong journey: it tells a stocked-vault user their vault is empty. Fix: branch on `query`/`typeFilter` and say `No memories match 'x' — clear search`.

- **[med] [missing-interaction]** — No status facet exists, and archived is never set aside. Resolved and archived notes intermix with active ones, separable only by a metaline word and a Status *sort*. The journey table wants active by default, resolved dimmed, archived aside. Nothing answers `what did I archive?` short of sorting everything. Fix: status chips (`active 26 · resolved 1 · archived 0`) beside the type chips.

- **[med] [feedback]** — Unsaved edits carry no mark and vanish without warning. `NoteEditor` holds edits in `drafts` with no dirty indicator, since Save is always enabled. Switching notes or navigating remounts the editor, which drops the edits. That also deviates from the DESIGN §2 mandate of field-level autosave with a visible save pill. Fix: a dirty dot on Save plus a guard on note switch, or adopt the save-pill autosave pattern.

- **[low] [visibility]** — Cap-meter thresholds disagree, and they hide the sort's signal. Row bars appear only at ≥50% pressure, which is 0 of 23 rows today, so the `↓ Limits` sort visibly does nothing. Row flag text appears at ≥80%, and editor bar colors at 75% and 95%. `pressureOf` also folds keyword-cap pressure into the same number, so a keywords-28/30 row looks identical to a fat section. Fix: one threshold set, always show mini-meters while sorted by Limits, and name the pressured thing (`keywords 28/30`).

- **[low] [visibility]** — Vault saves never report the rebuild outcome. The static footnote teaches the mechanism, and the save path never checks index state afterward. The header's `index healthy` refreshes only on tab switch, so a failed rebuild after a vault save surfaces nowhere. Fix: refetch `ltmStatus` after save and apply, and surface a non-healthy result as the tool-level banner.

- **[low] [copy]** — `23 match` / `0 match` needs pluralization (`matches`).

## Sources

- **[med] [visibility]** — Loading previews leave the pane fully blank. With a 2.5s response, only the scope header renders, with no indicator of any kind, which looks identical to having no sources. Fix: `KINDS` is static, so render the three group headers immediately with `scanning…` placeholders.

- **[med] [feedback]** — Long imports are a button label. `runImport` loops sources one at a time with `extract: true`, meaning model calls per source. The only feedback is `Importing…`, results appear all at once at the end, and nothing warns that this costs real time and real model calls. Fix: push each `ImportResult` into state as it lands, and show `Importing 2/5…` in the dock.

- **[med] [copy]** — Freshness chips name states, not obligations. `Context changed`, `Extraction incomplete` (orange) and `Update available` carry no explanation of meaning or consequence anywhere, which is exactly the fingerprint-message problem the journey notes call out. Fix: one dim subline, or title attribute, per non-New freshness value, stating what re-importing will do.

- **[med] [visibility]** — `3 scanned · 1 ready to import` maps onto no rows. All three character rows are equally selectable and none carries a ready mark, so the user has to infer that ready ≈ the `New` chip. Fix: mark qualifying rows ready, or restate the group line in row-chip vocabulary (`3 new · 1 update · 1 imported`).

- **[med] [copy]** — Chat-summaries zero-state explains the feature, not the zero. It's a capability blurb, not why zero and when to return (journey J1: sources with nothing in them explain their emptiness and when to return). The character and lorebook zeros are equally reasonless. Fix: per-kind zero copy naming the producing action, such as `No chats have summaries yet — summaries appear once a chat is long enough`.

## Tool level

- **[med] [visibility] [missing-interaction]** — Status-line states come with no action and no explanation. `index degraded / stale / not built` is one colored mono phrase, where the journey table prescribes one banner and one repair action, and the console has no rebuild affordance anywhere. An `ltmStatus` fetch failure sets the whole line to `null`, so the *worst* case, an unreachable server, removes the health display entirely. `indexes.dirty`, `rebuildState` and `embeddingsAvailable` (false means degraded recall, unannounced) also arrive and never render. Fix: turn non-healthy into a clickable banner with the repair action, render a fetch failure as `status unavailable`, and fold `embeddingsAvailable: false` into the same banner.

## Count summary

**26 findings** — 3 high · 14 medium · 9 low. By category (primary): visibility 15 · feedback 5 · copy 8 · missing-interaction 3. Some findings carry two tags.

Strongest theme: the tool computes almost everything the journeys demand, then ships only the count or the color. That includes preflight rows, autoincluded ids, pressure projections, source titles on blocked drafts, index substates. The data for most of these fixes already sits in the client.
