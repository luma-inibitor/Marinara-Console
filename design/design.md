# Marinara Console — Design Spec

Every rule below was confirmed by the owner in a line-by-line review of the
previous framework document. Nothing here is inferred, generalized, or
extrapolated. **A new rule needs an owner citation** — if it isn't confirmed,
it doesn't go in this file.

## 1. What this is

A standalone management console for Marinara Engine (proxied via `server.mjs`),
hosting power-user tools: lorebook editor, preset browser/editor,
long-term-memory agent UI, and whatever comes next. Audience of one: an expert
user who lives in the tool. Density is respect; every needless click is a
repeated tax.

**Stack:** Vite + React + TypeScript, a hand-rolled store (`src/lib/store`), and
Tailwind v4 whose theme is generated from `tokens.css`. Components are styled
with utilities; the co-located stylesheets still in the tree are legacy and are
rewritten as the work reaches them. There is no CSS-in-JS. Hash routing
(`#/tool/id`) for deep links without server routes. Engine logic (keyword
matching, token estimation) is vendored from upstream, never reimplemented —
fidelity to the engine beats elegance.

## 2. Visual language

Hairline borders. Data is the ornament: computed numbers (percentile flags,
budget meters, live counts) do the visual work that decoration does in consumer
apps.

### Type — three faces, strict roles

| role | face | usage |
|---|---|---|
| `--font-label` | Archivo Variable (wdth ~110, caps, tracked) | section labels, buttons, nav, structure |
| `--font-data` | JetBrains Mono Variable | ALL data: numbers, keys, counts, timestamps, meta lines, IDs |
| `--font-prose` | Source Sans 3 Variable | sentences a human reads: content, descriptions, empty states |

Never set data in the prose face. Never set prose in mono.

### Color — semantic first, chrome second

- Pair every status color with a shape, icon, or text — never color alone
  (WCAG 1.4.1).
- **Categorical object-type hues:** long-lived object taxonomies get one hue
  each, used consistently on every chip/dot that names the type, always paired
  with the type name in text. They are a third axis — never reuse the status
  hues or `--accent`, and keep them lower in chroma than both (they are
  identity, not state).

### Contrast

Body/data text ≥4.5:1; large text and essential labels ≥3:1. `--text-faint`
exists but is restricted to decorative or ≥12px non-essential text.

### Space & motion

4px base grid, religiously. Dense paddings (4/8/12), radii 6–10px, hairlines.
Density modes via `data-density` on `<html>`: `comfortable` (default) and
`compact` (row paddings −4px). Motion 120–200ms, transform/opacity only,
purposeful (orientation, causality, continuity) — respect
`prefers-reduced-motion`.

## 3. Interaction

### Rows and lists

- ~11 rows per phone screen collapsed; titles truncate to one line.
- One primary tap target per row. Primary controls ≥44px; secondary chips may
  be smaller (≥24px) but spaced (≥8px) with padded hit areas. **Open: the 44px
  floor is under review and may come down.** Until Luma says otherwise, design
  and build to 44px — don't treat this note as licence to go smaller.
- Virtualize lists only at 500+ items; below that, render honestly.

### Accordions

Accordions with **data-bearing collapsed headers** (counts, token totals,
status — closed ≠ invisible). **Multi-expand is the default**; one-at-a-time
only where focus demands it (e.g. phone editing of long forms).

### Editing and saving

- Field-level PATCH autosave with a visible save state (`Saving / Saved /
  Failed`); debounce ~700ms. Never send fields the user didn't touch.
- **Undo over confirm**: destructive-but-recoverable actions get soft-delete +
  undo toast. `confirm()` only for genuinely irreversible operations.
- Content the user authors (lorebook entries etc.) is markdown; editors are
  plain textareas with char/token counts and a markdown symbol row — no rich
  editing.
- Numbers shown are computed from real data, engine-faithful.

### Copy

- Reuse the engine's own UI copy (en.json vocabulary) when a concept exists
  upstream.
- **Copy provenance** — every user-visible string traces to the vendored
  catalog (`src/copy/vendor/ltm-en.json`) or to a registered entry in
  `src/copy/<area>.json`, each carrying a `note` saying why the product has no
  word for it. `scripts/copycatalog.mjs` checks this mechanically against a
  rendered surface. Coining silently has been the single most repeated defect
  in this tool. A string that appears mid-sentence around a component — a claim
  headline with a memory reference inside it — stays ONE catalog string and
  renders through `<Copy>` (`src/tools/memory/Copy.tsx`), which substitutes
  `{{slot}}` with a node. Splitting such a sentence into JSX fragments puts
  English word order in the markup and is not a fix.

### Keyboard

- `j/k` or arrows move list focus (roving tabindex — one tab stop per
  composite); `Enter`/`o` opens; `Escape` closes/back.
- Visible focus ring (≥3:1) always. Focus returns to trigger on close.

### Latency

