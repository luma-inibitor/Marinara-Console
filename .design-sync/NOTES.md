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

## Invocation — the flag without which nothing builds

    node .ds-sync/resync.mjs --config .design-sync/config.json \
      --node-modules ./node_modules --entry ./src/ui/index.ts \
      --out ./ds-bundle --remote <anchor.json>

**`--entry ./src/ui/index.ts` is required.** Without it the converter resolves
the package as `<node-modules>/<cfg.pkg>` and dies on
`node_modules/marinara-console/package.json: ENOENT` — this is an app, so it is
not installed into its own node_modules. With `--entry`, PKG_DIR is found by
walking up from the entry to the first `package.json` carrying a `name`, which
lands on the repo root and is correct. Do NOT "fix" the ENOENT by symlinking the
repo into its own node_modules: the repo contains `.ds-sync/`, so that link is a
cycle and any recursive copy through it repeats the damage described below.

`--node-modules ./node_modules` is now the repo's own — it has react since the
port, so the separate scratch install is no longer needed.

## Runtime

The console is **React 19**. `preact` and `@preact/signals` are uninstalled, so
no compat shim is vendored and the bundle ships the same React the DS pane
renders. Earlier syncs vendored `preact/compat` as React; that is gone.

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

Clean: the copy migration onto `src/copy/` has settled and the React port has
landed. `npx tsc --noEmit`, `npm run build`, `scripts/domsnap.mjs` (DOM identical
across the port) and `verify.mjs` (zero console errors) were all green when this
bundle was built.

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
`JSX.Element` → `React.ReactElement`. Post-React-port the source says `ReactNode`
directly, so the emitted and configured bodies agree without translation.

Checking for drift is mechanical — match `declare function <Name>(props: {…})`
in `.ds-sync/types/**` against `cfg.dtsPropsFor` and compare the property-name
sets. At the last sync 21 of 22 matched exactly and only `Edu` was absent, which
is expected: it destructures. Anything else showing up absent means a component
started destructuring and needs hand-writing too.

## CSS entry must be a concatenation, not an import list

The converter appends `cfg.cssEntry` **raw** — it does not follow `@import`. An
entry file containing `@import "../src/styles/tokens.css"` ships an
unresolvable import and silently loses every token. `.design-sync/ds-entry.css`
is therefore GENERATED by `.design-sync/build-css-entry.sh`, which cats
`tokens.css` + `base.css` together. **Run that script before every build.**

`base.css` matters because `src/ui` components apply `.t-data` / `.t-label` /
`.t-num` / `.hit` by class name; without it they render unstyled.

## Preview cards render on the console's own canvas — do not lose this

The generated card template ends its `<head>` with
`<style>body{margin:0;padding:24px;background:#fff}</style>`, emitted **after**
`styles.css`. This console is dark-only, so on white every card rendered light
text on light and read as blank.

`build-css-entry.sh` therefore appends `html body { background: var(--canvas);
color: var(--text) }`. Specificity 0,0,2 beats the card's 0,0,1 regardless of
order, so no `!important` is needed and a design that genuinely wants another
surface can still override it the same way. The background is hardcoded in
`.ds-sync/lib/emit.mjs` with no config knob; this is the config-only way to beat
it.

Symptom if it regresses: cards go white and the blank count jumps.

## Reading the render check

`[RENDER_BLANK]` is a **PNG-size heuristic** (<5KB), and a uniformly dark card
compresses just as small as a uniformly white one. It cannot tell "broken" from
"correctly dark and sparse". Look at `_screenshots/contact-sheet-*.png` before
believing it.

The 7 flagged components (CopyableText, DetailSection, Edu, EmptyState,
ListGroup, SheetHead, Term) are blank for a plain reason: an unauthored preview
mounts as `h(C, {})`, and those components have nothing to draw without props.
The ones that do render (ErrorState, ListEmpty, Loading, NotFound) only differ
in having fallback copy — note they display the literal word `undefined` where
a prop should be. Authoring previews is the fix, and the owner has explicitly
deferred it.

## Re-sync risks

- **Copy churn**: `.prompt.md` files quote JSDoc, which drifts. Previews are
  floor cards, so no copy is baked into a card.
- **`sourceKeys` did not move across the React port**, so the driver reported
  22 verified-by-upload and graded nothing. That is the trust model working as
  designed — grades follow authored previews and preview-affecting config, not
  DS source edits — but it does mean a source rewrite this large ships without
  re-grading. Read the contact sheets yourself when the source has churned.
- **`dtsPropsFor` is a snapshot.** It does not track prop changes. Re-emit
  declarations and regenerate it on every re-sync, or contracts go stale
  silently — the build will NOT warn.
- **`.ds-sync/scratch/`** is a leftover preact-era node_modules and is no longer
  used — `--node-modules ./node_modules` is the repo's own now. Safe to delete.
- **Preview authoring is the standing offer**: all 22 ship floor cards. Any
  re-sync can author previews incrementally; authored files live in
  `.design-sync/previews/` and carry forward.
