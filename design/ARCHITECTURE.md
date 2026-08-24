# Marinara Console — Architecture

**Status: draft, actively iterating.** `DESIGN.md` is authoritative for how things
look. This file is authoritative for where things live and what may import what.
Nothing here is settled until the Open questions section is empty. When a
question closes, move its answer up into the body and delete it from the list.

Companion to `DESIGN.md` (visual framework), `CHECKLIST.md` (pre-review gate),
and `BRIEFING.md` (what the memory tool is for).

---

## 0. What problem this solves

The console has no layering problem at its edges and a real one in its middle.

- The backend is already separate and already small: the engine is the backend,
  and `server.mjs` is a dependency-free proxy that owns the console's own state
  under `/console/state/:key`.
- Inside `src/`, four things are tangled:
  - `store.ts` does six jobs—state, derived selectors, persistence I/O, the
    decision ledger, load orchestration, preflight, and apply.
  - `data.ts` mixes wire types and endpoint functions with domain transforms
    (`flattenReview`, `computePressure`, section additivity).
  - Three screens call the API directly, so there is no data boundary.
  - Notes have two owners, so two copies of the same record can disagree.

A framework migration would replace the layer that's already clean and leave all
four untouched. This document is the alternative.

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

A **component** is a function that returns markup, and React runs it again from
the top every time something changes. A **hook** is how a component remembers
something across those runs, or plugs into something outside itself. `useState`
remembers a value that belongs to one component and dies with it. A **store** is
a value that lives in a module instead of inside a component, so any file can
read it and it outlives any screen. `useStore(s)` is the hook that joins the
two: it reads a store and re-runs the component whenever the store changes.
`lib/store.ts` deliberately offers no `.value`, so every read has to say whether
it's subscribing.

Not all stores carry the same weight, and the difference decides who may write
to one.

**View state** is what a screen looks like at this moment: how the list is
sorted, which row is focused, which sheet is open. Nothing else has to happen
when it changes. It sits in a store rather than in `useState` only so that it
outlives the screen—Review's sort survives a trip to Sources and the Vault's
doesn't, because one is a store and the other is `useState`. **A screen may
write its own view state directly.**

**Entity state** is the records themselves: the memories, the review queue, the
keep/drop ledger. Changing one of these has to do more than change a value: it
has to reach the server, recompute the derived figures, and update anything
still showing the old copy. **Only the module that owns entity state writes it,
through named actions.**

The console already works this way by habit rather than by rule. No component
calls `decisions.set()`, because a decision has to be persisted and
re-preflighted, so it goes through `setDecision()`. Notes are the counterexample
and the bug in §3: no single module owns them, so two screens each keep a copy.

The rule is about what a store holds, not how it's reached. Stores stay
exported, and `layercheck.mjs` flags a write to an entity store from a `.tsx`
file—a far more useful check than banning store exports outright, which would
only add one-line wrappers around the writes that were never the problem.

### The dependency rule

Imports point **downward only**:

    presentation → state → endpoints → transport
    presentation → model
    state        → model

Two directions are always wrong:

- **`model` importing `state`** risks a cycle. This has already happened here:
  the scope predicate needed the scope stores, so we moved the stores down
  beside the predicate rather than importing upward.
- **presentation importing `endpoints`** means a screen bypassed the data layer.
  Three screens do this today.

## 2. Layout

**File suffix** carries the layer, so it's visible in a directory listing and
checkable by a script.

| Suffix | Layer |
|---|---|
| `*.api.ts` | endpoints |
| `*.ts` | model (pure) |
| `*.store.ts` | state |
| `*.tsx` | presentation |
| `*.test.ts` | tests, always beside the module |

Name directories after **concepts in the product**, never after layers or
shapes. A concept folder holds every layer of one idea:

```
src/
  main.tsx
  lib/                    primitives with no domain knowledge
    store.ts
    vendor/               vendored engine code, never edited
  copy/                   the catalog (unchanged)
  styles/                 tokens + one sheet per tool (unchanged)
  shell/                  app frame: router, overlays, toast, palette, transport
  ui/                     shared presentational, domain-unaware
  tools/
    memory/
      memory.api.ts       every LTM route, wire types only

      note/               the stored record
        note.ts           shape, status, id
        note.store.ts     THE owner of notes
        NoteRef.tsx       the one link-target renderer
        StatusPill.tsx
        TypeName.tsx
      section/
        section.ts        lines, meta, cap flag
        section.test.ts
        SectionKey.tsx    the one §key renderer
        SectionBody.tsx   the one section-text renderer
      keywords/
        keywords.ts       cap, tally
        KeywordList.tsx
        KeywordEditor.tsx
      links/
        relations.ts      relation → English, via the catalog
        LinkList.tsx
      pressure/
        pressure.ts       THE cap computation
        pressure.test.ts
        CapPressure.tsx
      scope/
        scope.ts          predicates
        scope.store.ts    the two scope stores
        ScopeBar.tsx
      review/
        review.ts         flatten, derive
        review.store.ts   THE owner of the queue
        decisions.store.ts
        ClaimDetail.tsx
        ...
      Vault.tsx           screens sit at the tool root
      Review.tsx
      Sources.tsx
      MemoryTool.tsx
      detail/             the memory detail card (provisional, open question 3)
```

Why concept folders rather than layer folders: **the 12 duplicated field
renderings in the surface census map one-to-one onto concept folders.** `§key`
rendered three ways becomes `section/SectionKey.tsx`. Cap pressure computed six
ways becomes `pressure/pressure.ts`. A layer-first layout would have split each
of those concepts across two or three directories and left the duplication
invisible.

## 3. Rules

- **One owner per entity.** Exactly one module fetches, holds, and invalidates a
  record type; everyone else subscribes. Notes have two owners today—`Vault.tsx`
  holds its own list *and* writes into `notesById`—so a save can refresh one
  copy and leave the other stale.
- **No component calls `fetch`.** A screen gets data by calling a hook.
- **One concept, one renderer.** Exactly one component draws a field. A second
  rendering of the same field is a bug, not a variant.
- **No `utils/`.** Every module is named after a noun in the product. A module
  you can't name that way doesn't have a home yet.
- **Domain logic never lives in a component file.** If you can test it without a
  DOM, it belongs in a model file.
- **Promote on the second consumer.** Shared within a tool stays in the tool;
  shared across tools moves to `ui/`.
- **Engine logic stays vendored.** Never reimplement keyword matching or token
  estimates.

## 4. Tests

- **Vitest, co-located.** `scope.test.ts` sits beside `scope.ts`. Deleting a
  module deletes its test.
- **Unit tests cover model files and nothing else.** Pure functions need no DOM
  and no fixtures.
- **Pin before collapsing.** Cap pressure gets tests covering all six current
  computations *before* they become one, so the consolidation is provably
  behavior-preserving.
- **The browser checks are the UI suite.** `verify.mjs`, `overlaycheck.mjs`,
  `domsnap.mjs`, and `copycheck.mjs` already assert against a real render. They
  keep their jobs, and we call them tests.
- **`npm test` runs both.** It says plainly when the browser half needs the app
  running.

## 5. Enforcement

The house habit is to encode a rule in a script rather than trust a
convention—`copycheck` for copy, `deadcss` for CSS, `overlaycheck` for
dismissal.

- **`design/layercheck.mjs`** reads every import and fails when one points
  upward. The file suffix gives it the layer without a manifest to maintain.

---

## Open questions

1. **`ui/` or `components/`.** `ui/` names a role (shared, domain-unaware);
   `components/` names a shape, and everything is a component. Renaming costs
   about 16 imports and five doc mentions, and would update `DESIGN.md` §8 and
   `CLAUDE.md` in the same change.
2. **Where do screens live** once a tool has many? Flat at the tool root reads
   well at four screens and badly at 10.
3. **Does `detail/` survive** as a screen family, or dissolve into the concept
   folders it draws from?
4. **Is `memory.api.ts` one file or a folder** once it covers notes, drafts,
   import, and backup?
5. **Do the other two tools follow immediately**, or does memory prove the shape
   first?
