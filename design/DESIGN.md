<!-- vale Microsoft.Headings = NO -->
<!-- "Console" is half the product name. Headings rejects any capitalised
     word after the first and its exception list has no entry for it, so the
     rule is off for this heading only, as it is in README.md. -->
# Marinara Console design rules
<!-- vale Microsoft.Headings = YES -->

The owner confirmed every rule below in a line-by-line review of the previous
framework document. Nothing here comes from inference, generalization, or
extrapolation. **A new rule needs an owner citation** — if it isn't confirmed,
it doesn't go in this file.

## 1. What this is

A standalone management console for Marinara Engine (proxied via `server.mjs`),
hosting power-user tools: lorebook editor, preset browser/editor,
long-term-memory agent UI, and whatever comes next. The audience is one expert
user who lives in the tool. Make the interface dense, and cut needless clicks,
because each one is a cost this user pays again on every visit.

**Stack:** Vite + React + TypeScript, a hand-rolled store (`src/lib/store`), and
Tailwind v4 whose theme comes from `tokens.css`. Utilities style the components.
The co-located stylesheets still in the tree are legacy, and the work rewrites
them as it reaches them. There is no CSS-in-JS. Hash routing (`#/tool/id`) for
deep links without server routes. Engine logic (keyword matching, token
estimation) is vendored from upstream, never reimplemented. Prefer fidelity to
the engine over elegance.

## 2. Visual language

Borders are hairline. Computed numbers (percentile flags, budget meters, live
counts) do the visual work that decoration does in consumer apps.

### Type — three faces, strict roles

| role | face | usage |
|---|---|---|
| `--font-label` | Archivo Variable (`wdth` ~110, caps, tracked) | section labels, buttons, nav, structure |
| `--font-data` | JetBrains Mono Variable | **all** data: numbers, keys, counts, timestamps, meta lines, IDs |
| `--font-prose` | Source Sans 3 Variable | sentences a human reads: content, descriptions, empty states |

Never set data in the prose face. Never set prose in mono.

### Color — semantic first, chrome second

- Pair every status color with a shape, icon, or text — never color alone (Web
  Content Accessibility Guidelines 1.4.1).
- **Categorical object-type hues:** long-lived object taxonomies get one hue
  each, used consistently on every chip/dot that names the type, always paired
  with the type name in text. These hues are a third axis: never reuse the
  status hues or `--accent`, and keep the object-type hues lower in chroma than
  both, because they carry identity rather than state.

### Contrast

Body/data text ≥4.5:1. Large text and essential labels ≥3:1. `--text-faint`
exists but serves only decorative or ≥12px non-essential text.

### Space & motion

<!-- vale Microsoft.DateOrder = NO -->
<!-- The rule reads the padding steps 4/8/12 as a date. Off for this
     paragraph only. -->
Everything sits on a 4px base grid. Paddings are dense (4/8/12), radii are
6–10px, borders are hairline. Density modes via `data-density` on `<html>`:
`comfortable` (default) and `compact` (row paddings −4px). Motion is 120–200ms,
transform and opacity only, serving orientation, causality, or continuity.
Respect `prefers-reduced-motion`.
<!-- vale Microsoft.DateOrder = YES -->

## 3. Interaction

### Rows and lists

- ~11 rows per phone screen collapsed. Titles truncate to one line.
- One primary tap target per row. Primary controls ≥44px. Secondary chips may
  be smaller (≥24px) but spaced (≥8px) with padded hit areas. **Open: the 44px
  floor is under review and may come down.** Design and build to 44px until the
  owner says otherwise — don't treat this note as licence to go smaller.
- Virtualize lists only at 500+ items. Below that, render every row.

### Accordions

Collapsed accordion headers carry data (counts, token totals, status).
**Multi-expand is the default**. Use one-at-a-time only where focus demands it
(for example, phone editing of long forms).

### Editing and saving

- Field-level `PATCH` autosave with a visible save state (`Saving / Saved /
  Failed`). Debounce ~700ms. Never send fields the user didn't touch.
- **Undo over confirm**: destructive-but-recoverable actions get soft-delete +
  undo toast. `confirm()` only for irreversible operations.
- Content the user authors (lorebook entries etc.) is markdown. Editors are
  plain textareas with char/token counts and a markdown symbol row — no rich
  editing.
- Every number shown comes from real data and matches the engine.

### Copy

- Reuse the engine's own UI copy (en.json vocabulary) when a concept exists
  upstream.
- **Copy provenance** — every user-visible string traces to the vendored
  catalog (`src/copy/vendor/ltm-en.json`) or to a registered entry in
  `src/copy/<area>.json`, each carrying a `note` saying why the product has no
  word for it. `scripts/copycatalog.mjs` checks a rendered surface for this.
  Quiet coining was the single most repeated defect in this tool. A string that
  appears mid-sentence around a component — a claim headline with a memory
  reference inside it — stays **one** catalog string and renders through
  `<Copy>` (`src/tools/memory/Copy.tsx`), which substitutes `{{slot}}` with a
  node. Splitting such a sentence into JSX fragments puts English word order in
  the markup and isn't a fix.

### Keyboard

- `j/k` or arrows move list focus (roving tabindex — one tab stop per
  composite). `Enter`/`o` opens. `Escape` closes/back.
- Always show a visible focus ring (≥3:1). Focus returns to the trigger on
  close.

### Latency

- Taps, toggles, filters, and inline edits respond within 100ms, with no
  indicator at all.
- Optimistic UI for predictable low-risk mutations (toggles, status, tag) with
  rollback + toast on failure.
