# Marinara Console — Design Framework

LLM-facing. Read this fully before writing or changing any UI in this repo. Rules are
do-X / avoid-Y / because-Z. When a rule conflicts with something Luma says in session,
Luma wins; update this file in the same change. The research behind the general rules
is vendored at [`research/dense-ui-survey.md`](research/dense-ui-survey.md) — cite it,
don't restate it.

## 0. What this is

A standalone management console for Marinara Engine (proxied via `server.mjs`),
hosting power-user tools: lorebook editor, preset browser/editor, long-term-memory
agent UI, and whatever comes next. Audience of one: an expert user who lives in the
tool. Density is respect; every needless click is a repeated tax.

**Stack:** Vite + React + TypeScript, a hand-rolled store (`src/lib/store`),
and Tailwind v4 whose theme is generated from `tokens.css` (§8). Components are
styled with utilities; the co-located stylesheets still in the tree are legacy
and are rewritten as the work reaches them. There is no
CSS-in-JS. Hash routing (`#/tool/id`) for deep links without
server routes. Engine logic (keyword matching, token estimation) is vendored from
upstream, never reimplemented — fidelity to the engine beats elegance.

## 1. Identity

Dark-only instrument panel. Near-black blue-tinted surfaces, hairline borders, no
decorative shadows, no gradients-as-decoration. Data is the ornament: computed
numbers (percentile flags, budget meters, live counts) do the visual work that
decoration does in consumer apps.

### Type — three faces, strict roles

| role | face | usage |
|---|---|---|
| `--font-label` | Archivo Variable (wdth ~110, caps, tracked) | section labels, buttons, nav, structure |
| `--font-data` | JetBrains Mono Variable | ALL data: numbers, keys, counts, timestamps, meta lines, IDs |
| `--font-prose` | Source Sans 3 Variable | sentences a human reads: content, descriptions, empty states |

Never set data in the prose face. Never set prose in mono. Labels are 9.5–11px caps
with letter-spacing; data 11–14px; prose 13.5–15px. Tabular numerals for numeric
columns. Ligatures OFF wherever literal characters matter (keys, code, IDs).

The `.t-label` / `.t-data` / `.t-prose` utilities in `base.css` set the **face
only** — never size or weight, which belong to the component rule. `.t-prose`
exists solely to restore prose inside a label or data context; the body default
is already prose, so applying it anywhere else is noise. Never put a type
utility on an element whose component class sets a different face: the two
rules have equal specificity and the winner is decided by stylesheet order,
which means the markup asserts one face and the page renders another.
`node scripts/faceprobe.mjs` reports the face every utility actually gets.

### Color — semantic first, chrome second

- Status vocabulary mirrors the engine and is **reserved**: `--ok` (emerald) /
  `--warn` (yellow) / `--danger` (red) / `--off` (gray). Pair every status color with
  a shape, icon, or text — never color alone (WCAG 1.4.1).
- `--accent` (blue) is for interactive chrome only — focus, selection, primary
  buttons, links. It must never collide with the status hues.
- `--flag` (orange) marks computed outliers (over-budget, p90 exceedance) only.
- A row's **left edge bar** is one channel with three readings, so they must not
  be reused for anything else: `--ok` at `inset 3px` marks a new target,
  `--accent` at `inset 2px` is the keyboard cursor, and a background wash is
  decision state.
- **Categorical object-type hues** (Luma-confirmed): long-lived object taxonomies
  (e.g. memory note types) get one hue each, used consistently on every chip/dot
  that names the type, always paired with the type name in text. They are a third
  axis — never reuse the status hues or `--accent`, and keep them lower in
  **chroma** than both (they are identity, not state). Chroma, not lightness:
  measured, type hues run C\* 8.6–48.9 against status C\* 56.4–74.4, but on L\*
  they are not dimmer at all (thread L\* 65.2 vs danger L\* 64.1), so reading the
  rule as lightness would make it already violated five times over. The hues are defined in `tokens.css` as
  `--type-*`; the tool that owns the taxonomy binds them to its own classes
  (`memory.css` `.type-*` sets `--tc` from them). They moved there
  because they had been the last hardcoded palette outside the token file,
  which is what let `--type-character` drift into being byte-identical to
  `--accent` without anything noticing. One palette, one place to check.
  **Resolved:** `--type-character` had been `--accent` exactly
  (`#7d9bf0`, ΔE 0.00) — so a *selected* chip and the *character* chip were the
  same blue inside one control (`Chip.css:26` pressed border vs the `.tdot` on
  every type filter chip). It is now `#00b8d4`, picked from a computed candidate
  set as the only value clearing 20 ΔE2000 on all twelve pairwise distances:
  23.6 vs `--accent`, 34.9 vs `--type-thread`, worst pair 20.5 (vs
  `--type-neutral`); contrast 8.15:1 on `--canvas`, 7.60:1 on `--surface-1`;
  chroma 38.1, inside the type band. The bar remains in tension with itself:
  `--type-thread` is only 14.85 ΔE (CIEDE2000) from `--accent`, so that sibling
  pair still sits below 20 — open, and untouched by this fix.
