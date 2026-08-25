# design-sync notes — Marinara Console

## Repo shape

- **No Storybook, no `*.stories.*`** → `shape: "package"`.
- **This is an app, not a published library.** `package.json` has
  `main: "index.js"`, the npm-init default, and that file does not exist.
  There is no `exports`/`module`/`types` field. The real component surface is
  **`src/ui/index.ts`** — a barrel with 29 exports over 23 components. The
  converter needs that pointed at explicitly; discovery will not find it.
- **`dist/` is a Vite APP build** (index.html + hashed assets), not a component
  library build. Do not treat it as the compiled component output.

## The converter is not in this repo

`.ds-sync/` is gitignored, so a fresh clone has the config and the previews but
**not the tool that consumes them**. `resync.mjs` arrives with the design-sync
skill; without that skill installed there is no way to build a bundle, and the
work below is prep only. `.ds-sync/types/` is likewise regenerated, never cloned.

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

Clean. On a cold clone at `97e8574`: `npm ci`, `npx tsc --noEmit`, `npm test`
(415 tests over 14 files), `npm run layercheck` and `npm run build` all green.
The browser checks (`scripts/domsnap.mjs`, `scripts/verify.mjs`) were not re-run
this round — no bundle was built, so there was nothing new to shoot.

Drift carried forward since the last uploaded bundle: `SectionKey` is new to the
barrel and to `componentSrcMap`, `DetailSection` and `Sheet` changed internally
without changing their props, and `shell/toast.tsx` split into `shell/toast.ts` +
`shell/Toaster.tsx`. No prop contract changed.

## Converter resolution root — a trap that cost real damage

The converter needs `react` in `--node-modules` (it vendors React for preview
cards). **This no longer needs a scratch root at all** — react is a real
dependency here since the port, so `--node-modules ./node_modules` is correct and
the rest of this section is kept only so the incident is not repeated.

**Do not build a scratch root by symlinking the
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

Two edges pull `src/shell/` in: `src/ui/ErrorState.tsx` imports `ApiError` from
`src/shell/api.ts`, and `src/ui/CopyableText.tsx` imports `toast` from
`src/shell/toast.ts`. Bundling the barrel therefore spans more than `src/ui/`.

(An older version of this note blamed `@preact/signals` by way of
`shell/toast.tsx`. Both are gone — preact is uninstalled and that module split
into `shell/toast.ts` + `shell/Toaster.tsx`.)

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

**That command now exits non-zero and this is expected.** Three TS4023/TS4058
errors say `Writable` from `src/lib/store` "cannot be named" — it is used in the
public type of `shell/router.ts`, `shell/toast.ts` and `ui/useCollapsedGroups.ts`
but never exported. Emit continues, and every component declaration lands; the
only casualty is `useCollapsedGroups.d.ts`, which is a hook and never a card. Do
not treat the non-zero exit as a failed extraction — check that
`.ds-sync/types/ui/` has a `.d.ts` per component instead. Exporting `Writable`
from `src/lib/store` would clear it.

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
sets. At this sync all 22 previously-configured components matched exactly —
`Edu` included, which is hand-written because it destructures. Anything showing
up absent means a component started destructuring and needs the same treatment.

Regenerating is safe to re-run: it reproduces every existing body byte for byte,
so the only diff should be genuinely new or genuinely changed components. Keep
the emitted indentation — strip the leading four spaces from the FIRST line only
and leave every continuation line as tsc emitted it.

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

An unauthored preview mounts as `h(C, {})`, so any component with nothing to
draw without props reads as blank. Seven were flagged for that reason
(CopyableText, DetailSection, Edu, EmptyState, ListGroup, SheetHead, Term) and
all seven now have authored previews in `.design-sync/previews/`. `SectionKey`
is the eighth and was authored with it — `k` is required, so it would have
flagged the same way.

The ones that render unauthored (ErrorState, ListEmpty, Loading, NotFound) only
differ in having fallback copy — note they display the literal word `undefined`
where a prop should be. They are still worth authoring.

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
- **Preview authoring is incremental**: 8 of 23 are authored, the rest ship
  floor cards. Authored files live in `.design-sync/previews/` and carry
  forward, so any re-sync can add to them without redoing the others.
- **Previews do not pass `copycheck` and are not meant to.** They carry specimen
  corpus prose — the Devi Okonkwo / Harbour Ledger world the existing seven
  established — which traces to no catalog by design. Keep new previews in that
  world, and keep the untraced strings to specimen data rather than UI copy.
