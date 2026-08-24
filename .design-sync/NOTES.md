# design-sync notes — Marinara Console

## Repo shape

- **No Storybook, no `*.stories.*`** → `shape: "package"`.
- **This is an app, not a published library.** `package.json` has
  `main: "index.js"`, the npm-init default, and that file does not exist.
  There is no `exports`/`module`/`types` field. The real component surface is
  **`src/ui/index.ts`** — a barrel with 23 exports over 22 components. The
  converter needs that pointed at explicitly; discovery will not find it.
- **`dist/` is a Vite APP build** (index.html + hashed assets), not a component
  library build. Do not treat it as the compiled component output.

## Runtime — the big one

The console is **Preact**, currently mid-migration to React (owner-decided, in
progress this session). Claude Design renders React, so compiled Preact
components need `preact/compat` vendored into the bundle. A prior aborted run
did exactly that — its project carried `_vendor/react.js` + `_vendor/react-dom.js`.

Once the React port lands, this becomes unnecessary and fidelity improves.
Re-sync after that migration completes.

## Install

**Do NOT run `npm ci` while other work is in flight.** It wipes `node_modules`,
and this repo is worked on by concurrent agents that build against it. Deps are
already installed and lockfile-consistent. `npm ci` is correct for a cold clone
only.

Also note npm's optional-dependency bug bit this repo once: a missing
`@rolldown/binding-darwin-arm64` broke vite until it was installed explicitly.

## Prior attempts

Two throwaway projects exist from earlier runs, both named "(spike — delete me)":
- `f64c11cc-…` "Marinara Console (spike — delete me)" — 15 components, no anchor
- `b44b88ea-…` "React control (spike — delete me)" — 1 component

Neither carries `_ds_sync.json`. Owner chose a fresh project for this run; those
two are safe to delete.

## State at time of this sync

Four agents were concurrently migrating every user-visible string in `src/` onto
a new copy catalog (`src/copy/`). Owner accepted that previews may capture
half-migrated copy. Re-sync once that settles.

## Converter resolution root — a trap that cost real damage

The converter needs `react` in `--node-modules` (it vendors React for preview
cards). This repo has no react. **Do not build a scratch root by symlinking the
repo's packages into it and then `cp -RL` through those symlinks** — `cp -RL`
follows the link and copies a directory into itself, which EMPTIED
`node_modules/@preact/signals` and `node_modules/@tabler/icons-preact` in the
real repo. Nothing failed loudly: the vite dev server kept serving 200 from its
pre-bundled cache, so the damage was invisible until an unrelated `ls`.

Recovery is `npm install`, which then re-triggers the npm optional-dependency
bug — fix with `npm i --no-save @rolldown/binding-darwin-arm64`.

**Do instead:** give the scratch root its own real install
(`npm i react react-dom preact @preact/signals @tabler/icons-preact` inside
`.ds-sync/scratch/`), or point `--node-modules` at the repo's own node_modules
after installing react into it. Never mix symlinks-to-repo with recursive copies.

## Why the graph is bigger than src/ui

`src/ui/ErrorState.tsx` imports `ApiError` from `src/shell/api.ts`, so bundling
the barrel pulls in `src/shell/` — which is why `@preact/signals` (used by
`shell/toast.tsx`) appears in the dependency graph at all. Expect the bundle to
span more than `src/ui/`.

## Components excluded from the DS

`JsonView` and `CollapseButton` are real components but were removed from the
`src/ui/index.ts` barrel (consumed only inside `src/ui/`), so they are not
`window.MarinaraConsole.*` exports and cannot be component cards. They are set
to `null` in `componentSrcMap`. To include them, re-export them from the barrel
first — do not just un-null them, or their cards will reference a missing export.

## Known render warns (triaged — a warn NOT on this list is new)

- **`[FONT_MISSING]` for "Archivo", "JetBrains Mono", "Source Sans 3"** (the
  bare, non-Variable names). Not a real miss. `tokens.css` declares stacks like
  `"Archivo Variable", "Archivo", system-ui, sans-serif` — the *Variable* faces
  ship (16 `@font-face` rules via `cfg.extraFonts` pointing at the
  `@fontsource-variable/*` packages), and the bare names are deliberate
  fallbacks for a locally-installed static version. Validate cannot tell a
  fallback from a missing family. Do not "fix" by adding static woff2s.

## Prop extraction — the step that is easy to skip and shouldn't be

The converter emits `[key: string]: unknown` for every component unless it can
parse real declarations. This repo has `noEmit: true` and ships no `.d.ts`, so
out of the box **all 22 contracts were empty** — the design agent would have had
no API to code against, which is the single highest-value thing in the upload.

Fix, and it must be redone whenever component props change:

```sh
npx tsc -p tsconfig.dts.json          # emits .ds-sync/types/ (gitignored)
```

Then regenerate `cfg.dtsPropsFor` from those declarations. `tsconfig.dts.json`
is committed at the repo root. Extraction detail: the generator matches
`export declare function Name(props: {…})`; **`Edu` destructures its params**
(`function Edu({ children }: {…})`) so it is hand-written in the config. Any
future destructured component needs the same treatment.

The generated bodies map `ComponentChildren` → `React.ReactNode` and
`JSX.Element` → `React.ReactElement`, since the emitted `.d.ts` declares React
types.

## CSS entry must be a concatenation, not an import list

The converter appends `cfg.cssEntry` **raw** — it does not follow `@import`. An
entry file containing `@import "../src/styles/tokens.css"` ships an
unresolvable import and silently loses every token. `.design-sync/ds-entry.css`
is therefore GENERATED by `.design-sync/build-css-entry.sh`, which cats
`tokens.css` + `base.css` together. **Run that script before every build.**

`base.css` matters because `src/ui` components apply `.t-data` / `.t-label` /
`.t-num` / `.hit` by class name; without it they render unstyled.

## Pre-existing bug found while wiring the CSS (NOT design-sync's doing)

`t-prose`, `t-title` and `t-head` have **zero rules** in the built app CSS, yet
seven shared components apply them (Edu, EmptyState, FacetDrawer, Loading,
SearchDisclosure, Sheet, SearchBar). Only `.t-data`, `.t-label`, `.t-label-s`
and `.t-num` are actually defined, in `base.css`. So the prose face
(`--font-prose`) is never applied via a class anywhere — those elements just
inherit. DESIGN.md §1 mandates three faces with strict roles; one of them has no
delivery mechanism. Worth fixing in the app, independent of this sync.

## Re-sync risks

- **Runtime**: still Preact + a vendored React for the cards. After the React
  migration lands, re-sync — fidelity improves and the shim goes away.
- **Copy churn**: this sync captured the tree immediately after four agents
  migrated every string onto `src/copy/`. Previews are floor cards, so no copy
  is baked into a card — but `.prompt.md` files quote JSDoc, which does drift.
- **`dtsPropsFor` is a snapshot.** It does not track prop changes. Re-emit
  declarations and regenerate it on every re-sync, or contracts go stale
  silently — the build will NOT warn.
- **`.ds-sync/scratch/`** is a throwaway node_modules with its own react +
  preact + tabler install. It is gitignored and must be recreated on a fresh
  clone. Do not try to share the repo's node_modules with it.
- **Preview authoring is the standing offer**: all 22 ship floor cards. Any
  re-sync can author previews incrementally; authored files live in
  `.design-sync/previews/` and carry forward.