- Surface ladder `--canvas → --surface-1..3` for depth; hairline `--edge` between
  regions. One subtle separator, never full grids of lines.
- **Contrast floors are enforced by `verify.mjs`**: body/data text ≥4.5:1, large text
  and essential labels ≥3:1. `--text-faint` exists but is restricted to decorative
  or ≥12px non-essential text. (The legacy app's dim grays failed AA; the token
  ladder here was rebuilt to pass. Don't reintroduce darker grays ad hoc.)
  The sweep reads pseudo-element and placeholder ink too, so a `::before` glyph
  is held to the same floor as a text node. `data-contrast-exempt` in the markup
  only *claims* an exemption: it is honored solely for elements matching an entry
  in `verify.mjs`'s `CONTRAST_EXEMPTIONS`, and each entry has to state why the ink
  may sit below the floor. An exemption with no entry is measured like anything
  else, so the attribute can never silence the check on its own.

### Space & motion

4px base grid, religiously. Dense paddings (4/8/12), radii 6–10px, hairlines.
Density modes via `data-density` on `<html>`: `comfortable` (default) and `compact`
(row paddings −4px). Motion 120–200ms, transform/opacity only, purposeful
(orientation, causality, continuity) — respect `prefers-reduced-motion`.

## 2. Owner preferences (confirmed by Luma — do not re-litigate)

- ~11 rows per phone screen collapsed; titles **truncate to one line** in list
  rows; one-line mono meta with `·` separators; right-aligned numeric gutter
  per row. A title whose siblings share its opening — a lorebook entry under
  its book — gives up its **middle** instead (`MiddleTruncate`, §8), because
  the end is the part that names it.
- Accordions with **data-bearing collapsed headers** (counts, token totals, status —
  closed ≠ invisible). **Multi-expand is the default**; one-at-a-time only where
  focus demands it (e.g. phone editing of long forms).
- One primary tap target per row. Primary controls ≥44px; secondary chips may be
  smaller but spaced (≥8px) with padded hit areas.
- Reuse the engine's own UI copy (en.json vocabulary) when a concept exists upstream.
- Field-level PATCH autosave with a visible save state (`Saving / Saved /
  Failed`); debounce ~700ms, flush on blur. Never send fields the user didn't touch.
  The in-progress word is the catalog's `memoryvault.saving`, not the coined
  "Autosaving…" this rule used to mandate: the console had declined the
  catalog string on the grounds that a debounced ledger write promises
  something different from a save the user pressed, and that distinction was
  judged not worth a coined word (owner-decided 2026-08-24). The longer string
  also overflowed the review dock's status row, which is the tightest place
  the pill has to fit.
- **Undo over confirm**: destructive-but-recoverable actions get soft-delete + undo
  toast. `confirm()` only for genuinely irreversible operations.
- Numbers shown are computed from real data, engine-faithful (`Math.ceil(len/4)` for
  tokens — matches `approximateTokens()` upstream). Thresholds derive from the data
  (p90), not hardcoded constants.
- Content the user authors (lorebook entries etc.) is markdown; editors are plain
  textareas with char/token counts and a markdown symbol row — no rich editing.
- Build tooling is fine. (An earlier "no build step" constraint was inferred, not
  requested — do not treat it as a preference.)

## 3. Interaction contracts

### Keyboard (mandatory on desktop surfaces)

- `j/k` or arrows move list focus (roving tabindex — one tab stop per composite);
  `Enter`/`o` opens; `Escape` closes/back.
- Single keys for the focused object's frequent actions; `g` sequences for
  navigation; `Cmd/Ctrl-K` command palette spanning all tools (searches local state,
  instant); `?` opens the shortcut cheat sheet.
- Visible focus ring (≥3:1) always. Focus returns to trigger on close. No traps
  outside modals.

### Latency budget

- ≤100ms for taps/toggles/filters/inline edits — no indicator at all.
- Optimistic UI for predictable low-risk mutations (toggles, status, tag) with
  rollback + toast on failure. Network is confirmation, not permission.
- No spinner under ~300ms (delay any indicator ~100ms so it never flashes). 3s+ gets
  a determinate bar. Skeletons only where layout is known — they are not an
  automatic win (see survey §7).
- Virtualize lists only at 500+ items; below that, render honestly.

### Input modalities — one UI, three inputs

Hover is an enhancement, never the only path. Everything reachable by click, key,
and tap. Touch: 44px primary targets, no hover-dependent actions, long-press for
context menus with a visible alternative.

## 4. Decision rules

| question | answer here |
|---|---|
| table vs list vs cards | table when comparing attributes/bulk-acting; list for scannable single-lines; cards only as a table's mobile collapse |
| detail: modal vs drawer vs page | non-modal side panel/drawer first; modal only for short must-decide-now; **never nest modals** |
| disclosure depth | max two levels; accordions never nested |
| desktop shell | visible left rail (no hamburger); master-detail split panes |
| mobile collapse | master-detail → stacked screens; side panel → bottom sheet; table → card list with 3-4 priority fields; actions → bottom dock |
| destructive action | soft-delete + undo toast; confirm only if truly irreversible |
| errors | inline, at the cause, specific, never color-only; never only in a toast |
| empty state | say what the view is and the next action — never a blank pane |
| filters | 3-5 top facets inline, rest behind Advanced; active filters as removable chips |

## 5. Pattern inventory

Implemented once in `src/ui/`, reused everywhere. If a screen needs a pattern that
exists, use it; if it needs a new one, add it here in the same change.

- **Audit row** — status rail · wrapping title · mono meta line · numeric right
  gutter · one tap target. The workhorse list unit (proven in the lorebook tool).
- **Accordion** — data-bearing summary header, chevron, multi-expand, state persists
  across navigation; badge errors on collapsed headers, auto-expand on error.
- **Console header** — sticky; title row · probe/search field · meter bar ·
  chip rail (sort/filter). Meters show budget/aggregate as data, one line.
- **Master-detail** — desktop split (list keyboard-navigable, detail in place);
  mobile stacked navigation with back.
- **Command palette** — Cmd-K, fuzzy over tools/records/actions, shows shortcuts
  (teaches them), local-state fast.
- **Dock** (mobile) / **toolbar** (desktop) — 2-3 primary actions, labeled.
- **Segmented control** — 2-5 exclusive modes (Find/Test pattern).
- **Stepper** — ± for numerics on touch; direct input on desktop.
- **Chip editor** — keys/tags: add, delete, highlight-on-match.
- **Save pill** — autosave state per record.
- **Toast** — transient confirmation + undo carrier; never sole home of errors.
- **Fullscreen text editor** — near-fullscreen textarea, live char/token counts with
  delta, wrap toggle, markdown symbol row.
- **Tag/distribution panel** — group stats with bars, per-group Show/Select.
- **Decision rail** — tri-state per-row judgment (undecided / keep / drop) on the
  status rail, cycled by tap or set by single keys with auto-advance. Judgment is
  a *persisted local ledger* (server-side, keyed by engine target), separate from
  transmission: nothing is sent until an explicit Apply over everything decided,
  so a review resumes across days and devices. Undo stack over the ledger.
- **Facet sheet** (`src/tools/memory/review/FilterSheet.tsx`) — multi-select
  facets, ordered by how often they are reached for rather than by provenance:
  the exception filter ("has quality flags", one toggle plus a drill-in to the
  named flags) · the short taxonomies as tiles (memory type, decision) · the
  long tail behind search (sources) and behind a disclosure (the model's
  enums). Provenance grouping — computed / from the model / yours — was the
  earlier shape and is retired here: it answered "who asserted this", a
  question about trust, while a reviewer opening the filter has a question
  about narrowing. Authority still separates the console's own signals from
  the model's, by level rather than by a labelled block.
  Counts exclude the facet's own filter ("what would I get if I toggled
  this"), and two facets narrowing one set exclude each other (`countsIgnore`
  — flags ↔ anyFlag). **A facet lists its whole vocabulary, always**, from a
  declared `domain` or from the unfiltered rows: a value at zero renders
  disabled rather than vanishing, because an axis that shrinks as you narrow
  it tells the reviewer the missing choices do not exist (owner-decided
  2026-08-24 — the risk facet was hiding "high" on a batch with none, and the
  decision facet was offering nothing but "undecided").
