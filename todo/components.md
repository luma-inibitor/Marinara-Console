# Components — refactoring queue

Component work only. Tooling migrations live elsewhere; product bugs live in `BACKLOG.md`;
the design rules these items answer to are `design/DESIGN.md` §8 and `design/ARCHITECTURE.md` §2.

Everything here was verified against the tree at `origin/main` (5586c9c). Each item cites the
evidence, because an item nobody can check is an item nobody will act on. Where a line count or a
measurement appears, it was measured rather than estimated.

Items marked **[needs Luma's yes]** change something the owner has decided before; do not do them
without asking.

---

## 1. `SaveBar` and `SectionSaveBar` are one component written twice

`src/tools/lorebooks/entries.tsx:209-247` and `src/tools/presets/PresetsTool.tsx:719-757`.

jscpd measures this as the largest clone in the tree at 45 lines and 560 tokens. The two versions
have identical structure — conflict branch, dirty state line, cancel and save buttons — and differ
in exactly one copy key (`lorebooks.entry.conflictBody` against `presets.section.conflictBody`).
The docstring on the presets copy already says "mirrors the lorebook drawer's", so the duplication
was noticed and written down instead of removed.

The copy regressed during the copy-paste. `PresetsTool.tsx:743-753` hardcodes `"Saving…"`,
`"No changes"` and `"Save changes"` as string literals where `entries.tsx` routes all three through
`t()`. Nothing caught it: `copycheck` reports `src/tools/presets` as clean because those literals
happen to match catalog values verbatim, and `i18next/no-literal-string` does not fire because it
runs in `jsx-text-only` mode and these sit in JSX expression positions.

Extract one `SaveBar` into `src/ui/`, taking the conflict-body copy key as a prop. Route the three
literals through the catalog as part of the same change.

## 2. There is no shared list row, and four have grown instead

The rows are the densest, most repeated surface in the console, and every tool has built its own:

| surface | class | layout | defined in |
| --- | --- | --- | --- |
| lorebook entries | `.row-summary` | grid `32px minmax(0,1fr) 58px` | `src/styles/lorebooks.css:75` |
| review queue | `.mem-row` / `.mem-summary` | grid | `src/styles/memory.css:84` |
| sources | `.srow` | flex | `src/styles/memory.css:390` |
| presets | `.preset-card` | grid | `src/styles/presets.css:7` |

`design/todo.md`'s "standard components" list has **list item** as an entry with no implementation
at all. Most of that list has shipped — `Chip`, `Term`, `Edu`, `Picker`, `FacetDrawer`, `SearchBar`,
`SearchDisclosure`, `ModePill`, `ListGroup`, `RawJson` and `CopyableText` all exist in `src/ui/`,
and `SectionRow` covers "memory detail section". `ListGroup` exists for the group *header*, but the
rows underneath it are still per-tool.

Two entries on that list remain open: this one, and the per-type memory detail views (character,
relationship, timeline event, thread, world, tone). `MemoryDetail.tsx` renders every type through
one generic path — `sectionViews(n)` at line 46 with a `TypeIcon` in the header — so the per-type
work has not started. That second one is a design question before it is a component question, so it
is not scheduled below.

The shape is consistent enough to unify: a leading rail cell, a body with a title and a meta line,
and a trailing numeric gutter. Build `ListRow` in `src/ui/` against that shape and migrate the four.
Use `node scripts/domsnap.mjs before` / `... after --diff` to prove each migration renders
identically, which is what that script exists for.

This is the largest item in this file and should be split per surface rather than done at once.

## 3. Vault renders from the lorebook tool's stylesheet

`src/tools/memory/Vault.tsx:196-216` builds its rows from `row`, `row-summary`, `rail-cell`, `mid`,
`nm`, `metaline` and `num`. Every one of those classes is defined in `src/styles/lorebooks.css`,
not in a memory stylesheet and not in `src/ui/`.

Renaming or deleting anything in the lorebook stylesheet silently breaks the memory vault, and no
check will catch it — `deadcss.mjs` scans the whole tree at once, so a class used anywhere counts as
live everywhere. This is the concrete cost of the global stylesheets in item 5, and it resolves for
free once the Vault is on the shared `ListRow` from item 2.

Related and separate: `rail-cell` is defined **twice**, in `src/styles/presets.css` and
`src/styles/lorebooks.css`. Whichever loads last wins, which depends on the import order in
`src/main.tsx:7-13`. Stylelint's `no-duplicate-selectors` would catch this; until that lands, fix it
by hand.

## 4. The memory type badge is rendered four different ways

All four compose `type-${n.type}` for the colour and call `.replaceAll("_", " ")` for the label:

- `src/tools/memory/detail/MemoryDetail.tsx:127` — `<span className="mdc-type type-…">`
- `src/tools/memory/Vault.tsx:203` — `<span className="chip-min type-…">`
- `src/tools/memory/Vault.tsx:297` — `<Tag className="type-…">`
- `src/tools/memory/Vault.tsx:152` — `<span className="tdot type-…">` plus the label as a sibling

Four visual treatments of one datum, with the colour-token coupling repeated at each site. Extract
`TypeBadge` into `src/tools/memory/components/` beside `StatusPill`, with a variant prop for dot,
chip and tag. `StatusPill` is the model to follow: it already exists and already does this job for
status.

Status itself is inconsistent for the same reason. `StatusPill` is used at
`MemoryDetail.tsx:130` and `ClaimDetail.tsx:441-443`, but `Vault.tsx:204` renders the raw
`{n.status}` string and `Vault.tsx:301` renders a `seg st-${st}` button group. Put the Vault on
`StatusPill` in the same change.

## 5. `.replaceAll("_", " ")` is a copy transform living outside the copy catalog

Ten call sites: `Vault.tsx:152,203,297`, `Review.tsx:641,700`, `ClaimDetail.tsx:239`,
`MemoryDetail.tsx:127`, `MemoryTool.tsx:97`, `model/relations.ts:30`, `model/facets.ts:101`.

Every one of them turns a machine enum into English for a reader, which makes it copy by any
definition the project uses — and it is the one piece of copy generation that the whole
`src/copy/` apparatus never sees. A type renamed upstream from `timeline_event` to something else
changes the rendered label at ten sites with no catalog entry to update and no check to fail.

Two options, and this needs a decision. Either add a `humanize()` helper in `src/copy/` so the
transform is at least in one place, or give each enum value a real catalog key so the labels are
translatable and reviewable like every other string. The second is more work and is the one
consistent with how the rest of the console treats copy. **[needs Luma's yes]**

## 6. Three surfaces hand-roll a search input while `SearchBar` exists

`src/ui/SearchBar.tsx` is used by `Sources.tsx:170`, `Vault.tsx:139` and `SearchDisclosure.tsx:68`.
These three build their own `<input>` instead:

- `src/tools/presets/PresetsTool.tsx:99` — inside a bespoke `.probe`/`.pwrap` wrapper that
  reimplements the match-count display `SearchBar` already provides
- `src/tools/lorebooks/BookAudit.tsx:331`
- `src/shell/palette.tsx:125`

The palette is arguably legitimate — a command palette input has different focus and keyboard
behaviour from a filter field — so treat it as a separate decision rather than a migration. The
other two are straightforward.

The ranking behind those inputs is inconsistent too, but the fix there is a library choice
(uFuzzy for name matching, MiniSearch for prose bodies) and it is queued in `BACKLOG.md` rather
than here, because it is not a component change.

## 7. The per-component stylesheet migration is roughly half done

`src/ui/index.ts` states the rule: "Each component owns its own stylesheet, so deleting the
component deletes its rules." Twenty-four files follow it. Three do not, and they are the large ones:

- `src/styles/memory.css` — 506 lines
- `src/styles/presets.css` — 276 lines
- `src/styles/lorebooks.css` — 264 lines

All three are imported globally at `src/main.tsx:7-13`, so nothing scopes them and nothing stops
them growing. Item 3 is the first bug this has produced; it will not be the last.

Nothing currently ratchets this. Adding a check that the three global sheets may only shrink would
stop the bleeding while the migration proceeds, and is far cheaper than the migration itself. Do
that first.

Also in this bucket: `.toaster` is a shell component, but its positioning rules are split across
`src/styles/lorebooks.css:252-256` and `src/styles/presets.css:255-256`, each with its own
duplicated `@media (min-width: 900px)` override. Delete a tool and the toaster moves. Those rules
belong beside `src/shell/Toaster.tsx`.

## 8. The 900px breakpoint is written out in six places

`src/ui/useIsDesktop.ts:20`, `src/ui/Sheet.css:16`, `src/styles/lorebooks.css:256`,
`src/styles/memory.css:204`, `src/styles/presets.css:256`, and as a token at
`src/styles/theme.css:90` (`--breakpoint-split: 900px`).

The token exists and is used by nothing. CSS media queries cannot take a `var()`, which is the
real reason the literal keeps reappearing, but Tailwind v4 generates a `split:` variant from that
token and the project already runs Tailwind. Once the Tailwind migration in `design/todo.md` is
finished, the media queries can use the variant and the literal drops to one definition.

Until then, at minimum add a comment at each site pointing at the token, the way `index.html:8`
already does for `--canvas`.

## 9. Dead component surface

These are exported and used only inside their own file. Un-export or delete:

- `CollapseButton` — `src/ui/ListGroup.tsx:11`
- `FacetValue`, `FacetLine`, `FacetGroup` — `src/ui/FacetDrawer.tsx:6,15,18`
- `PickerOption` — `src/ui/Picker.tsx:5`
- `DisclosureOption` — `src/ui/SearchDisclosure.tsx:9`

The five interfaces are worth a moment's thought rather than a blanket deletion: an exported prop
type is sometimes deliberate, so a consumer can build a value to pass in. Check each call site
before removing.

Two cautions, both learned the hard way while writing this file.

`scripts/deadexports.mjs` already reports all six. Its header at line 15 is explicit — "Any import
of the name from another file, TYPE IMPORTS INCLUDED" — and every one of them is already parked in
`design/deadexports-baseline.json`. They are baselined judgement calls, not misses. So this item is
about burning down that baseline, not about finding anything new.

**Do not un-export `SheetHead`.** A bare `knip` run reports the forwarding line at
`src/ui/index.ts:27` as unused, and that is a false positive from running knip without a config.
`.design-sync/previews/SheetHead.tsx:2` imports it as `from "marinara-console"`, a bare specifier
that resolves through the design-sync harness rather than through this tree, so every barrel line
looks orphaned from inside `src/`. `scripts/deadexports.mjs:34-38` documents this exact trap and
exempts `src/ui/index.ts` for it. Removing the line breaks the preview.

## 10. Inventory, for sizing the work

From `node scripts/components.mjs`:

```
124 files · 202 functions return markup (103 components, 99 inline closures)
presentational 141 · store-bound 27 · domain 33 · violating 1
domain + violating: 34 of 202 — the ones props alone cannot move
```

The 34 domain-coupled functions are the real constraint on this whole file: they reach past props
into a store, the model or the endpoints layer, so no amount of prop-threading will let two
surfaces share them. Twenty-two of the 34 are in three files —
`src/tools/memory/ClaimDetail.tsx` (9), `src/tools/memory/Review.tsx` (6),
`src/tools/memory/Vault.tsx` (5) — which is where a components effort should concentrate.

The single `violating` entry is `Palette` at `src/shell/palette.tsx:85`.

`scripts/components.mjs` is 506 lines and is referenced by no npm script, only by prose in
`design/`. It is genuinely useful — this section is its output — so it should be wired into
`package.json` rather than left to rot. That is queued with the tooling work, not here.

---

## Suggested order

1. Item 9 (dead surface) and the `rail-cell` half of item 3 — small, independent, no risk.
2. Item 1 (`SaveBar`) — self-contained, and it closes a live copy regression.
3. Item 7's ratchet — cheap, and it stops the global stylesheets growing while the rest proceeds.
4. Item 4 (`TypeBadge`, `StatusPill` in Vault) — small, and it is good practice for item 2.
5. Item 6 (`SearchBar` migration) — small.
6. Item 2 (`ListRow`), one surface per change, `domsnap` on each. This resolves item 3 fully and
   makes most of item 7 tractable.
7. Item 5 and item 8 need decisions before they can be scheduled.
