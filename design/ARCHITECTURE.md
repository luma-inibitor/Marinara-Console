# Marinara Console — Architecture

**Status: draft, actively iterating.** `DESIGN.md` is authoritative for how things look. This file is authoritative for where things live and what may import what. Nothing here is settled until the Open questions section is empty. When a question closes, move its answer up into the body and delete it from the list.

Companion to `DESIGN.md` (visual framework), `CHECKLIST.md` (pre-review gate), and `BRIEFING.md` (what the memory tool is for).

---

## 0. What problem this solves

The console has no layering problem at its edges and a real one in its middle.

- The backend is already separate and already small: the engine is the backend, and `server.mjs` is a dependency-free proxy that owns the console's own state under `/console/state/:key`.
- Inside `src/`, four things were tangled. Three are now resolved, and the fourth is narrowed:
  - `store.ts` did six jobs—state, derived selectors, persistence I/O, the decision ledger, load orchestration, preflight, and apply. Each now has its own module under `store/`.
  - `data.ts` mixed wire types and endpoint functions with domain transforms. It is gone: routes and wire shapes live in `api/`, transforms in `model/`.
  - Screens called the API directly, so there was no data boundary. None do now: the status record, the scope picker's names, re-extraction, the restore-point URL and the decision ledger's own persistence all sit in the layer that owns them, and `scripts/layercheck.mjs` RULE 2 fails the build if one comes back.
  - Notes had two owners, so two copies of the same record could disagree. `store/notes.ts` is now the only writer.

A framework migration would have replaced the layer that was already clean and left all four untouched. This document was the alternative, and the work is most of the way through it.

## 1. The layers

Five roles. A file belongs to exactly one.

| Role | Knows about | May not |
|---|---|---|
| **transport** | HTTP, the proxy | the domain |
| **endpoints** | routes, wire types | transforms, stores, React |
| **model** | the domain, as pure functions | React, `fetch`, stores |
| **state** | stores, orchestration, invalidation | JSX |
| **presentation** | JSX, tokens, copy | `fetch` |

### State: two kinds of store, and who may write to them

A **component** is a function that returns markup, and React runs it again from the top every time something changes. A **hook** is how a component remembers something across those runs, or plugs into something outside itself. `useState` remembers a value that belongs to one component and dies with it. A **store** is a value that lives in a module instead of inside a component, so any file can read it and it outlives any screen. `useStore(s)` is the hook that joins the two: it reads a store and re-runs the component whenever the store changes. `lib/store.ts` deliberately offers no `.value`, so every read has to say whether it's subscribing.

Not all stores carry the same weight, and the difference decides who may write to one.

**View state** is what a screen looks like at this moment: how the list is sorted, which row is focused, which sheet is open. Nothing else has to happen when it changes. It sits in a store rather than in `useState` only so that it outlives the screen—Review's sort survives a trip to Sources and the Vault's doesn't, because one is a store and the other is `useState`. **A screen may write its own view state directly.**

**Entity state** is the records themselves: the memories, the review queue, the keep/drop ledger. Changing one of these has to do more than change a value: it has to reach the server, recompute the derived figures, and update anything still showing the old copy. **Only the module that owns entity state writes it, through named actions.**

The console already works this way by habit rather than by rule. No component calls `decisions.set()`, because a decision has to be persisted and re-preflighted, so it goes through `setDecision()`. Notes are the counterexample and the bug in §3: no single module owns them, so two screens each keep a copy.

The rule is about what a store holds, not how it's reached. Stores stay exported, and `layercheck.mjs` flags a write to an entity store from a `.tsx` file—a far more useful check than banning store exports outright, which would only add one-line wrappers around the writes that were never the problem.

### The dependency rule

Imports point **downward only**:

    presentation → state → endpoints → transport
    presentation → model
    state        → model

Two directions are always wrong:

- **`model` importing `state`** risks a cycle. This has already happened here: the scope predicate needed the scope stores, so we moved the stores down beside the predicate rather than importing upward.
- **presentation importing `endpoints`** means a screen bypassed the data layer. `layercheck.mjs` RULE 2 checks this directly, because the direction rule cannot see it: presentation importing `api/` is *downward*, so it passes rule 1 while still being the violation named here. It is at zero and enforced.