- **Arrange rail** (phone) — one row: filter as glyph + active count, then
  group and sort as glyph + value sharing the leftover width. Active filters
  sit in a removable-chip track beneath it (DESIGN.md §4). The phone's console
  header carries nothing else: the title, generation line and decision meter
  were three rows of chrome above the first claim, and the meter's keep/drop
  was the dock's keep/drop said twice. The **dock is the phone's status
  surface** in exchange — always mounted, carrying the tally, the save state,
  refresh and undo at one shared height, with the meter as its bottom edge and
  the apply row appearing only once something is decided.
- **Icon vocabulary** (`@tabler/icons-preact`; memory tool: `icons.tsx`) — icons
  are reserved silhouette families: the decision family = decision states, the
  flag = exception flags, files/scripts = content ops (script = whole note,
  file = one section; shared + marks additive ops, pencil marks replacement).
  What the decision family reserves is the **interior mark on a solid round
  outline** — a tick or a cross — **plus the dotted circle** (`circle-dotted`,
  12 dots) that means undecided. A round outline holding anything else (an
  `i`, an `!`, a segmented arc, a speech tail) is a different object and is
  free — `info-circle`, `message-circle`, `alert-circle` and the whole
  `progress-*` family including `progress-x` are all fine, and so is
  `circle-dashed`. `undecided` moved from `circle-dashed`
  to `circle-dotted` for exactly this reason: circle-dashed is 8 arc segments
  and `progress-*` is 5 arc segments, one shared vocabulary, so the decision
  family and the progress family were colliding. 12 dots is a different
  vocabulary; the collision is gone and both `circle-dashed` and the arcs are
  released. Only the reserved interiors can be misread as a decision; that is
  the whole point of the rule (owner-decided).
  No icon may borrow another family's silhouette (that rule killed `flag-2`
  for status and a bare pencil for the edited mark). Type icons carry the
  categorical hue.
  **State signals** (owner-decided), one glyph per state so a
  banner, a row mark and an empty state reporting the same condition look
  alike: error `alert-circle` (`Failure`) · partial `progress-x`
  (`PartialResult`) · degraded `progress-alert` (`Degraded`) · waiting on the
  user `list-check` (`Pending`, the same binding as the Review nav tab — the
  glyph means "the review queue" in both places, so a pending count names
  where the user should go) · info `info-circle` (`Info`) · a *pane* waiting on
  data **no icon** (`Loading.tsx` deliberately carries none — a spinner
  standing in for content reads as a state you can act on). A **control**
  waiting on its own action is the narrower case and does get one:
  `Working` (`loader-2`, spun by `Button.css`), which is the button reporting
  on work the user already started rather than content that has not arrived.
  Placeholder glyph, owner to revisit. Two more that are easy to
  conflate: `AllClear` is `checks` (double tick — "all of them", nothing left
  in the set) against `Confirm`'s single `check` (the checkbox tick); and
  `ValidationOk` is `zoom-check` — a check was run and it passed — on the
  high-confidence branch of the claim-detail confidence row. `alert-triangle`
  is no longer generic failure: it is now only `Incomplete`, the
  source-freshness state `extraction_incomplete`, which is a harvest that
  stopped short rather than a thing that failed.
  Owner-decided mapping lives in BACKLOG.md; don't re-litigate per screen.
