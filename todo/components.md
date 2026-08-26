# Component work queue

> This document uses ASD-STE100 Simplified Technical English writing rules.
> Sentences have a maximum of 25 words. Paragraphs have a maximum of 6 sentences.
> The voice is active. Each word has one meaning.
> Command text, file paths, class names, and tool output do not obey these rules. They are literal text.
> Note: an approved-dictionary check with a tool such as HyperSTE did not occur.
> The writing rules are applied. Full dictionary conformance is not certified.

This document holds component work only.
`todo/tooling-migration.md` holds the tool work.
`BACKLOG.md` holds the product faults.
The design rules for this work are in `design/DESIGN.md` section 8 and `design/ARCHITECTURE.md` section 2.

A check of each item against `origin/main` (commit 5586c9c) occurred.
Each item gives its evidence. A person cannot act on an item without evidence.
Each measurement in this document comes from a test, not from an estimate.

Items with the mark **[ask Luma first]** change a decision that the owner made before.
Do not do those items without permission.

---

## 1. `SaveBar` and `SectionSaveBar` are one component written two times

The two files are `src/tools/lorebooks/entries.tsx:209-247` and `src/tools/presets/PresetsTool.tsx:719-757`.

jscpd measures this as the largest duplicate in the repository. It is 45 lines and 560 tokens.
The two versions have the same structure:
a conflict branch, a state line, a cancel button, and a save button.
They are different in one copy key only.
`entries.tsx` uses `lorebooks.entry.conflictBody`. `PresetsTool.tsx` uses `presets.section.conflictBody`.
The comment on the presets version already says "mirrors the lorebook drawer's".
Thus a person found the duplicate and wrote it down. That person did not remove it.

The copy became worse during the duplication.
`PresetsTool.tsx:743-753` holds three literal strings: `"Saving…"`, `"No changes"`, and `"Save changes"`.
`entries.tsx` sends each of the three through `t()`.

No check found this fault. There are two reasons:

1. `copycheck` reports `src/tools/presets` as clean. The three strings match catalog values exactly.
2. `i18next/no-literal-string` operates in `jsx-text-only` mode. The three strings are in JSX expression positions.

**Action.** Move one `SaveBar` into `src/ui/`.
Give it the conflict copy key as a property.
Send the three literal strings through the catalog in the same change.

---

## 2. There is no shared list row. Four different rows exist

The row is the most frequent element in the console. Each tool built its own row.

| Screen | Class | Layout | File |
|---|---|---|---|
| Lorebook entries | `.row-summary` | grid `32px minmax(0,1fr) 58px` | `src/styles/lorebooks.css:75` |
| Review queue | `.mem-row` and `.mem-summary` | grid | `src/styles/memory.css:84` |
| Sources | `.srow` | flex | `src/styles/memory.css:390` |
| Presets | `.preset-card` | grid | `src/styles/presets.css:7` |

The list of standard components in `design/todo.md` has **list item** with no implementation.

Most of that list is complete.
`src/ui/` holds `Chip`, `Term`, `Edu`, `Picker`, `FacetDrawer`, `SearchBar`,
`SearchDisclosure`, `ModePill`, `ListGroup`, `RawJson`, and `CopyableText`.
`SectionRow` gives the "memory detail section" item.
`ListGroup` gives the group heading. But each row below the heading stays in its tool.

Two items on that list are open.
The first item is the list row.
The second item is the memory detail view for each type:
character, relationship, timeline event, thread, world, and tone.
`MemoryDetail.tsx` sends each type through one path.
It calls `sectionViews(n)` at line 46 and shows a `TypeIcon` in the heading.
Thus the work for each type did not start.
That second item is a design question before it is a component question.
Thus the order at the end of this document does not include it.

**Action.** The four rows have sufficient common structure:
a first cell, a body with a title and a data line, and a last cell with a number.
Build `ListRow` in `src/ui/` with that structure. Then change the four screens.

Prove each change with two commands:

```
node scripts/domsnap.mjs before
node scripts/domsnap.mjs after --diff
```

This is the largest item in this document.
Do one screen for each pull request. Do not do the four screens together.

---

## 3. The Vault uses the stylesheet of the lorebook tool

`src/tools/memory/Vault.tsx:196-216` builds its rows from seven classes:
`row`, `row-summary`, `rail-cell`, `mid`, `nm`, `metaline`, and `num`.
`src/styles/lorebooks.css` holds each of the seven.
Neither a memory stylesheet nor `src/ui/` holds them.

