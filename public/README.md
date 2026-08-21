# Lorebook Mobile

A standalone mobile editor for [Marinara Engine](https://github.com/luma-inibitor/Marinara-Engine)
lorebooks. Built for auditing a large book one-handed on a phone: reviewing token
counts, key counts, titles and ordering, then drilling into the bloated entries to
fix them.

It talks to a running engine over the REST API. It is a separate tool, not a fork
patch — nothing in the engine changes.

```sh
# next to the engine, on the Termux box
node server.mjs

# or from a laptop, against the phone over Tailscale
MARINARA_URL=http://<engine-host>:7860 node server.mjs
```

Then open `http://<host>:7872`.

| Env | Default | |
| --- | --- | --- |
| `MARINARA_URL` | `http://127.0.0.1:7860` | engine to proxy |
| `PORT` | `7872` | |
| `HOST` | `0.0.0.0` | |

No dependencies, no build step, no framework. Node 18+ (needs global `fetch`).

## Why it exists

The engine's built-in lorebook editor is painful on a phone for three measurable
reasons:

**The payload is mostly dead weight.** `GET /lorebooks/:id/entries` returns every
entry's 1536-float embedding vector. On a 47-entry book that is 884 KB of a
1,065 KB response — 83% — and the editor never renders any of it. This server
strips `embedding` on the way past, replacing it with a `hasEmbedding` boolean, so
the same book arrives in 181 KB.

**Nothing is virtualized.** `LorebookEditor.tsx` is 3,309 lines and
`LorebookEntryRow.tsx` is 1,868; all rows mount at once, each carrying drag-and-drop
handlers and autosave timers.

**The touch targets are too small.** The expand chevron is `h-6 w-4` — 24×16 px —
and the status dot is 24 px, against a 44 px platform minimum, with roughly seven
distinct targets packed into a 28 px row.

## Design

A collapsed row is two lines — full untruncated title, then tag, position and keys —
with a status circle and order on the left and token/key counts on the right. That
averages 56 px, so **11 entries fit on screen at once** against the engine's five,
while still carrying far more per row. Density comes from typography, not from
cramming controls: there is one tap target per row, and the things you touch are
all ≥44 px.

**Two right-hand numeric columns** — tokens and keys — form scannable stacks. Sort
by tokens, order, keys, title or last-edited.

**Bloat flags are computed from the book's own distribution** (p90 of tokens and of
key count), not a hardcoded threshold, so they stay meaningful as the book changes.

**The budget meter** shows what the book would inject, on one line. In Find mode it is the
worst case, "if everything fires". In Test mode it becomes concrete.

**One field, two modes.** *Find* filters by name, keys, content, description and
tag. *Test* treats the text as chat text and shows which entries would actually
activate — matched keys highlight, rows get a fires/idle verdict, firing entries
sort to the top, and the meter reports the real injection cost for that text.

**Tags** get a distribution panel (counts, token weight, always/muted breakdown),
group-by-tag section headers, and select-by-tag feeding bulk enable/disable/retag.
Untagged is a first-class group — plenty of real entries have no tag.

**The expanded entry is itself a stack of collapsed rows** — Primary Keys, Description,
Content, Trigger & Position, Advanced, Name — each showing a summary of what is inside
(key count and first few keys; char and token counts; status, position and order). Opening
one closes the others, matching the engine's inline editor.

**Status uses the engine's own vocabulary and colours** — Normal (emerald), Constant
(yellow), Selective (red), Disabled (grey), straight from `STATUS_DOT_COLOR` in
`LorebookEntryRow.tsx`. The coloured circle is the only place the status is stated; no row
repeats it in text. The interactive accent is blue so it never competes with those four.

**UI copy is lifted from the engine's `en.json`** wherever an equivalent string exists —
"Primary Keys", "Would activate", "Search entries…", "Saved automatically", "Add Entry",
"tokens (est.)", "↑Char" / "↓Char" / "@Depth", "Delete this lorebook entry?" — so the two
apps name the same things the same way.

**Advanced fields are collapsed behind one row**, showing a count of non-defaults.
Across the books this was built against, all ~30 were at their defaults on every
single entry, so they earn one tap, not permanent screen space.

## Correctness

`public/lib/lorebook-keyword-matching.js` and `public/lib/regex-safety.js` are
**vendored verbatim** from `packages/shared/src/utils/` in the engine, transpiled
with `tsc` rather than hand-converted. Test mode calls the same `testPrimaryKeys` /
`testSecondaryKeys` the server uses when it scans, so the preview cannot claim an
entry fires when a real generation would disagree. Whole-word boundaries, case
sensitivity, regex with the ReDoS guard, the literal fallback on invalid patterns,
and all five selective-logic operators behave identically.

Token counts use `Math.ceil(length / 4)`, matching `approximateTokens()` in
`packages/shared/src/utils/agent-cost.ts`, so the numbers agree with what the main
app shows.

**Vendored from:** `staging` @ `f195f57b1` (engine 2.4.4). If the engine's matching
rules change, re-run:

```sh
npx tsc <engine>/packages/shared/src/utils/{lorebook-keyword-matching,regex-safety}.ts \
  --target es2022 --module es2022 --moduleResolution bundler --outDir public/lib
```

The `Cannot find module '../types/lorebook.js'` error is expected — it is a
type-only import and is erased.

## Writes

Edits go straight to the API. Saves are **field-level `PATCH`** — only the field you
touched is sent, so a stale accordion cannot clobber a field you did not edit.
Text fields debounce at 700 ms and flush immediately on blur; toggles, order and key
edits save at once. Marinara is single-user, so there is no locking or conflict
detection.

Bulk actions use `PATCH /lorebooks/:id/entries/bulk`, then refetch.

## Known limits

- The book picker fetches every book's entries to compute its stats. Fine for a
  handful of books; it would want a summary endpoint for dozens.
- No folder support — the books this was built for use none, and the engine's
  folder tree does not earn the screen space on a phone.
- Reordering is a ±10 stepper on `order`, not drag. Dragging fights the scroll
  on a touch screen.
- Token counts are the engine's own estimate, not a real tokenizer.