- Show no indicator under ~300ms, and delay any indicator by ~100ms so it never
  flashes.

### Input modalities

Treat hover as an enhancement. Everything must be reachable by click, key, and
tap, and no action may depend on hover. Long-press opens context menus, and
every long-press has a visible alternative.

### Decision rules

| question | answer here |
|---|---|
| table vs list vs cards | table when comparing attributes/bulk-acting · list for scannable single-lines · cards only as a table's mobile collapse |
| detail: modal vs drawer vs page | non-modal side panel/drawer first · modal only for short must-decide-now · **never nest modals** |
| disclosure depth | max two levels · accordions never nested |
| mobile collapse | master-detail → stacked screens · side panel → bottom sheet · table → card list with 3-4 priority fields · actions → bottom dock |
| destructive action | soft-delete + undo toast · confirm only if truly irreversible |
| errors | inline, at the cause, specific, never color-only, never only in a toast |
| empty state | say what the view is and the next action — never a blank pane |
| filters | active filters as removable chips |

## 4. Component catalog

Implement each component once in `src/ui/` and reuse it everywhere. Use the
component that already exists when a screen needs one. Add a new component to
this catalog in the same change.

- **Audit row** — status rail · wrapping title · mono meta line · numeric right
  gutter · one tap target. This is the standard list unit, proven in the
  lorebook tool.
- **Accordion** — data-bearing summary header, chevron, multi-expand, state
  persists across navigation. Badge errors on collapsed headers, and expand
  automatically on error.
- **Console header** — sticky. Title row · probe/search field · meter bar · chip
  rail (sort/filter). Meters show budget/aggregate as data, one line.
- **Master-detail** — desktop split (list keyboard-navigable, detail in place),
  mobile stacked navigation with back.
- **Command palette** — Cmd-K, fuzzy over tools/records/actions, shows shortcuts
  (teaches them), local-state fast.
- **Dock** (mobile) / **toolbar** (desktop) — 2-3 primary actions, labeled.
- **Segmented control** — 2-5 exclusive modes (Find/Test pattern).
- **Stepper** — ± for numerics on touch, direct input on desktop.
- **Chip editor** — keys/tags: add, delete, highlight-on-match.
- **Save pill** — autosave state per record.
- **Toast** — transient confirmation + undo carrier. Never the only place an
  error appears.
- **Fullscreen text editor** — near-fullscreen textarea, live char/token counts
  with delta, wrap toggle, markdown symbol row.
- **Progress** — a track with a fill for a task the user started, with a
  count beside it when the site states one. Indeterminate while the total is
  unknown.
- **Tag/distribution panel** — group stats with bars, per-group Show/Select.
- **Decision rail** — tri-state per-row judgment (undecided / keep / drop) on
  the status rail, cycled by tap or set by single keys, advancing automatically.
  Judgment is a *persisted local ledger* (server-side, keyed by engine target),
  separate from transmission. Nothing transmits until an explicit Apply over
  everything decided, so a review resumes across days and devices. Undo stack
  over the ledger.

Two conventions sit alongside the catalog:

- **Styling** — Tailwind v4 (`@tailwindcss/vite`), theme generated from
  `tokens.css`, utilities in the JSX. The remaining hand-written stylesheets are
  legacy. §5 says when to rewrite one. The build **does** import Preflight, in
  `layer(base)`, so it reaches only properties this codebase never sets.
- **Mockups** — one shared kit, `design/MOCKUP-KIT.md`. Books never carry their
  own palette.

## 5. Styling

### Where UI lives — `src/ui/`

Shared components live in `src/ui/`, one folder-level. Anything used by more
than one screen belongs there. Anything used by one screen belongs beside that
screen. A new component carries no stylesheet, as `Button.tsx` does.

The co-located stylesheets still in the tree (`Chip.tsx` + `Chip.css`) are
legacy. The one case where a screen kept beside its tool co-locates the same way
is legacy too, because it's a *family* rather than a single component.
`src/tools/memory/detail/` is four components and four stylesheets. They answer
to the same rule: deleting the folder deletes its rules. A tool's one-off
screens still belong in that tool's global stylesheet
(`src/styles/memory.css`). The split is worth it only when the alternative is a
200-line unrelated block in a 600-line file.

### Tailwind utilities

**Tailwind utilities in the JSX style the components.** `tokens.css` generates
the theme (`src/styles/theme.css` bridges every token to a Tailwind name), so
`bg-accent`, `text-dim`, `min-h-tap`, `rounded-m` and `text-label` are the same
values the hand-written stylesheets used. There is one palette and one spacing
scale, whichever syntax reads them.

**Hand-written CSS is legacy.** Most components still carry a co-located
stylesheet. Nothing new should add one. **A stylesheet you are already editing
should be rewritten as utilities while you are in there**, in the same change,
at whatever granularity the work touches. A file nobody is touching can stay as
it is. The migration follows the work rather than running as a scheduled sweep.

What survives the move, because utilities can't hold it:

- **`tokens.css` stays the source.** Utilities read the theme, the theme reads
  the tokens. A raw value in the markup is still wrong.

### CSS comments — four kinds, nothing else

A stylesheet isn't documentation. Keep only:

- a one-sentence file header saying what the file covers
- section dividers (`/* ── rows ── */`)
- the derivation of a magic number (`/* centers the 15px icon in the 40px first
  line */`)
- a gotcha — a rule whose removal or reordering breaks something you can't
  see from the rule itself, with no error to point at

Cut everything else. No design rationale, no restating the declaration in prose,
no narrative about what changed, no cross-references a reader could grep for, no
em-dash asides that land a point.
