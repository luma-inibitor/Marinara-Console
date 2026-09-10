# Marinara Console — Architecture

**Status: draft, under active revision.** `DESIGN.md` decides how things look. This file decides where things live and what may import what. The Open questions section at the end lists what this file doesn't yet decide. Closing one of those questions means moving its answer into the body and deleting the question.

Companion documents: `DESIGN.md` for the visual framework, `CHECKLIST.md` for the pre-review gate, and `BRIEFING.md` for what the memory tool is for.

---

## 0. What problem this solves

The console had no layering problem at its edges and a real one in its middle.

The backend stays separate, because the Marinara Engine is the backend and the console adds nothing to it. `server.mjs` runs three jobs on top of `node:http`. It serves the built client and the design mockups through `sirv`, sending the `.br` or `.gz` file `scripts/precompress.mjs` wrote beside an asset when the request accepts that encoding. It forwards `/api/*` to the engine through `http-proxy-middleware`. On the way out it adds the headers the engine's cross-site request forgery check wants. On the way back it strips every `embedding` array out of the reply, so a large payload doesn't cross the wire twice. It also owns the console's own small JSON documents under `/console/state/:key`, which is where the review ledger lives.

Inside `src/`, four things tangled together. The memory tool resolves three of them outright. It resolves the fourth all but one write. The other two tools don't follow yet.

- `store.ts` carried seven jobs at once: state, derived selectors, persistence, the decision ledger, load orchestration, preflight, and apply. Each job now has its own module under `store/`, so a reader looking for one of them opens one file.
- `data.ts` mixed wire types and endpoint functions with domain transforms. The memory tool no longer has one. Routes and wire shapes live in `api/`, and transforms live in `model/`. The lorebooks and presets tools still keep a `data.ts` each, and those two files are the remaining instances of the old shape.
- Screens called the API directly, so there was no data boundary. No memory screen does now, and `scripts/layercheck.mjs` rule 2 fails the build if one starts again.
- Notes had two owners, so two copies of the same record could disagree. `store/notes.ts` is the owner today, and §3 records the one place that still writes past it.

A framework migration would replace the layer that was already clean and leave all four tangles in place. This document took the other route, and most of the work behind it now stands complete.

## 1. The layers

There are five roles, and a file belongs to exactly one of them.

| Role | Knows about | May not |
|---|---|---|
| **transport** | HTTP, the proxy | the domain |
| **endpoints** | routes, wire types, wire validation | transforms, stores, React |
| **model** | the domain, as pure functions | React, `fetch`, stores |
| **state** | stores, orchestration, invalidation | JSX |
| **presentation** | JSX, tokens, copy | `fetch` |

### State: Two kinds of store, and who may write to them

A **component** is a function that returns markup, and React runs it again from the top whenever something changes. A **hook** is how a component remembers something across those runs, or plugs into something outside itself. `useState` remembers a value that belongs to one component and dies with it. A **store** is a value that lives in a module rather than inside a component, so any file can read it and it outlives any screen. `useStore(s)` is the hook that joins the two, because it reads a store and re-runs the component whenever that store changes. `src/lib/store.ts` offers no `.value` on purpose, so every read has to say whether it subscribes.

Stores don't all carry the same weight, and the difference decides who may write to one.

**View state** is what a screen looks like at this moment: how the list sorts, which row holds the cursor, which sheet stands open. Nothing else has to happen when it changes. It sits in a store rather than in `useState` only so that it outlives the screen. Review's sort survives a trip to Sources and the Vault's sort doesn't, because `store/view.ts` holds the first and a `useState` in `Vault.tsx` holds the second. **A screen may write its own view state directly.**

**Entity state** is the records themselves: the memories, the review queue, and the keep and drop ledger. Changing one of these has to do more than change a value. It has to reach the server, recompute the derived figures, and update anything still showing the old copy. **Only the module that owns entity state writes it, through named actions.**

The console follows this by habit rather than by rule. No component calls `decisions.set()`, because a decision has to reach the server and run through preflight again, so every caller goes through `setDecision()` and its neighbours in `store/decisions.ts`.