- **Styling** — Tailwind v4 (`@tailwindcss/vite`), theme generated from
  `tokens.css`, utilities in the JSX. The remaining hand-written stylesheets are
  legacy; §8 says when to rewrite one. Preflight IS imported, in `layer(base)`,
  so it reaches only properties we never set.
- **Mockups** — one shared kit, `design/MOCKUP-KIT.md`. Books never carry their
  own palette.
- **Copy provenance** — every user-visible string traces to the vendored
  catalog (`src/copy/vendor/ltm-en.json`) or to a registered entry in
  `src/copy/<area>.json`, each carrying a `note` saying why the product has no
  word for it. `scripts/copycheck.mjs` checks this mechanically against a
  rendered surface. Coining silently has been the single most repeated defect
  in this tool. (The old `OURS` object and `src/tools/memory/strings.ts` are
  gone: `OURS` could not express a mirror, and its reasons were comments
  rather than data.)
  A string that appears mid-sentence around a component — a claim headline
  with a memory reference inside it — stays ONE catalog string and renders
  through `<Copy>` (`src/tools/memory/Copy.tsx`), which substitutes `{{slot}}`
  with a node. Splitting such a sentence into JSX fragments puts English word
  order in the markup and is not a fix.
- **Detail pane zones (v5)** (`ClaimDetail.tsx`) — a claim's pane answers the
  reviewer's questions in reading order: headline sentence (what this does, to
  which memory) · preview (op-specific consequence: after-state for append,
  diff for update, the memory-as-it-will-exist for create, resolved facts for
  metadata ops; stored context and unchanged runs fold behind labeled
  expanders) · evidence (source snippet + attribution, confidence as a
  sentence, diagnostics, quiet extraction line) · decide bar at the bottom in
  the list's ring vocabulary. Editing is a mode: accent border, textarea in
  place of the proposed lines only, save/discard replace keep/drop. Preview
  lines speak diff: + tint = lands in the vault, − = dies on apply; the gutter
  glyph carries the meaning when color fails. Zone labels use catalog
  vocabulary (preview · existing → proposed · evidence · extraction).
- **Education term** (`glossary.tsx`) — any rendered enum value or type/op icon
  answers "what does this word mean" in place: hover/focus on desktop, tap on
  touch, definition prefixed with its owning field ("claim kind · static — …").
  One definition source. Never on interactive controls (help cursor on a toggle
  is a contradiction). Collapsed exception chips ([flag] n) tint by worst
  severity; the kinds stay filterable, not re-taxonomized per row.

