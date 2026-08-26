# Memory management interface — design requirements briefing

Covering the work from the start of the memory tool through the component
refactor. This is the orientation document: what the interface is
for, what's settled, what the domain actually looks like, and what's still
open. It sits above `DESIGN.md` (the framework) and `CHECKLIST.md` (the
pre-flight), and points into both rather than repeating them.

---

## 1. What this is, and who it's for

The Marinara Console is a management interface for Marinara Engine. The memory
tool inside it manages **long-term memory**: durable facts extracted from
roleplay chats and lorebooks, which the engine later recalls into context.

The audience is one expert user who lives in the tool. Density is respect. Every
needless click is a tax paid repeatedly. The interface is a dark instrument
panel, not a consumer app: data is the ornament, and computed numbers do the
visual work that decoration does elsewhere.

**The device that matters is a 486px-wide phone** (1080 physical, DPR 2.22). A
layout tuned only at 390 has never been seen at the width it ships to. Desktop
matters too, but mobile isn't the afterthought.

## 2. The job the tool actually does

Material flows in one direction, and the navigation now traces it:

**Sources → Review → Vault**

1. **Sources.** Chat summaries and lorebook entries are candidates for import.
   Importing one saves a source note and spends a model call to extract claims
   from it. Lorebooks import in bulk; chat summaries need reading and curating
   first, because their text is what extraction sees.
2. **Review.** Extraction produces *claims* — proposed mutations to the vault.
   Each is kept or dropped. Nothing is written until Apply. This is the work.
3. **Vault.** The memories that survived. Browsed, searched, edited, archived.

A fourth view, **Activity**, is designed but not built. It's the prerequisite
for undo.

**The single most important design question**, and the one the detail pane was
rebuilt around: *what will my vault look like if I accept this?* An earlier
version answered "here is all the data about this claim", and the owner's
verdict was "I feel assaulted by information I have no idea what to do with."

## 3. Current state

Built and shipped on `feat/component-refactor`:

| Surface | State |
|---|---|
| Navigation | Scope bar above the views; four views, one word each, count badges |
| Scope picker | Character → chat, cascading disclosures rendered as breadcrumbs |
| Sources | Search, quick rail, grouped rows, bulk and curate paths, confirm, job dock, result |
| Review | Grouped queue, row v2, group header v4, facet drawer, apply dock |
| Claim detail | v5 zones — headline / preview / evidence / decide bar |
| Vault | Search, type filters, list, section editor |
| Note peek | Layered read-only view of any memory, reachable from a link |
| `src/ui/` | 22 shared components, each with a co-located stylesheet |

**Not built:** Activity, undo, branch scope (the engine exposes no `/branches`
route and chats carry no branch field), index-health repair.

## 4. The design system this must live inside

Full detail in `DESIGN.md`. The parts that constrain new work:

- **Three type faces with strict roles.** `--font-label` for structure,
  `--font-data` for *all* data, `--font-prose` for sentences a human reads.
  Never set data in the prose face. Never set prose in mono.
- **Color has three reserved axes.** Status (`ok`/`warn`/`danger`/`off`) mirrors
  the engine. `--accent` is interactive chrome *only*. Categorical type hues are
  identity, kept dimmer than both, always paired with the type name in text.
  Color is never the only carrier of meaning.
- **Two semantic breakpoints.** 720px (below it everything stacks) and 900px
  (above it a list and its detail sit side by side).
- **Reading measure `--measure: 68ch`** on prose. Not on identifiers or
  key/value rows — wrapping `source_character_2cdcc172e8fe3cd6` serves nobody.
- **The browser suite enforces the contrast and tap-target floors**, not
  judgment. Body and data text ≥4.5:1; primary targets ≥44px.

## 5. Requirements that are settled

Owner-confirmed. Don't re-litigate; see `DESIGN.md` §2 for the full list.

- Titles **truncate to one line** in list rows.
- Collapsed headers still carry data — counts, totals, status. Closed isn't
  invisible. Multi-expand is the default.
- One primary tap target per row.
- **Undo over confirm.** `confirm()` only for genuinely irreversible operations.
- Numbers are computed from real data and engine-faithful. Thresholds derive
  from the data, not from constants someone picked.
- Copy comes from the engine's own catalog (`ltm-en.json`) wherever the
  concept exists upstream. Anything genuinely new is registered in `OURS` with a
  reason. `scripts/copycheck.mjs` enforces this.
- Content is markdown; editors are plain textareas with counts. No rich editing.

## 6. Requirements this work established

Every one of these exists because that exact defect shipped and the owner caught
it. `CHECKLIST.md` holds the full list with incidents attached.

- **Name the decision a surface serves before drawing it.** If the answer is
  "it shows the data", start over.
- **List every state before drawing one** — empty, loading, running, partial
  failure, error, one item, many, more than fits.
- **Design both projections in the same pass.** Pointer and touch, wide and
  narrow. Not "make it responsive later".
- **Check the domain before designing around it.** A whole repair panel was once
  built around an action the engine has no route for.
- **Say each fact once per screen**, and make every count on screen reconcile
  with every other.