Nothing enforces the rule, because the rule is about what a store holds rather than about how a caller reaches it. Stores stay exported, `layercheck.mjs` reads the import graph, and `notes.set()` inside a `.tsx` file is a call rather than an import. A reviewer is the only check on this until a script exists for it.

### Why `store/` is acyclic

`derived()` computes **eagerly at construction**, and several modules under `store/` install subscriptions at module scope. Together those two facts make an import cycle inside `store/` fatal rather than untidy. The cycle reads a `const` before the line that defines it runs, so the app throws at import time instead of misbehaving later.

The edges inside `store/` are one-way, and today they run in four ranks:

- `decisions.ts`, `notes.ts`, `scope.ts`, `status.ts`, `view.ts` and `backup.ts` import nothing else from `store/`.
- `sources.ts` reads `notes.ts` and `scope.ts`. `review.ts` reads `scope.ts`, `notes.ts`, `view.ts`, `decisions.ts` and `sources.ts`.
- `preflight.ts` reads `decisions.ts` and `review.ts`.
- `pressure.ts`, `tally.ts` and `apply.ts` sit at the end. Each of the three reads `decisions.ts` and `review.ts`. `pressure.ts` and `tally.ts` also read `notes.ts`. `tally.ts` and `apply.ts` also read `preflight.ts`. No module under `store/` reads any of the three.

A module in that last rank reaches entity state through its owner's named actions rather than by writing the owner's stores.

The same eagerness sets a second trap. A subscription-driven store tracks its inputs only while something imports it, because the module scope that installs the subscription runs only on import. Drop the last importer and the tracking stops with no type error to show for it.

Files under `store/` point back at this section rather than restating it.

### The dependency rule

Imports point **downward only**:

    presentation → state → endpoints → transport
    presentation → model
    state        → model

Two directions are always wrong.

**`model` importing `state`** risks a cycle. The scope work is the case that made this concrete. `model/scope.ts` holds the predicate that decides whether a memory belongs to the current scope. `store/scope.ts` holds the stores that say what the current scope is. `store/review.ts` sits in the state layer and joins the two. The predicate never reaches upward for the stores, and the caller in the state layer supplies them.

**presentation importing `endpoints`** means a screen bypassed the data layer. `layercheck.mjs` rule 2 checks this directly, because the direction rule can't see it. Presentation importing `api/` points *downward*, so it passes rule 1 while still being the violation named here. The count is zero today and the check fails the build.

**Type-only imports are exempt, and may point anywhere.** The wire types live in `api/` because they describe the wire, which is the endpoints layer's own vocabulary. The model has to name those shapes to transform them, and naming them makes an upward import by the rule stated earlier. The exemption permits that import, because a type import erases at compile time and therefore creates no runtime edge and no cycle. `layercheck.mjs` asks the TypeScript checker what each specifier binds. Only the specifiers that resolve to a value count, so the answer comes from the compiler rather than from a reading of the syntax. `verbatimModuleSyntax` (`tsconfig.json:16`) keeps the two in step, because it makes the compiler enforce the marking.

This is the one exemption, and it stays narrow on purpose. A value import pointing upward still fails, whatever it carries.

The exemption was narrow enough to catch something. `SECTION_CAP` and `KEYWORD_CAP` sat in `api/types.ts` and the model imported them as values, which the rule forbids. No module in `api/` read either one, because a payload doesn't carry a cap. Both are rules about what a note may hold, so they moved to `model/caps.ts`. Every model import from `api/` is type-only today.

## 2. Layout

**The directory carries the layer**, not a filename suffix. A suffix scheme has to declare `*.ts` to mean "model," which makes purity the *default*. Every file that forgets to opt in gets claimed by the model layer, including files that are nothing of the kind. Nobody can forget a directory. A directory also reads correctly in any file tree, and it gives `layercheck.mjs` a fact to check rather than an absence.

The directories that carry a layer today:

| Directory | Layer | Holds |
|---|---|---|
| `api/` | endpoints | one module per route family, the wire types, and the schemas that check them |
| `model/` | model | pure functions, with no React, no `fetch` and no stores |
| `store/` | state | stores, orchestration and invalidation, with no JSX |
| `components/` | presentation | this tool's own components |
| `screens/` | presentation | a tool's screens, in a tool that has the directory |