**Type-only imports are exempt, and point anywhere.** The wire types live in `api/` because they describe the wire — that is the endpoints layer's own vocabulary. The model has to name those shapes to transform them, which is an upward import by the rule above. It is allowed, because `import type` erases at compile time: it creates no runtime edge and therefore no cycle. `layercheck.mjs` checks value imports and ignores type-only ones.

This is the one exemption, and it is deliberately narrow: a value import pointing upward still fails, whatever it carries.

The exemption is narrow enough to have caught something. `SECTION_CAP` and `KEYWORD_CAP` were sitting in `api/types.ts` and imported as values by the model, which the rule forbids — and no module in `api/` read them, because a payload does not carry a cap. They are rules about what a note may hold, so they live in `model/caps.ts`. Every remaining model import from `api/` is type-only.

## 2. Layout

**The directory carries the layer.** Not a filename suffix: a suffix scheme has to declare `*.ts` to mean "model", which makes purity the *default* — every file that forgets to opt in is silently claimed by the model layer, including files that are nothing of the kind. A directory can't be forgotten, reads correctly in any file tree, and gives `layercheck.mjs` a fact to check instead of an absence.

| Directory | Layer | Holds |
|---|---|---|
| `api/` | endpoints | one module per route family; wire types only |
| `model/` | model | pure functions; no React, no `fetch`, no stores |
| `store/` | state | stores, orchestration, invalidation; no JSX |
| `components/` | presentation | this tool's components |
| `screens/` | presentation | the things a route mounts |
| `test/` | — | factories and recorded payloads, not tests |

Tests stay **beside the module they cover**, inside its layer directory: `model/pressure.test.ts` sits next to `model/pressure.ts`. Deleting a module deletes its test. `test/` holds only shared fixtures.

The **filename carries the concept**. `model/pressure.ts` is the one cap computation; `ui/SectionKey.tsx` is the one `§key` renderer. The twelve duplicated renderings in the surface census each collapse into one named file — what makes the duplication go away is that a concept has exactly one module, not that the concept owns a folder.

```
src/
  main.tsx
  lib/                      primitives with no domain knowledge
    store.ts
    vendor/                 vendored engine code, never edited
  copy/                     the catalog (unchanged)
  styles/                   tokens + one sheet per tool (unchanged)
  shell/                    app frame: router, overlays, toast, palette, transport
                            api.ts is the engine proxy; state.ts is the console's own state
  ui/                       shared presentational, domain-unaware, cross-tool
    SectionKey.tsx          the one `§key` renderer
  tools/
    memory/
      api/
        notes.ts            /notes, /notes/:id
        drafts.ts           review, preflight, accept, skip
        import.ts           preview, source-notes
        backup.ts
        status.ts
        chats.ts            the host's chats
        characters.ts       the host's characters
        ledger.ts           the review ledger, in console state
      model/
        note.ts             shape, status, id
        character.ts        the card's name
        character.test.ts
        section.ts          lines, meta, cap flag
        section.test.ts
        pressure.ts         THE cap computation
        pressure.test.ts
        flags.ts
        flags.test.ts
        derived.ts
        derived.test.ts
        diff.ts
        diff.test.ts
        facets.ts
        relations.ts        relation → English, via the catalog
        scope.ts            predicates
        scope.test.ts
        review.ts           flatten
        sources.ts
      store/
        notes.ts            THE owner of notes
        review.ts           THE owner of the queue
        decisions.ts        the keep/drop ledger
        scope.ts            the two scope stores, and the names to pick from
        status.ts           THE owner of engine health
        backup.ts           where a screen reads the restore point
      components/
        NoteRef.tsx         the one link-target renderer
        StatusPill.tsx
        TypeName.tsx
        SectionBody.tsx
        KeywordList.tsx
        KeywordEditor.tsx
        LinkList.tsx
        CapPressure.tsx
        ScopeBar.tsx
        ClaimDetail.tsx
      screens/
        Vault.tsx
        Review.tsx
        Sources.tsx
        MemoryTool.tsx
      detail/               the memory detail card (deferred, open question 2)
      test/
        factories.ts
        setup.ts
```

Two names sit next to each other and mean different things on purpose: `src/ui/` is shared across tools and knows nothing about memories; `tools/memory/components/` is this tool's and knows everything about them. Promotion from the second to the first is the rule in §3.

`SectionKey` sits in `ui/` rather than in `components/`, against the listing this file first drew, because `ui/DetailSection` is one of its three callers and `ui/` may not import a tool. The line the split actually follows is what a component has to know: a `§key` is a string with a mark in front of it, while a `NoteRef` has to reach the notes store and open a peek. Anything that needs the domain stays in the tool.