- **One meaning per channel.** Accent means interactive; a read-out must not
  reach for it.
- **Split components by role, not by shape.** `Chip` and `Tag` look identical
  and are separate, because one is pressable and the other isn't.
- **Own the behavior, slot the shape.** `ListGroup` owns the chevron and its
  accessible name; each list keeps its own header layout.
- **Render it and look at it.** Every occlusion, wrap and clipping defect in this
  repo was invisible in the markup and obvious in a screenshot.

## 7. The domain — what a memory actually is

Measured from the live corpus on 2026-08-23 (31 notes). **This is the evidence
base for any per-type design work**, and it's not what you would guess.

Full field-by-field reference in [MEMORY-SCHEMA.md](MEMORY-SCHEMA.md). The
summary that matters for design work:

### Every memory carries

`id` · `type` · `status` · `modes` · `scope` · `tags` · `keywords` ·
`createdAt` · `updatedAt` · `links` · `sections` · `version`

Optional on any type: `title`, `manualKeywords`, `suppressedKeywords`,
`conflicts`. Restricted by type: `provenance` (required on `source`, forbidden
elsewhere), `subjects` (exactly 1 on `character`, 2 on `relationship`, forbidden
elsewhere), `extractionFingerprint` (`source` only).

### A section is more than its text

Every section carries structured fields alongside `text`, and they're
populated: `evidence[]` and `confidence` on all 38 sections in the corpus,
`salience` on 30, `contributions[]` on 30, `importance` on 24. `dimensions` and
`dimensionChanges` carry ten relationship axes and appear on one. These are
structured by design and aren't to be parsed out of the prose.

### The eight types

`source` · `timeline_event` · `character` · `relationship` · `scene` ·
`thread` · `world` · `tone`. The corpus holds all but `scene`.

### Types differ mainly in their sections

| Type | n | Sections | Section text (min/med/max) | Links seen |
|---|---:|---|---|---|
| **character** | 3 | `core` always; `voice`, `backstory`, `habits`, `appearance` optional | 82 / 100 / 434 | `extracted_from`, `caused_by` |
| **relationship** | 1 | `state` | 78 / 78 / 78 | `caused_by`, `extracted_from` |
| **thread** | 5 | `state` (4), `summary` (1) | 109 / 122 / 133 | `caused_by`, `extracted_from` |
| **timeline_event** | 8 | `event` | 75 / 83 / 96 | `extracted_from` |
| **tone** | 3 | `observations` **and** `profile` — both, always | 83 / 96 / 96 | `extracted_from` |
| **world** | 3 | `canon` | 169 / 174 / 252 | `extracted_from` |
| **source** | 8 | `source` | 66 / 781 / **2818** | — |
| **scene** | 0 | — | — | — |

### What this means for design

- **Character is the only type with a variable section set.** One required
  section and four optional ones. Any per-type view has to handle a character
  with one section and a character with five.
- **Tone is the only type with two mandatory sections.** A single-body layout
  misrepresents it.
- **Source is an order of magnitude longer than everything else** — a median of
  781 characters against 83–174 elsewhere, with a maximum of 2,818. It needs
  folding; the others don't.
- **Thread is the only type that reaches `resolved`.** Status isn't uniformly
  interesting across types.
- **Timeline events are the most numerous and the shortest.** They're read in
  bulk, not one at a time.
- **`caused_by` appears only on thread, relationship and character.** A links
  section is dead weight on world and tone.
- **Keyword count across the entire corpus is zero.** The keyword editor exists
  and nothing uses it. Either the extractor doesn't populate keywords, or this
  corpus predates it — worth confirming before designing around keywords.

## 8. Open questions

- **Group headers hold 144 tab stops** in the review list. Fixing it needs a
  keyboard model for reaching a specific group's bulk action, which is a design
  decision rather than a mechanical fix.
- **Per-type memory views** — the subject of the current mockup round.
- **Activity and undo** — designed in wireframe, not built.
- **Index health** has no home since the status line was removed.
- **Refresh versus re-extract** for a source with an update available.
- **The `rewrite` value appears in two facets** and looks like the same fact
  surfaced twice.
- Three high-severity findings from the 2026-08-21 review remain open; see
  `BACKLOG.md`.

## 9. How work gets checked

Not optional, and not judgment calls:

| Command | Checks |
|---|---|
| `npx playwright test` | Every screen at four viewports: contrast, tap targets, console errors, overlay dismissal, keyboard |
| `node scripts/copycheck.mjs <file>` | Every user-visible string traces to the catalog or `OURS` |
| `node scripts/deadcss.mjs` | CSS classes nothing uses — fails when the list grows past `design/deadcss-baseline.json` |
| `node scripts/deadexports.mjs` | Symbols exported but used only where declared, dead re-exports included — same baseline ratchet |
| `node scripts/domsnap.mjs before` / `after --diff` | A refactor renders identically, and what it didn't reach |
| `MC_SHOTS=1 MC_SHOT_URL=<path> npx playwright test shots` | Screen captures at 390 / 486 / 768 / 1280 |