`layercheck.mjs` decides a file's layer in five steps, and the order of those steps matters.

1. A path containing `lib`, `copy`, `test` or `vendor` as a directory name is exempt, and rule 1 skips it entirely. This step runs before the table, so `model/test/helper.ts` is exempt rather than model.
2. A path containing one of the table's directories takes that directory's layer, and the first such directory in the path wins.
3. Anything under `src/ui/` counts as presentation.
4. Any remaining `.tsx` file counts as presentation wherever it sits. This is how the memory tool's loose screens at `src/tools/memory/*.tsx` get classified at all.
5. Any remaining file under `src/shell/` counts as transport.

Step 4 runs before step 5, so `src/shell/api.ts` is transport while `src/shell/App.tsx` is presentation, and `layercheck` prints `src/shell` as a mixed directory for that reason. No tool has a `screens/` directory today, and step 2 classifies one as presentation the moment a tool grows it. A `.ts` file that reaches the end of the list falls through to **unclassified**, and §5 says what that costs.

Tests stay **beside the module they cover**, inside its layer directory. `model/pressure.test.ts` sits next to `model/pressure.ts`, so deleting a module deletes its test. A tool's `test/` directory holds only shared fixtures and the Vitest setup file.

The **filename carries the concept**. `model/pressure.ts` is the one cap computation, and `ui/SectionKey.tsx` is the one `§key` renderer. What makes a duplicated rendering go away is that a concept gets exactly one module, not that the concept gets a folder of its own.

The tree as it stands, abbreviated. It omits every `.css` file. It omits every `.test.ts` file, because a test sits beside the module it covers. It omits `src/lib/lorebook-keyword-matching.d.ts`. It collapses `copy/`, `styles/`, `shell/`, `lorebooks/` and `presets/` to one line each. `src/ui/` holds twenty-nine TypeScript files and the block names two of them, because the rule for that directory is the same for all twenty-nine.

```
src/
  main.tsx
  lib/                      primitives with no domain knowledge
    store.ts                first-party: createStore, derived, useStore
    lorebook-keyword-matching.js   vendored engine code, never edited
    regex-safety.js                vendored engine code, never edited
  copy/                     the catalog, including the vendored ltm-en.json
  styles/                   tokens, theme, base and shell, plus one per tool
  shell/                    app frame: router, overlays, toast, palette,
                            hotkeys, connection, draft buffer, transport.
                            api.ts is the engine client; state.ts reads and
                            writes the console's own state; wire.ts validates
                            a reply before the app believes it
  ui/                       shared presentational, domain-unaware, cross-tool
    SectionKey.tsx          the one `§key` renderer
    index.ts                the barrel
  tools/
    memory/
      api/
        routes.ts           the one engine path constant
        types.ts            the shapes the engine puts on the wire
        schema.ts           the validators types.ts infers from
        notes.ts            /notes, /notes/:id
        drafts.ts           review, preflight, accept, skip
        import.ts           preview, source-notes
        backup.ts
        status.ts
        chats.ts            the host's chats
        characters.ts       the host's characters
        ledger.ts           the review ledger, in console state
      model/
        caps.ts             the section and keyword limits
        character.ts        the card's name
        dependencies.ts     a kept claim whose target was dropped
        derived.ts          signals no payload carries
        diff.ts             the update preview's line diff
        facets.ts
        flags.ts
        keywords.ts         the three keyword arrays, and which one counts
        listing.ts          what the vault's default list is made of
        pressure.ts         the one cap computation
        relations.ts        relation to English, via the catalog
        review.ts           flatten
        scope.ts            predicates
        sources.ts
        tally.ts            the two figures the review surface quotes back
      store/
        notes.ts            the owner of notes
        review.ts           the owner of the queue
        decisions.ts        the keep and drop ledger
        preflight.ts
        apply.ts
        pressure.ts
        tally.ts
        scope.ts            the two scope stores, and the names to pick from
        sources.ts
        status.ts           the owner of engine health
        backup.ts           where a screen reads the restore point
        view.ts             the review surface's view state
      components/
        NoteRef.tsx         the one link-target renderer
        StatusPill.tsx
      detail/               the memory detail card
        MemoryDetail.tsx
        RetrievalCard.tsx
        SectionRow.tsx
        model.ts
      review/               sheets belonging to the review surface
        DockSheet.tsx
        FilterSheet.tsx
        ViewSheet.tsx
      MemoryTool.tsx        the tool shell, which mounts the three screens
      Vault.tsx             below. Those three and the tool's own components
      Review.tsx            still sit loose at the tool root
      Sources.tsx
      ClaimDetail.tsx
      ScopeBar.tsx
      Copy.tsx
      glossary.tsx
      icons.tsx
      test/
        factories.ts
        setup.ts
    lorebooks/              unlayered: data.ts plus four .tsx files
    presets/                unlayered: data.ts plus one .tsx file
```

