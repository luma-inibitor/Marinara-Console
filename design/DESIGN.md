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

**Stack:** Vite + Preact + TypeScript, `@preact/signals`, hand-written CSS on design
tokens (no Tailwind, no CSS-in-JS). Hash routing (`#/tool/id`) for deep links without
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

### Color — semantic first, chrome second

- Status vocabulary mirrors the engine and is **reserved**: `--ok` (emerald) /
  `--warn` (yellow) / `--danger` (red) / `--off` (grey). Pair every status color with
  a shape, icon, or text — never color alone (WCAG 1.4.1).
- `--accent` (blue) is for interactive chrome only — focus, selection, primary
  buttons, links. It must never collide with the status hues.
- `--flag` (orange) marks computed outliers (over-budget, p90 exceedance) only.
- **Categorical object-type hues** (Luma-confirmed): long-lived object taxonomies
  (e.g. memory note types) get one hue each, used consistently on every chip/dot
  that names the type, always paired with the type name in text. They are a third
  axis — never reuse the status hues or `--accent`, and keep them dimmer than both
  (they are identity, not state). Defined next to the tool that owns the taxonomy
  (`memory.css` `.type-*`).
- Surface ladder `--canvas → --surface-1..3` for depth; hairline `--edge` between
  regions. One subtle separator, never full grids of lines.
- **Contrast floors are enforced by `verify.mjs`**: body/data text ≥4.5:1, large text
  and essential labels ≥3:1. `--text-faint` exists but is restricted to decorative
  or ≥12px non-essential text. (The legacy app's dim grays failed AA; the token
  ladder here was rebuilt to pass. Don't reintroduce darker grays ad hoc.)

### Space & motion

4px base grid, religiously. Dense paddings (4/8/12), radii 6–10px, hairlines.
Density modes via `data-density` on `<html>`: `comfortable` (default) and `compact`
(row paddings −4px). Motion 120–200ms, transform/opacity only, purposeful
(orientation, causality, continuity) — respect `prefers-reduced-motion`.

## 2. Owner preferences (confirmed by Luma — do not re-litigate)

- ~11 rows per phone screen collapsed; titles **wrap, never truncate**; one-line
  mono meta with `·` separators; right-aligned numeric gutter per row.
- Accordions with **data-bearing collapsed headers** (counts, token totals, status —
  closed ≠ invisible). **Multi-expand is the default**; one-at-a-time only where
  focus demands it (e.g. phone editing of long forms).
- One primary tap target per row. Primary controls ≥44px; secondary chips may be
  smaller but spaced (≥8px) with padded hit areas.
- Reuse the engine's own UI copy (en.json vocabulary) when a concept exists upstream.
- Field-level PATCH autosave with a visible save state (`Autosaving… / Saved /
  Failed`); debounce ~700ms, flush on blur. Never send fields the user didn't touch.
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
- **Facet sheet** — multi-select facets grouped by provenance (computed signals /
  from the model / yours), so a heuristic and a schema field never carry the same
  visual authority. Counts exclude the facet's own filter ("what would I get if I
  toggled this"). 3-5 quick chips stay inline; the sheet holds the long tail.
- **Icon vocabulary** (`@tabler/icons-preact`; memory tool: `icons.tsx`) — icons
  are reserved silhouette families: circles = decision states, the flag =
  exception flags, files/scripts = content ops (script = whole note, file = one
  section; shared + marks additive ops, pencil marks replacement). No icon may
  borrow another family's silhouette (that rule killed `flag-2` for status and
  a bare pencil for the edited mark). Type icons carry the categorical hue.
  Owner-decided mapping lives in BACKLOG.md; don't re-litigate per screen.
- **Styling** — Tailwind v4 (`@tailwindcss/vite`) with the theme generated from
  `tokens.css`, so utilities and the hand-written stylesheets share one palette.
  Preflight is deliberately not imported: the base reset would strip margins and
  borders the existing CSS assumes. Utilities sit in the `utilities` layer and
  win over the hand-written rules, which is what you want for a one-off override.
- **Mockups** — one shared kit, `design/MOCKUP-KIT.md`. Books never carry their
  own palette.
- **Copy provenance** — every user-visible string traces to the vendored
  catalog (`ltm-en.json`) or to a registered coinage in `OURS`, each with a
  comment saying why the product has no word for it. `design/copycheck.mjs`
  checks this mechanically against a rendered surface. Coining silently has
  been the single most repeated defect in this tool.
- **Detail pane zones (v5)** (`ClaimDetail.tsx`) — a claim's pane answers the
  reviewer's questions in reading order: headline sentence (what this does, to
  which memory) · preview (op-specific consequence: after-state for append,
  diff for update, the memory-as-it-will-exist for create, resolved facts for
  metadata ops; stored context and unchanged runs fold behind labeled
  expanders) · evidence (source snippet + attribution, confidence as a
  sentence, diagnostics, quiet extraction line) · decide bar at the bottom in
  the list's circle vocabulary. Editing is a mode: accent border, textarea in
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

A UI change is not done until `node verify.mjs` passes:

1. Screenshots at the standard viewports — `node design/shots.mjs <url> <name>`:
   **390×844** narrow floor · **486×1085** Luma's device, the one that must be
   right · **768×1024** the band between the breakpoints · **1280×800** desktop.
   A "mobile" rendering drawn in a small box on a wide page is not a mobile
   rendering; render at the viewport or do not claim the result.
   CSS breakpoints are two, semantic: **720px** (below it everything stacks)
   and **900px** (above it master-detail sits side by side).
2. Zero console/page errors on every screen visited.
3. Tap-target sweep: interactive elements ≥44px primary / ≥24px+spacing secondary.
4. Contrast sweep: computed fg/bg pairs meet the floors in §1.
5. Density check on list screens: collapsed rows/screen reported (mobile target ~10+).
6. Keyboard walk on desktop screens: tab order sane, focus visible, list navigation
   works without a mouse.

Screenshot before claiming; measure before asserting density. This habit has caught
real bugs every time it was applied — treat it as part of the build, not QA.

---

## 8. Where UI lives — `src/ui/`

Shared components live in `src/ui/`, one folder-level, each with its own
co-located stylesheet (`Chip.tsx` + `Chip.css`). Anything used by more than one
screen belongs there; anything used by one screen belongs beside that screen.

**Why co-located plain CSS**, and not utility classes in the JSX or CSS
modules. The rules in this repo carry explanations that utility strings cannot
hold — why the sticky seam guard is 3px and not more, what each channel in the
memory list means. Those are hard-won and would be deleted rather than
migrated. CSS modules would give compiler-enforced unique names, but they hash
the class in devtools, and this project is debugged by looking at rendered
output and pointing at things. Keeping `.chip` greppable is worth more than
uniqueness in a codebase this size. Tailwind utilities remain available as the
escape hatch for a one-off override.

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

### Checks that belong to this layer

- `node design/deadcss.mjs` — CSS classes nothing appears to use. A **candidate**
  list: class names reach the DOM literally, composed as `` `type-${n.type}` ``,
  and as bare strings passed to a `cls` prop. Read every hit. The first version
  of this script reported 36 dead classes of which 20 were live.
- `node design/domsnap.mjs before` / `... after --diff` — snapshots the rendered
  element tree and its class hooks across five screens at two viewports. Any
  refactor claiming "renders identically" runs this instead of asserting it. It
  is what caught three silent regressions in the chip sweep.