Thus a change to the lorebook stylesheet breaks the memory vault.
No check finds this fault.
`deadcss.mjs` examines the full repository together.
Thus a class with use in one place counts as a live class in each place.

This is the cost of the global stylesheets in item 5.
Item 2 corrects this fault. `ListRow` gives the Vault its own classes.

**A separate fault.** `rail-cell` has two definitions.
The two files are `src/styles/presets.css` and `src/styles/lorebooks.css`.
The last file to load wins. The import order at `src/main.tsx:7-13` decides this.
The stylelint rule `no-duplicate-selectors` finds this fault.
Correct it manually before that rule arrives.

---

## 4. The memory type badge has four different forms

Each of the four builds `type-${n.type}` for the colour.
Each of the four calls `.replaceAll("_", " ")` for the text.

- `src/tools/memory/detail/MemoryDetail.tsx:127` uses `<span className="mdc-type type-…">`.
- `src/tools/memory/Vault.tsx:203` uses `<span className="chip-min type-…">`.
- `src/tools/memory/Vault.tsx:297` uses `<Tag className="type-…">`.
- `src/tools/memory/Vault.tsx:152` uses `<span className="tdot type-…">` with the text next to it.

Thus one data item has four forms. Each place repeats the colour token connection.

**Action.** Build `TypeBadge` in `src/tools/memory/components/`, next to `StatusPill`.
Give it a variant property with three values: dot, chip, and tag.
`StatusPill` is the example to copy. It already does this work for the status field.

**The status field has the same fault.**
`MemoryDetail.tsx:130` and `ClaimDetail.tsx:441-443` use `StatusPill`.
`Vault.tsx:204` shows the `{n.status}` string directly.
`Vault.tsx:301` shows a button group with the class `seg st-${st}`.
Change the Vault to `StatusPill` in the same pull request.

---

## 5. `.replaceAll("_", " ")` is a text operation outside the copy catalog

Ten places call this function:

- `Vault.tsx:152`, `Vault.tsx:203`, `Vault.tsx:297`
- `Review.tsx:641`, `Review.tsx:700`
- `ClaimDetail.tsx:239`
- `MemoryDetail.tsx:127`
- `MemoryTool.tsx:97`
- `model/relations.ts:30`
- `model/facets.ts:101`

Each place changes a machine value into English for a person.
Thus each place makes copy. The `src/copy/` system never sees this copy.

The risk is clear.
A change to a type name upstream changes the text at ten places.
No catalog entry changes. No check fails.

**Two options. This needs a decision.**

1. Add a `humanize()` function in `src/copy/`. The operation is then in one place.
2. Give each value a real catalog key. The text is then translatable and open to review.

Option 2 is more work. Option 2 agrees with the treatment of each other string in the console.
**[ask Luma first]**

---

## 6. Three screens build their own search field. `SearchBar` exists

`src/ui/SearchBar.tsx` has three users:
`Sources.tsx:170`, `Vault.tsx:139`, and `SearchDisclosure.tsx:68`.

These three screens build an `<input>` element instead:

- `src/tools/presets/PresetsTool.tsx:99`. It sits in a `.probe` and `.pwrap` container. That container repeats the match count that `SearchBar` gives.
- `src/tools/lorebooks/BookAudit.tsx:331`.
- `src/shell/palette.tsx:125`.

The palette is a possible exception.
A command palette field has different focus behaviour and different keyboard behaviour.
Thus treat the palette as a separate decision. Do not change it with the other two.

The match rules behind the fields are also different.
But the correction there is a library decision: uFuzzy for names and MiniSearch for text.
`BACKLOG.md` holds that work. It is not a component change.

---

## 7. The stylesheet migration is about one half complete

`src/ui/index.ts` gives the rule:
"Each component owns its own stylesheet, so deleting the component deletes its rules."

Twenty-four files obey the rule. Three files do not. The three files are large:

- `src/styles/memory.css` has 506 lines.
- `src/styles/presets.css` has 276 lines.
- `src/styles/lorebooks.css` has 264 lines.

`src/main.tsx:7-13` loads each of the three globally.
Thus nothing limits them. Nothing prevents their growth.
Item 3 is the first fault from this condition. It will not be the last fault.