Two names sit next to each other and mean different things on purpose. Every tool shares `src/ui/`, which knows nothing about memories. `tools/memory/components/` belongs to this tool and knows everything about them. Promotion from the second to the first is the rule in §3.

`SectionKey` sits in `ui/` rather than in `components/`, which contradicts the listing this file first drew. It sits there because `ui/DetailSection` is one of its three callers and `ui/` may not import a tool. The line the split follows is what a component has to know. A `§key` is a string with a mark in front of it, while a `NoteRef` has to reach the notes store and open a peek. Anything that needs the domain stays in the tool.

Layer-first layout costs something. Seeing everything about "sections" means looking in three directories rather than one. Filenames and grep cover that, and the layout buys a property worth more: you can tell what a file may do from where it sits, before opening it.

## 3. Rules

Some of these have a script behind them and some don't. Each rule says which, because a rule that reads as enforced and isn't is worse than no rule at all.

- **One owner per entity.** Exactly one module fetches, holds and invalidates a record type, and everyone else subscribes. Notes were the counterexample, because `Vault.tsx` held its own list and also wrote into `notesById`, so a save could refresh one copy and leave the other stale. Fixing the layering fixed the staleness, because both were the same bug. One deviation survives: `store/review.ts` writes `notesById` and `lines` directly during its own load, rather than calling an action in `store/notes.ts`. It's inside the state layer, so no script objects, and it's on the list to fold into an owner action. *Not enforced.*
- **No component calls `fetch`.** A screen gets data by calling a hook. *Enforced twice over. `layercheck.mjs` rule 2 fails on the global `fetch` outside `src/shell/`, on presentation importing an `api/` directory, and on presentation importing the request function from `src/shell/api.ts`. Two rules in `eslint.config.js` cover the same ground on their own. `no-restricted-globals` bans the `fetch` global everywhere but `src/shell/`. `no-restricted-imports` bans the `api` and default bindings of `**/shell/api`. It covers every `.tsx` file under `src/`, plus every `.ts` file under a `src/**/components/` or `src/**/screens/` directory. Its `ignores` entry turns it off for `src/shell/`, so the five `.tsx` files there are exempt like the rest of the transport layer. §5 records the spelling every one of them misses.*
- **One concept, one renderer.** Exactly one component draws a field, and a second rendering of the same field is a bug rather than a variant. `scripts/components.mjs` inventories every component and what each one reaches past its props for. That script always exits 0. *Not enforced.*
- **No `utils/`.** Every module takes its name from a noun in the product. A module you can't name that way doesn't have a home yet. *Not enforced, and there is no `utils/` in the tree today.*
- **Domain logic never lives in a component file.** Anything you can test without a DOM belongs in `model/`. *Not enforced.*
- **Promote on the second consumer.** Shared within a tool stays in the tool, and shared across tools moves to `ui/`. *Not enforced.*
- **Engine logic stays vendored.** Never reimplement keyword matching or token estimates. `src/lib/lorebook-keyword-matching.js` and `src/lib/regex-safety.js` are the vendored copies. *Not enforced.*

## 4. Tests