The cost of layer-first: seeing everything about "sections" means looking in three directories rather than one. That is what filenames and grep are for, and it buys a property that matters more — you can tell what a file is allowed to do from where it sits, before opening it.

## 3. Rules

- **One owner per entity.** Exactly one module fetches, holds, and invalidates a record type; everyone else subscribes. Notes were the counterexample—`Vault.tsx` held its own list *and* wrote into `notesById`, so a save could refresh one copy and leave the other stale. Fixing the layering fixed the staleness, because they were the same bug.
- **No component calls `fetch`.** A screen gets data by calling a hook.
- **One concept, one renderer.** Exactly one component draws a field. A second rendering of the same field is a bug, not a variant.
- **No `utils/`.** Every module is named after a noun in the product. A module you can't name that way doesn't have a home yet.
- **Domain logic never lives in a component file.** If you can test it without a DOM, it belongs in `model/`.
- **Promote on the second consumer.** Shared within a tool stays in the tool; shared across tools moves to `ui/`.
- **Engine logic stays vendored.** Never reimplement keyword matching or token estimates.

## 4. Tests

- **Vitest, co-located.** `model/scope.test.ts` sits beside `model/scope.ts`. Deleting a module deletes its test.
- **Unit tests cover model files and nothing else.** Pure functions need no DOM and no fixtures.
- **Characterization before consolidation.** A duplicated computation gets tests covering *every* current copy before they become one, so the merge is provably behavior-preserving. Cap pressure has three copies that disagree—strict versus non-strict comparison, projected versus current chars—and the tests are how that disagreement became visible rather than discovered later.
- **Assert catalog keys, not English.** A test that asserts a rendered sentence breaks on any copy rewording. Tests stub `t()` to return `key|param=value`; `copycheck.mjs` guards the copy itself.
- **No jsdom.** `domsnap.mjs` renders the real app in real Chromium at real breakpoints. A second, weaker rendering environment would buy worse signal.
- **The browser checks are the UI suite.** `verify.mjs`, `overlaycheck.mjs`, `domsnap.mjs`, and `copycheck.mjs` already assert against a real render. They keep their jobs, and we call them tests.
- **`npm test` runs both.** It says plainly when the browser half needs the app running.

## 5. Enforcement

The house habit is to encode a rule in a script rather than trust a convention—`copycheck` for copy, `deadcss` for CSS, `overlaycheck` for dismissal.

- **`scripts/layercheck.mjs`** carries two rules, and both fail the build. RULE 1 reads every import and fails when a *value* import points upward; type-only imports are exempt, per §1. The directory gives it the layer without a manifest to maintain, and without a default that silently claims files nobody classified. RULE 2 checks the ownership rule rule 1 cannot express — a component reaching the endpoints layer, the transport client, or the global `fetch`. It reported without failing while the pre-rule screens were being moved onto hooks, because a check that goes red on day one and stays red teaches people to ignore it; that baseline is spent, the count is zero, and the `--strict` flag is gone with it.
- **`scripts/deadexports.mjs`** finds symbols exported but used only where they are declared. Informational, never fails — over-exporting makes a module's real surface unreadable, but the list is for triage rather than enforcement.

A module in no layer directory is **unchecked**, which is a gap rather than a pass. `layercheck` prints those under `UNCLASSIFIED` rather than defaulting them into a layer, for the same reason §2 rejects the filename-suffix scheme.

---

## Open questions

1. **Where do screens live** once a tool has many? `screens/` reads well at four; the question is whether a tool with fifteen wants grouping inside it.
2. **Does `detail/` survive** as a screen family, or dissolve into `model/`, `components/`, and `screens/`? Deliberately deferred until the design direction for the memory detail card settles—the layout should follow that decision rather than force it.
3. **Do the other two tools follow**, and when? Memory proves the shape first.

### Settled

- **`ui/` keeps its name.** It names a role—shared, domain-unaware—which is the useful thing to know about that directory. A tool's own components live in the tool, under `components/`.
- **The layer is a directory, not a filename suffix.** A suffix scheme needs `*.ts` to mean "model", making purity the default for any unclassified file.
- **`api/` is a directory**, one module per route family.
- **Memory first.** Lorebooks and presets follow once the shape holds.