- ≤100ms for taps/toggles/filters/inline edits — no indicator at all.
- Optimistic UI for predictable low-risk mutations (toggles, status, tag) with
  rollback + toast on failure. Network is confirmation, not permission.
- No spinner under ~300ms (delay any indicator ~100ms so it never flashes).

### Input modalities

Hover is an enhancement, never the only path. Everything reachable by click,
key, and tap. No hover-dependent actions; long-press for context menus with a
visible alternative.

### Decision rules

| question | answer here |
|---|---|
| table vs list vs cards | table when comparing attributes/bulk-acting; list for scannable single-lines; cards only as a table's mobile collapse |
| detail: modal vs drawer vs page | non-modal side panel/drawer first; modal only for short must-decide-now; **never nest modals** |
| disclosure depth | max two levels; accordions never nested |
| mobile collapse | master-detail → stacked screens; side panel → bottom sheet; table → card list with 3-4 priority fields; actions → bottom dock |
| destructive action | soft-delete + undo toast; confirm only if truly irreversible |
| errors | inline, at the cause, specific, never color-only; never only in a toast |
| empty state | say what the view is and the next action — never a blank pane |
| filters | active filters as removable chips |

## 4. Component catalog

Implemented once in `src/ui/`, reused everywhere. If a screen needs a pattern
that exists, use it; if it needs a new one, add it here in the same change.

- **Audit row** — status rail · wrapping title · mono meta line · numeric right
  gutter · one tap target. The workhorse list unit (proven in the lorebook tool).
- **Accordion** — data-bearing summary header, chevron, multi-expand, state
  persists across navigation; badge errors on collapsed headers, auto-expand on
  error.
- **Console header** — sticky; title row · probe/search field · meter bar · chip
  rail (sort/filter). Meters show budget/aggregate as data, one line.
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
- **Fullscreen text editor** — near-fullscreen textarea, live char/token counts
  with delta, wrap toggle, markdown symbol row.
- **Tag/distribution panel** — group stats with bars, per-group Show/Select.
- **Decision rail** — tri-state per-row judgment (undecided / keep / drop) on
  the status rail, cycled by tap or set by single keys with auto-advance.
  Judgment is a *persisted local ledger* (server-side, keyed by engine target),
  separate from transmission: nothing is sent until an explicit Apply over
  everything decided, so a review resumes across days and devices. Undo stack
  over the ledger.

Two conventions that sit alongside the inventory:

- **Styling** — Tailwind v4 (`@tailwindcss/vite`), theme generated from
  `tokens.css`, utilities in the JSX. The remaining hand-written stylesheets are
  legacy; §5 says when to rewrite one. Preflight IS imported, in `layer(base)`,
  so it reaches only properties we never set.
- **Mockups** — one shared kit, `design/MOCKUP-KIT.md`. Books never carry their
  own palette.

## 5. Styling

### Where UI lives — `src/ui/`

Shared components live in `src/ui/`, one folder-level. Anything used by more
than one screen belongs there; anything used by one screen belongs beside that
screen. New components carry no stylesheet — `Button.tsx` is the reference.

The co-located stylesheets still in the tree (`Chip.tsx` + `Chip.css`) are
legacy, and so is the one case where a screen kept beside its tool co-locates
the same way because it is a *family* rather than a single component —
`src/tools/memory/detail/` is four components and four stylesheets. The rule
they answer to is the one above: deleting the folder deletes its rules. A tool's
one-off screens still belong in that tool's global sheet
(`src/styles/memory.css`); the split is worth it only when the alternative is a
200-line unrelated block in a 600-line file.

### Tailwind utilities

**Components are styled with Tailwind utilities in the JSX.** The theme is
generated from `tokens.css` (`src/styles/theme.css` bridges every token to a
Tailwind name), so `bg-accent`, `text-dim`, `min-h-tap`, `rounded-m` and
`text-label` are the same values the hand-written rules used. There is one
palette and one spacing scale, whichever syntax reaches for them.

**Hand-written CSS is legacy.** Most components still carry a co-located
stylesheet. That is history, not a pattern to copy: nothing new should add one,
and **a stylesheet you are already editing should be rewritten as utilities
while you are in there**, in the same change, at whatever granularity the work
touches. A file nobody is touching can stay as it is — this is a migration that
follows the work, not a sweep to schedule.

What survives the move, because utilities cannot hold it:

- **`tokens.css` stays the source.** Utilities read the theme, the theme reads
  the tokens. A raw value in the markup is still wrong.

### CSS comments — four kinds, nothing else

A stylesheet is not documentation. Keep only: a one-sentence file header saying
what the file covers; section dividers (`/* ── rows ── */`); the derivation of a
magic number (`/* centers the 15px icon in the 40px first line */`); and a
gotcha — a rule whose removal or reordering silently breaks something you cannot
see from the rule itself.

Cut everything else. No design rationale, no restating the declaration in prose,
no narrative about what changed, no cross-references a reader could grep for, no
em-dash asides that land a point.