- **Vitest, co-located.** `model/scope.test.ts` sits beside `model/scope.ts`, so deleting a module deletes its test.
- **Unit tests reach past the model layer.** The model files carry most of them, because pure functions need no DOM and no fixtures. There are also tests beside `store/notes.ts`, `store/scope.ts`, `api/schema.ts`, `shell/toast.ts`, `shell/wire.ts` and `ui/MiddleTruncate.tsx`, and each one runs in the node environment like the rest. `vitest.config.ts` collects `src/**/*.test.ts`, `scripts/**/*.test.mjs` and `test/**/*.test.mjs`, so the check scripts and the server conformance suite run in the same command.
- **Characterization before consolidation.** A duplicated computation gets tests covering *every* current copy before the copies become one, so the merge is provably behavior-preserving. Cap pressure is the worked example. It had three copies that disagreed about strict versus non-strict comparison and about projected versus current characters. The tests made that disagreement visible, and `model/pressure.ts` is the single copy that came out.
- **Assert catalog keys, not English.** A test that asserts a rendered sentence breaks on any rewording of the copy. Tests stub `t()` to return `key|param=value`. The eslint copy rules guard the call sites, and `copycatalog.mjs` guards the catalog entries.
- **No jsdom.** `domsnap.mjs` renders the real app in real Chromium at real breakpoints. A second, weaker rendering environment would buy worse signal.
- **The browser checks are the UI suite.** `domsnap.mjs` and the Playwright specs under `tests/e2e/` drive a real browser. `npm run domsnap` runs the first, and `npm run test:e2e` runs the specs. One of those files checks no render at all. `tests/e2e/corpus.spec.ts` parses the fixture corpus with the app's own schemas and opens no page, and `playwright.config.ts` gives its project no browser.
- **`npm test` is Vitest alone.** The browser suite drives a real Chromium, which CI installs in a step of its own, so it runs as a separate job rather than inside `npm run check`. Playwright needs nothing running first, because the `webServer` block in `playwright.config.ts` builds the bundle and previews it. `domsnap.mjs` is the one that needs an app already served: it reads `MC_DEV_URL`. `npm run check` runs the static checks, then Vitest, then the build.

## 5. Enforcement

The house habit is to encode a rule in a script rather than to trust a convention. `copycatalog` guards the copy catalog, `deadcss` guards CSS, `layercheck` guards the dependency direction. `scripts/checks.mjs` lists the static checks one name per line, and `npm run check:static` runs every one of them rather than stopping at the first failure.

**Prettier owns whitespace in `.ts`, `.tsx`, `.mjs` and the hand-written config files.** `eslint.config.js` extends no stylistic preset by design, so nothing read whitespace in the application code before this. `format:check` fails the build. `npm run format` fixes every finding.

**The pre-commit hook in `.githooks/` formats staged files.** `scripts/prepare.mjs` points `core.hooksPath` at that directory, and npm runs `prepare` after an install, so the hook arrives with a clone rather than with an instruction. `scripts/precommit.mjs` holds the logic, which keeps it linted and type-checked like the rest of `scripts/`. It formats a staged file and re-stages it. It refuses to touch an unformatted file that also carries worktree edits, because `git add` on that file would commit the unstaged half. Staged Markdown goes through `prosecheck`. The hook stops on every finding, not on the error-level ones alone. The CI prose job stays advisory, so the hook is the one place a suggestion still gets read.

`.prettierignore` holds Prettier back from four things. stylelint owns CSS, where Prettier gives each row of a hand-aligned token table three lines. Vale owns Markdown, where Prettier rewrites the emphasis marks to no rendered effect. The vendored engine sources keep the engine's formatting, which leaves a re-vendor a clean diff. The generated `design/*-baseline.json` files keep theirs, since the next generator run would undo the change and fail the check.

**`scripts/layercheck.mjs`** carries two rules, and both fail the build. It reads the tree through the TypeScript compiler, using `typescript/unstable/ast` and `typescript/unstable/sync`. Module resolution and the value-or-type answer are therefore the ones `tsc` would give.

Rule 1 reads every import and fails when a *value* import points upward. Type-only imports are exempt, per §1. The directory gives the check its layer with no manifest to maintain and no default that claims files nobody classified.

Rule 2 checks the ownership rule that rule 1 can't express. It fails on three things. The first is a presentation file importing from an `api/` directory. The second is a presentation file importing `api`, the default binding, or `* as` anything from `src/shell/api.ts`. The third is the global `fetch` as a free identifier anywhere outside `src/shell/`. The `fetch` half runs on every file whatever its layer, including the unclassified ones. Rule 2 reported without failing while the older screens moved onto hooks, because a check that goes red on day one and stays red teaches people to ignore it. That baseline expired, the count sits at zero, and the `--strict` flag went with it.