- **Scope** (`src/tools/memory/scope.ts`) — character › chat, chosen once above the
  views and applied by all of them. Three rules, because a filter that hides
  records has to be trustworthy:
  **Unscoped means everywhere, not nowhere.** The catalog defines scope as the
  chats and characters a memory *is available in*, so an empty scope is not an
  orphan — it is global. Imported lorebook sources arrive unscoped and would
  vanish the moment any scope was picked.
  **A record that cannot be placed is shown.** If the note behind a review row
  has not loaded, the row stays. Hiding on ignorance makes the queue understate
  the work left, which is worse than showing one row too many.
  **Counts follow the list.** Scope narrows the rows *and* every figure beside
  them — the vault's chips, the nav badges — because a scoped list under a global
  tally is a header contradicting its own rows. The review badge counts live
  rows for the same reason: the response's `counts.mutations` also counts claims
  held inside blocked drafts, and read 190 over a queue listing 77.
  Scope is applied to the review queue inside the store, so the tally, facets,
  groups and apply dock all narrow with it rather than each filtering by hand.

- **Memory detail card** (`src/tools/memory/detail/`) — a read-only screen for one
  stored record. Three rules carry it, and all three are load-bearing:
  **One bordered surface.** The retrieval block (modes · keywords · links) is the
  only box on the screen, so *boxed means metadata, unboxed means content*. A
  second card — especially around a section body — collapses that distinction and
  was the single biggest failure of the directions that lost.
  **One section, one row, one behavior.** Every section expands in place, however
  long it is, so the chevron has only one thing it can mean. An earlier pass
  routed oversized sections to a bottom-sheet peek and made the glyph predict
  which of the two you would get (chevron vs diagonal arrow); Luma retired it —
  two interaction models and a size threshold to explain, in exchange for a
  problem stickiness solves outright.
  **A long section carries its own way out.** While a section is open its row is
  `position: sticky` under the card's head, so the control that closes it is on
  screen the whole way down. Sticky needs no length threshold and no measurement
  to decide it applies: a row whose body is shorter than the remaining viewport
  never reaches its offset. Collapsing must anchor the scroll back to the row —
  the document shrinks under the reader otherwise, and the sticky control creates
  the disorientation it exists to prevent.
  **No truncation notices.** No "141 lines between", no dashed count boxes, no
  "show rest". The row states the size and the chevron opens it. Every notice
  tried here read as noise.
  Collapse-all is the manifest state — every section becomes a bare row — which is
  why a long memory needs no separate overflow design, only `defaultCollapsed`.
  Cap pressure is stated in words in the flag's popover; the meter bar it used to
  have died with the peek, and does not come back into the row, where it competed
  with content for attention.

## 6. Layout recipes (with mobile collapse)

- **Triage queue** (LTM review): left keyboard list + right detail; single-key
  act + auto-advance. Mobile: full-screen list → pushed detail; swipe + bottom bar.
- **Filter + results** (preset browser, lorebook picker): facet rail + virtual-ready
  results + optional peek panel. Mobile: filter bottom-sheet with count badge;
  cards with priority fields.
- **Nested-object editor** (lorebook/preset editing): record list + fields +
  child collections in side panel; breadcrumbs for depth. Mobile: stacked screens;
  side panel → bottom sheet.

## 7. Definition of done — `verify.mjs`

A UI change is not done until `node scripts/verify.mjs` passes:

1. Screenshots at the standard viewports — `node scripts/shots.mjs <url> <name>`:
   **390×844** `narrow`, the floor · **486×1085** `phone`, Luma's device and the
   one that must be right · **768×1024** `tablet`, the band between the
   breakpoints · **1280×800** `desktop`. Those four names are the only viewport
   vocabulary; they are declared once in `scripts/lib/browser.mjs` and every
   browser check imports them rather than restating widths.
   A "mobile" rendering drawn in a small box on a wide page is not a mobile
   rendering; render at the viewport or do not claim the result.
   CSS breakpoints are two, semantic: **720px** (below it everything stacks)
   and **900px** (above it master-detail sits side by side).
2. Zero console/page errors *and warnings* on every screen visited.
3. Tap-target sweep: interactive elements ≥44px primary / ≥24px+spacing secondary.
   A control under 44px fails unless it clears 24px *and* sits ≥8px from the
   nearest other target — that spacing is what §2 grants a secondary control, so
   without it there is no band left for the element to be legitimate in. Segments
   of one `[role="group"]` are a single control, not competing targets.
4. Contrast sweep: computed fg/bg pairs meet the floors in §1.
5. No horizontal document overflow at any viewport.
6. Density check on list screens: collapsed rows/screen reported (mobile target ~10+).
7. Keyboard walk on desktop screens: tab order sane, focus visible, list navigation
   works without a mouse.