**Action.** Add a check that the three global files can only decrease in size.
This stops the growth during the migration. It costs much less than the migration.
Do this first.

**A second fault in this group.**
`.toaster` belongs to the shell.
But its position rules are in `src/styles/lorebooks.css:252-256` and `src/styles/presets.css:255-256`.
Each file has its own `@media (min-width: 900px)` rule.
Thus the removal of one tool moves the toaster.
Those rules belong next to `src/shell/Toaster.tsx`.

---

## 8. The 900px value occurs in six places

- `src/ui/useIsDesktop.ts:20`
- `src/ui/Sheet.css:16`
- `src/styles/lorebooks.css:256`
- `src/styles/memory.css:204`
- `src/styles/presets.css:256`
- `src/styles/theme.css:90`, as the token `--breakpoint-split: 900px`

The token exists. No file uses it.

A CSS media query cannot use a `var()` value. This is the reason for the repetition.
But Tailwind v4 makes a `split:` variant from that token. The project already uses Tailwind.
The media queries can use that variant after the Tailwind work in `design/todo.md` is complete.
The value then has one definition.

**Action until then.** Add a comment at each place. The comment must name the token.
`index.html:8` already does this for `--canvas`.

---

## 9. Component exports with no external use

These exports have use inside their own file only. Remove the export or delete the code:

- `CollapseButton` at `src/ui/ListGroup.tsx:11`
- `FacetValue`, `FacetLine`, and `FacetGroup` at `src/ui/FacetDrawer.tsx:6,15,18`
- `PickerOption` at `src/ui/Picker.tsx:5`
- `DisclosureOption` at `src/ui/SearchDisclosure.tsx:9`

Examine each of the five types before you delete it.
An exported property type is sometimes intentional.
It lets another file build a value for the component.
Look at each use before you remove it.

**Two cautions.**

**Caution 1.** `scripts/deadexports.mjs` already reports each of the six items.
Its header at line 15 is clear: "Any import of the name from another file, TYPE IMPORTS INCLUDED".
Each of the six is already in `design/deadexports-baseline.json`.
Thus these are recorded decisions, not new discoveries.
This item removes the record. It does not find new code.

**Caution 2. Do not remove the export of `SheetHead`.**
A `knip` run with no configuration reports the line at `src/ui/index.ts:27` as unused.
That report is incorrect.
`.design-sync/previews/SheetHead.tsx:2` imports it as `from "marinara-console"`.
That name resolves through the design-sync tool, not through this repository.
Thus each line in the file looks unused from inside `src/`.
`scripts/deadexports.mjs:34-38` gives this exact warning. It excludes `src/ui/index.ts` for this reason.
The removal of that line breaks the preview.

---

## 10. Component counts

The command `node scripts/components.mjs` gives this result:

```
124 files · 202 functions return markup (103 components, 99 inline closures)
presentational 141 · store-bound 27 · domain 33 · violating 1
domain + violating: 34 of 202 — the ones props alone cannot move
```

The 34 domain functions are the limit on each item in this document.
Each of the 34 reads a store, the model, or the endpoint layer directly.
It does not get that data through a property.
Thus no property change lets two screens share such a function.

Twenty-two of the 34 are in three files:

- `src/tools/memory/ClaimDetail.tsx` has 9.
- `src/tools/memory/Review.tsx` has 6.
- `src/tools/memory/Vault.tsx` has 5.

Thus a component effort must start in those three files.

The one `violating` function is `Palette` at `src/shell/palette.tsx:85`.

`scripts/components.mjs` has 505 lines. No npm script calls it.
Only text in `design/` names it.
The tool is useful. This section is its output.
Thus add it to `package.json`. Do not delete it.
`todo/tooling-migration.md` holds that work.

---

## Order of work

1. Item 9 and the `rail-cell` part of item 3. These are small and separate. They have no risk.
2. Item 1, the shared `SaveBar`. It is complete in itself. It also corrects a live copy fault.
3. The size check in item 7. It is cheap. It stops the growth of the global stylesheets.
4. Item 4, `TypeBadge` and `StatusPill` in the Vault. It is small. It is practice for item 2.
5. Item 6, the `SearchBar` change. It is small.
6. Item 2, `ListRow`. Do one screen for each pull request. Use `domsnap` for each screen.
   This completes item 3. It also makes most of item 7 possible.
7. Item 5 and item 8 need a decision before a person can plan them.