One gap in rule 1 stays open today. `resolveModule` returns null for any target whose path relative to the repository root starts with `..`, alongside the deliberate null it returns for `node_modules`. Rule 1 skips every edge that resolves to null. Point the check at a tree outside the repository root and every import leaves the root to reach its target. The run then reports "every value import points downward" over zero resolved edges. `node scripts/layercheck.mjs /tmp/scratch` on a model file importing a store prints `0 value imports resolved to a layer` and exits 0. The fixtures under `scripts/fixtures/layercheck/` sit inside the root, so the test suite never sees this. The gap leaves the repository's own `src/` alone. A scratch tree outside the root therefore gets no layer checking at all.

A second thing rule 1 doesn't cover has the same cause. A bare specifier resolves into `node_modules`, and `resolveModule` returns null for that too. The model layer's ban on React therefore has no check behind it, because `import { useState } from "react"` inside a model file resolves to no layer. The model layer's ban on `fetch` survives only because rule 2 catches the free identifier without help from rule 1.

Rule 2 has a gap of its own, and it's the one gap that weakens a rule §3 marks as enforced. Rule 2 counts `fetch` only as a free identifier, because `isMemberName` skips any `fetch` whose parent is a property access. That skip keeps `client.fetch` out of the results, and the test before it already rejects `opts.refetch()` on the identifier text. `window.fetch("/api/x")` is a property access too, so a component that writes it that way produces no finding. The `no-restricted-globals` rule in `eslint.config.js` doesn't close the gap either, because it matches the bare global and a member access isn't one. A presentation file holding `await window.fetch("/api/x")` passes both checks and exits 0. The import half of rule 2 matches spellings too. `isTransportClient` accepts an edge only when a bound name is `api`, `default`, or a `* as ` binding. A dynamic `import("../shell/api")` whose result nobody destructures records the name `*`, so it passes.

**knip** finds symbols that a module exports but nothing imports, dead re-exports included. It replaced a bespoke script in wave 3. An export that must stay without an importer carries `/** @public */`, which knip reads as a claim of intent. To list every one, run `grep -rn '@public' src scripts`. `deadcss` keeps the older arrangement: `design/deadcss-baseline.json` records today's set and a finding outside it exits 1. Both run in `npm run check`, and a clean pull request never sees either. Shrinking a baseline is an ordinary diff, and growing one takes `--adopt` plus a line in the pull request body.

A module in no layer directory goes **unchecked**, which counts as a gap rather than a pass. `layercheck` prints those under `UNCLASSIFIED` rather than defaulting them into a layer, for the same reason §2 rejects the filename-suffix scheme. Three files are there today: `src/tools/lorebooks/data.ts`, `src/tools/presets/data.ts` and `src/tools/memory/detail/model.ts`.

---

## Open questions

1. **Where do screens live.** The memory tool's three screens still sit loose at the tool root beside its components, and no tool has a `screens/` directory. `layercheck.mjs` already classifies one as presentation, so the cost of growing the directory is a move rather than a script change. The question is whether a tool wants one once it has more than a handful, and whether a tool with fifteen wants grouping inside that.
2. **Does `detail/` stay a directory of its own?** It holds three components and a `model.ts` that no layer directory classifies. One alternative dissolves it into `model/`, `components/` and the screen root. The other keeps the directory and moves `model.ts` down into `model/`. The same question applies to `review/`, which holds three sheets.
3. **Do the other two tools follow, and when?** Lorebooks and presets each still keep a `data.ts` and their components at the tool root. Memory proves the shape first.

### Decided

- **`ui/` keeps its name.** It names a role, shared and domain-unaware, which is the useful thing to know about that directory. A tool's own components live in the tool, under `components/`.
- **The layer is a directory, not a filename suffix.** A suffix scheme needs `*.ts` to mean "model," which makes purity the default for any unclassified file.
- **`api/` is a directory**, one module per route family.
- **Memory first.** Lorebooks and presets follow once the shape holds.