Screenshot before claiming; measure before asserting density. This habit has caught
real bugs every time it was applied — treat it as part of the build, not QA.

---

## 8. Where UI lives — `src/ui/`

Shared components live in `src/ui/`, one folder-level. Anything used by more
than one screen belongs there; anything used by one screen belongs beside that
screen. New components carry no stylesheet — `Button.tsx` is the reference.

The co-located stylesheets still in the tree (`Chip.tsx` + `Chip.css`) are
legacy, and so is the one case where a screen kept beside its tool co-locates
the same way because it is a *family* rather than a single component —
`src/tools/memory/detail/` is four components and four stylesheets. The rule
they answer to is the one above:
deleting the folder deletes its rules. A tool's one-off screens still belong in
that tool's global sheet (`src/styles/memory.css`); the split is worth it only
when the alternative is a 200-line unrelated block in a 600-line file.

### Styling: Tailwind utilities

**Components are styled with Tailwind utilities in the JSX.** The theme is
generated from `tokens.css` (`src/styles/theme.css` bridges every token to a
Tailwind name), so `bg-accent`, `text-dim`, `min-h-tap`, `rounded-m` and
`text-label` are the same values the hand-written rules used. There is one
palette and one spacing scale, whichever syntax reaches for them.

**Hand-written CSS is legacy.** Most components still carry a co-located
stylesheet. That is history, not a pattern to copy: nothing new should add one,
and **a stylesheet you are already editing should be rewritten as utilities
while you are in there**, in the same change, at whatever granularity the work
touches. A file nobody is touching can stay as it is — this is a migration
that follows the work, not a sweep to schedule.

Three things survive the move, because utilities cannot hold them:

- **`tokens.css` stays the source.** Utilities read the theme, the theme reads
  the tokens. A raw value in the markup is still wrong.
- **The reasoning goes here or into the component's doc comment**, not into a
  class string. Why the sticky seam guard is 3px, what each channel in the
  memory list means — those were the strongest argument for stylesheets, and
  losing them is the real cost of this change. Write them down somewhere a
  reader will find them.
- **Class strings must be whole literals.** Tailwind's scanner reads source
  text, so `bg-${tone}` generates nothing and fails as a silently unstyled
  element rather than as an error. Spell variants out in a lookup, as
  `Button.tsx` does.

Two failure modes to know, because both fail silently and neither looks like a
CSS problem:

- **Unlayered CSS beats every layer, so a hand-written rule beats a utility.**
  This document used to claim the opposite — that utilities "win over the
  hand-written rules" — which was never true and had gone unnoticed because
  nothing used utilities. `base.css`'s element resets are now in `layer(base)`
  beside preflight; left unlayered, `button { background: none; border: 0 }`
  defeated every background, border and padding utility on every button.
  Converting a component whose rules fight a utility means layering those
  rules, not fighting back with `!important`.
- **Two utilities on one property: the sheet's order decides, not yours.**
  `"uppercase … normal-case"` renders uppercase, because Tailwind emits them in
  its own order. Never emit both — give each property exactly one lookup that
  owns it, and switch which string that lookup returns.

Genuinely un-utility-able CSS — keyframes with several stops, a complex
`::after`, a container query no variant covers — belongs in an
`@layer components` block, not in a new co-located file.

### CSS comments — four kinds, nothing else

A stylesheet is not documentation. Keep only: a one-sentence file header saying what the file covers; section dividers (`/* ── rows ── */`); the derivation of a magic number (`/* centers the 15px icon in the 40px first line */`); and a gotcha — a rule whose removal or reordering silently breaks something you cannot see from the rule itself.

Cut everything else. No design rationale (that is this document's job), no restating the declaration in prose, no narrative about what changed, no cross-references a reader could grep for, no em-dash asides that land a point. If a comment argues, it belongs here instead — and check that it is not already here before moving it.

**Preflight is on** (`src/styles/theme.css`). Our stylesheets are unlayered and
preflight lands in `layer(base)`, so it reaches only properties we never set.
Its measured effect: form controls inherit our font and leading instead of the
browser's 13.33px default, icons lose the inline baseline gap, and tag margins
are zero — so a component's spacing is the component's job. Do not add a rule
that re-states a margin preflight already removed; give the component a `gap`.

**Two components, not one, when the roles differ.** `Chip` is pressable and
`Tag` is not, because one `.chip` class doing both meant you found out whether
something was clickable by clicking it. Accent means interactive (§2); a
component that is not interactive should not be able to reach for it.

The same split runs through `EmptyState` / `Loading` / `ErrorState`. They are
one shape — centered text in a blank pane — and three roles, and a single
`kind` prop would have kept the shape and lost the roles. A loading state must
not be allowed a title in the label face, because half a second of latency
announced in bold reads as a verdict; an error state must not be allowed to
omit its cause, which an optional shared `body` prop permits and a required
one does not. Seventeen hand-written `class="empty"` panes had drifted into
four different appearances before this.

Waiting is the one role that changes over time. `Loading` stays a dim line for
three seconds, admits it is slow, and at twelve seconds stops claiming to be
loading at all — it becomes a state with a way out, because an indicator with
no timeout is a lie once the request behind it has died. That is the single
exception to "a loading state carries no action": by then the wait itself is
the condition being reported.

`ErrorState`, `NotFound` and `ListEmpty` are named compositions of
`EmptyState` rather than variants of it. Each fixes the parts that are not the
call site's to choose — the icon, the tone, and whether the cause may be
omitted — while the primitive stays open for the states that have no name yet.
`ErrorState` derives its heading from the failure instead of taking one on
faith: "Cannot reach engine" was being rendered over 500s and 403s, where the
engine answered and said no. It also names no destination of its own; the back
button it used to hard-code sent you to the lorebook list from anywhere,
including the presets tool.

### The inventory

| Component | What it owns | Reach for instead |
|---|---|---|
| `Button` | every action control: variant, tone, size, pending, unavailability, icon-only | a plain `<a>` when it navigates |
| `Chip` / `Tag` | a small pressable / a small label | — |
| `SearchBar` | a search field, its magnifier, its match tally | — |
| `fuzzyFilter` / `fuzzyScore` | subsequence matching with a score | — |
| `Sheet` / `Modal` | a layered surface and its dismissal contract | — |
| `SheetHead` | a sheet's sticky title row | — |
| `SearchDisclosure` | choose one, long list, anchored popover | — |
| `ListGroup` / `CollapseButton` | collapse behavior and its accessible name | — |
| `MiddleTruncate` | a one-line title that elides its middle | a plain ellipsis where the end is what distinguishes |
| `DetailSection` | a §section heading and its body | — |
| `JsonView` / `RawJson` | a JSON value, folding or literal | — |
| `CopyableText` | a value meant to be taken elsewhere | — |
| `ModePill` | the three chat modes, read-out or filter | — |
| `EmptyState` | icon, title, explanation, actions | `Loading` while waiting, `ErrorState` when it failed |
| `Loading` | a view still arriving, escalating if it stalls | — |
| `ErrorState` | a failure and the engine's reason for it | `NotFound` when the record is simply gone |
| `NotFound` | a link to a record that isn't there, and the way back | `ErrorState` for a request that failed |
| `ListEmpty` | an empty list, by the reason it is empty | `EmptyState` for an empty that has no list |
| `Edu` | one line of help text, with its icon | `Term` for a single word |
| `Term` | a word that explains itself in place | `Edu` for a whole sentence |
| `useIsDesktop` | the split-width query | — |
| `collapsedGroups` | collapsed-group state, optionally persisted | — |

Two rules the inventory encodes. **Split by role, not by shape**: `Chip` and
`Tag` look alike and are separate components, because one is pressable and the
other is not, and that had been something you found out by clicking. **Own the
behavior, slot the shape**: `ListGroup` owns the chevron and its accessible
name, while the review queue and the sources list keep their own header
layouts — one shares a grid with its rows, one does not, and forcing a single
shape would have invented a layout neither wanted.

### Buttons

One component, `src/ui/Button.tsx`. Before it there were 119 hand-written
`<button>`s wearing 63 different class combinations, with `.dbtn`, `.dbtn2` and
`.action-sec` as three copies of one appearance.

**Rank is the box, then ink brightness. `--accent` is not a rank step.**
Measured against the canvas, an accent label is 7.24:1 where `--text` is
15.78:1 — so a tier inked in accent and ranked *above* a neutral one reads as
louder, which is the wrong direction. Accent stays with the primary fill and
with `pressed`.

| variant | box | ink | for |
|---|---|---|---|
| `primary` | `--accent` fill, 7.24:1 off canvas | `--accent-ink` | the action the screen exists for |
| `secondary` | `--edge-strong` border, no fill | `--text`, 15.78:1 | everything else with a box |
| `ghost` | none | `--text-dim`, 6.41:1 | row actions, dismissals, dense rails |

Three tiers, not five. The de-facto vocabulary that 119 buttons produced on
their own was exactly these three, and nothing has ever reached for a fourth.
A `tertiary` band was drawn four ways and rejected: neutral containers span
1.07:1 to 1.87:1 against the canvas, so there is no middle for one to occupy
(`public/mockups/button-tertiary.html`, `button-ladder-v2.html`).

**`tone` is category, not rank** — `danger` and `ok` compose with every
variant, so a destructive action can be the screen's primary or a quiet ghost
without changing what it means. This is why `.dangerbtn`,
`.action-sec.is-danger-act` and the decision rail's green keep can be one
mechanism.

**Other rules the component enforces**, so no call site has to remember them:

- `type="button"` always. Only 21 of the previous 119 set it.
- **Icon-only is a mode, not a component**, because every prop applies to it —
  an icon button still goes pending, still has to say why it is unavailable,
  still reports `pressed` and `expanded`. `iconOnly` demands `label` in the
  type, and `label` becomes both the accessible name and the tooltip.
- **`pending` delays its spinner 1s** and the button is inert throughout, so
  fast work never flashes an indicator and a double-press cannot double-submit.
  The label keeps its box and loses only its ink, so a row cannot reflow
  mid-request. Reserve it for work expected to finish inside ~5s; anything
  longer belongs in a progress bar outside the button.
- **Disable rather than hide, and say why.** `disabledReason` renders through
  `Term` and switches the control to `aria-disabled`, because a reason on a
  control nobody can focus is a reason nobody can read.
- **Labels wrap; they never truncate.** Sibling controls still share a height
  because their row stretches them (CHECKLIST §4) — a wrapped label grows the
  row, not one button.

**Writing a label** (Spectrum's content standards, plus Carbon's formula):
a verb, or verb + noun — "Create identity source", not "Identity source". One
or two words, four at the outside, under 20 characters. Sentence case in the
catalog, no terminal punctuation, no articles ("Migrate server", not "Migrate a
server"), no "Yes". The uppercase you see is `text-transform`, so the source
string and the accessible name stay sentence case; `labelCase="sentence"` opts
a button out, and drops the tracking and gains a size step when it does.

Accessible names must be unique on a screen — a repeated "Delete" should name
what it deletes. Use `expanded` when the button controls a disclosure and
`haspopup` when it opens a menu.

**Not in scope for `Button`.** The decision rail (`.dbtn2`) is a named pattern
in §5 with its own semantics — persisted ledger, keyboard auto-advance — and
stays its own component. So do the list and structural affordances that happen
to be `<button>`: `.chip`, `.card`, `.picker-opt`, `.rail-item`, `.sbox` (a
`role="checkbox"`), the JSON tree nodes. Segmented controls stay with
`ModePill`.

### Reading measure

`--measure: 68ch` caps prose line length. Apply it to the element that holds
the words, never to the card around them — the zones in the claim detail keep
their full width so a diff's added-line wash still reads as one block, while
the sentences inside stop at a readable width.

It applies to prose only. Identifiers, link targets and key/value data rows are
deliberately left uncapped: wrapping `source_character_2cdcc172e8fe3cd6` at a
prose measure serves nobody, and those lines have no return sweep to lose your
place on. Measured before and after in the claim detail at a 1600px viewport:
135–145 characters a line became 62–68.

### Checks that belong to this layer

- `node scripts/deadcss.mjs` — CSS classes nothing appears to use. A **candidate**
  list: class names reach the DOM literally, composed as `` `type-${n.type}` ``,
  and as bare strings passed to a `cls` prop. Read every hit. The first version
  of this script reported 36 dead classes of which 20 were live. Because the
  list is candidates, it fails only when the list **grows** past
  `design/deadcss-baseline.json`; delete a class and drop its line, or record a
  new one with `--adopt` and say why.
- `node scripts/typescale.mjs` — every `font-size` should name a step, not a
  number. §1 gives eight sizes as tokens; when this landed the tree set 112
  literal sizes and rendered **fourteen** distinct ones, 67 of them off the
  scale entirely — including `13px`, the most common size in the codebase and
  a step that does not exist. Each one looks considered on its own line, which
  is why only a count across the tree finds it. On-scale literals are reported
  too and named with the token to use: they render correctly today and still
  cannot follow the scale when it moves. The scale is parsed from `tokens.css`
  rather than restated, so the check cannot drift from the thing it checks.
  Baseline-ratcheted like `deadcss`; only growth fails.
- `node scripts/specificity.mjs` — a rule that comes after a higher-specificity
  rule it overlaps loses to it wherever both match, so the later rule reads as
  if it applies and does not. stylelint's `no-descending-specificity` finds
  these. It is a warning rather than an error because every fix is a reorder,
  and a reorder can change what renders. The tree holds 25 of them.
  Baseline-ratcheted like `deadcss`; only growth fails.
- `node scripts/domsnap.mjs before` / `... after --diff` — snapshots the rendered
  element tree and its class hooks across the routes plus the overlays, selected
  rows and expanded editors a URL cannot reach. Any refactor claiming "renders
  identically" runs this instead of asserting it. Each run ends with the
  components it did not reach.
- `node scripts/overlaycheck.mjs` — every layered surface must close on scrim
  tap, on Escape, and on back. The import confirm answered only one of those
  for weeks, because each sheet registered with the overlay stack by hand and
  one forgot. `Sheet` and `Modal` now do it, so the check guards a rule the
  code already enforces rather than a habit.
