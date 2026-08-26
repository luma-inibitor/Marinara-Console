# Bespoke-check migration: implementation plan

## 1. Summary

Twenty-nine pull requests across seven tracks, sequenced into six waves. Total effort is about 67 hours; wall clock if three or four people work the waves in parallel is about 29.5 hours, which is four working days once review latency is counted. Net line change is roughly **−950 lines** overall, and the bespoke check code under `scripts/` drops from 3,774 lines today to about 1,940.

Both decisions in §2 are settled: `layercheck.mjs` is hardened in place rather than ported to dependency-cruiser, and `.decisions/README.md` gets committed while `design/research/` stays local-only. Nothing in this plan is blocked.

The critical path is the browser track: `ci/parallel-check-jobs` → `chore/playwright-harness` → `test/e2e-tap-targets` → `chore/retire-verify`, 24 hours of work in four serial PRs.

Two things in the reviewed draft were wrong and are corrected here. The `deadcss` prefix wildcard would have blinded 50 class names that are judged today, so it is replaced with a drift assertion that is strictly better than both the wildcard and the status quo. The i18next `mode:"all"` word-exclusion list silently un-enforces bare lowercase JSX text, which both incumbents catch today; a `no-restricted-syntax` backstop restores that class at zero cost, verified below.

---

## 2. Blocked, or needing your decision before work starts

### 2.1 dependency-cruiser is rejected; `layercheck.mjs` is hardened in place

**Decided.** dependency-cruiser is not adopted. `scripts/layercheck.mjs` stays and is rebuilt on
`typescript/unstable/*` instead.

The reason is that dependency-cruiser cannot run here without a second TypeScript on its resolution
path. In the repo, `require("typescript")` yields only `["version","versionMajorMinor"]` and
`ts.createSourceFile` is `undefined`; dependency-cruiser@18.2.0's manifest declares
`supportedTranspilers.typescript = ">=2.0.0 <7.0.0"`, so it would reject typescript@7 on semver even
if the API came back. `typescript7-tooling.md:249` already settled that question:
*"Do not do it."* That refusal stands.

The replacement path is the one `typescript7-tooling.md:271` §8.2 names. Verified in this tree:
`require("typescript/unstable/sync")` exposes 44 symbols including `Checker`, and
`typescript/unstable/ast` exposes 409. Zero new dependencies, no second lockfile, no `tools/`
sidecar, and no `postinstall` bootstrap.

This keeps five capabilities the dependency-cruiser port would have lost: per-specifier violation
naming, detection of zero-import unclassified files, the per-directory census, graceful per-file
parse degradation, and exit code 2 for a compromised run.

`chore/eslint-transport-client` still lands in wave 1. It moves the binding-level half of the layer
ownership rule into ESLint, which is the better home for it regardless of who owns the module-graph
half.

### 2.2 `design/research/` and `.decisions/` — decided

Verified: `ls design/research .decisions` returns `No such file or directory` for both. `.gitignore:30` ignores `design/research/`, and `.gitignore:9-10` ignores `.decisions/` twice.

`design/DESIGN.md:6` links to `design/research/dense-ui-survey.md`, `README.md:9` says the research "is vendored at `design/research/`", `README.md:37` describes `design/` as holding "vendored UI research", and `CLAUDE.md:20-23` makes `.decisions/` a core workflow rule including "`.decisions/README.md` is the format".

For `design/research/`, my recommendation is to leave it ignored and reword the three prose references to say it is a local-only artifact. It is a large research bundle and `.gitignore:29` already states the rationale.

For `.decisions/`, I recommend committing at minimum `.decisions/README.md`, ignoring the entries with `.decisions/*` plus `!.decisions/README.md`. A workflow rule in `CLAUDE.md` whose format document is invisible to every collaborator is not a rule. The opposite call — marking it explicitly local-only in `CLAUDE.md` — is defensible and is a one-line edit instead. **This needs your yes either way**, and it gates `chore/linkcheck` in wave 5.

### 2.3 The typescript@7 constraint, tool by tool

I verified each one rather than assuming. Every tool this plan adopts is clear.

| Tool | Status | Evidence |
|---|---|---|
| knip 6 | Clear | `npm view knip@6.32.2 dependencies` lists `oxc-parser`, `oxc-resolver` and eleven others, no `typescript`, and `peerDependencies` is empty. knip@5.88.1 declares `peerDependencies.typescript = ">=5.0.4 <7"` and would be blocked; pin `^6`. I installed knip@6.32.2 beside typescript@7.0.2 in a repo copy: `added 21 packages in 1s`, and it ran to a full clean report. |
| stylelint 17 | Clear | Pure PostCSS. I installed it (`added 116 packages`) and ran it against real CSS; no typescript involvement anywhere. |
| Playwright | Clear | Ships its own Babel transform for `.ts` specs. |
| eslint-plugin-i18next | Clear | Parser-agnostic; runs under the existing `@babel/eslint-parser` today. |
| markdown-link-check | Clear | Reads Markdown only. |
| jscpd | Clear | Own tokenizer. |
| **dependency-cruiser** | **Not adopted** | Blocked by the constraint; see §2.1. `layercheck.mjs` is hardened instead. |

---

## 3. The waves

### Wave 0 — destroy the merge hotspot (1 PR, 3 hours)

**Goal.** The `check` script is one 184-character `&&` chain on a single line of `package.json` (verified with `awk`), and fifteen of the twenty-eight PRs would edit it. Turn it into an append-only structure first.

**Gate to close.** `npm run check`, `npm run check:static`, `npm run check:test` and `npm run check:build` each exit 0 on `main`; `scripts/checks.mjs` lists one tool per line; `rm -rf node_modules && npm ci && npm run check` exits 0 from a clean clone.

| Branch | Title | Effort | Depends on |
|---|---|---|---|
| `ci/parallel-check-jobs` | Split check into parallel jobs and a one-line-per-tool check list | 3h | — |

`check:static` becomes `node scripts/run-checks.mjs`, reading `scripts/checks.mjs`, an array holding one npm script name per line, grouped by track so each track owns a contiguous region. Adding knip, stylelint, jscpd, pkgcheck or linkcheck is then a single added line and removing `deadexports` is a single deleted line, which git merges cleanly across non-adjacent regions. The `scripts` object in `package.json` is currently in insertion order, not sorted (`test, dev, build, copycheck, preview, kit, test:watch, typecheck, layercheck, …`), so this PR sorts it once; after that, two PRs appending different leaf scripts land in different regions.

No `postinstall` bootstrap is needed. That hook existed only to install the dependency-cruiser sidecar on a fresh clone; with §2.1 decided, every tool in this plan installs from the root `package.json` and a plain `npm ci` is sufficient for every gate below.

`check.yml` gains a workflow-level `permissions: contents: read`, a `static`/`test` matrix, and a `build` job that uploads `dist/`. It does **not** gain a browser job in this wave — `check:browser` needs a live Marinara Engine and would be red. The browser job arrives in wave 1 with the fixture corpus that makes it green.

No coverage is lost. This is a pure restructuring.

---

### Wave 1 — fix the violations, and stand up the browser harness (7 PRs, 19 hours)

**Goal.** Land every violation fix and test-only addition, so that every enforcement PR in wave 2 is green on arrival. Also start the longest single PR in the plan.

**Gate to close.** `npm run check` exits 0. `grep -rn 'what="' src` returns nothing. `grep -rn 'import("./toast")' src` returns nothing. `npx eslint src` exits 0. `npx vitest run test/server.test.mjs` reports 8 passed against the unmodified `server.mjs`. `npx playwright test` is green **in CI, as a required job**, and `jq -r '.devDependencies|keys[]' package.json | grep playwright` returns only `@playwright/test`.

| Branch | Title | Effort | Depends on |
|---|---|---|---|
| `chore/playwright-harness` | Playwright Test against the built preview, with API fixtures and a required CI job | 11h | wave 0 |
| `test/server-conformance` | Black-box HTTP conformance suite for `server.mjs` | 3h | wave 0 |
| `refactor/shared-savebar` | One shared `SaveBar` for lorebook entries and preset sections | 1.5h | — |
| `fix/what-prop-copy` | Type the `what` prop as a copy `Key` | 1.5h | — |
| `chore/eslint-transport-client` | Own the binding-level half of the layer ownership rule in ESLint | 1h | — |
| `chore/deadcss-drift` | Assert the `DOMAINS` table cannot go stale | 0.5h | — |
| `fix/toast-static-import` | Import `toast` statically in `api.ts` and `wire.ts` | 0.5h | — |

**`chore/playwright-harness`** is re-scoped upward from the draft's 7.25 hours and now carries three things the draft split across two PRs.

First, the fixture corpus. The draft named six fixtures and got the set wrong. `/api/long-term-memory/sources` does not exist — `src/tools/memory/store/sources.ts:15-17` assembles that screen from `fetchChats`, `fetchReview` and `importPreview`/`importSourceNotes`. Four required endpoints were missing. `src/tools/presets/data.ts:219-224` fetches `/prompts/${id}/full`, a compound object with four nested collections (`preset`, `sections`, `groups`, `choiceBlocks`), each passed through a `norm*` function; that is the heaviest fixture in the corpus and the draft did not list it. `src/tools/memory/store/scope.ts:49-50` fetches `/characters` and `/chats` unconditionally on every memory view mount. `src/tools/memory/MemoryTool.tsx:51` calls `refreshLtmStatus()` in an effect keyed on `view`, so all three memory views hit `/long-term-memory/status`. And memory detail needs `/long-term-memory/notes/:id`. The real corpus is about ten endpoints.

Second, the drift guard is narrower than the draft claimed. `grep -rln valibot src` returns `src/copy/shell.json`, `src/shell/wire.ts`, `src/shell/wire.test.ts` and three files under `src/tools/memory/api/`. There are no schemas for lorebook entries or presets, so parsing "every fixture file through the existing valibot schemas" covers roughly half the corpus. Either write schemas for the `Entry` and `PromptPreset`/`PromptSection` shapes, or say plainly in the PR body that only the memory fixtures are guarded.

Third, this PR now owns the CI browser job, and it is **required from the day it lands**, not gated three waves later. The draft deferred enforcement to a `ci/e2e` PR in wave 4, which meant fifteen PRs and 33.5 hours would land while a green, CI-runnable accessibility suite sat on `main` not enforcing — including exactly the CSS and UI-text PRs most likely to break it. There is no technical reason for that delay; deleting `verify.mjs` is not a prerequisite for enforcing `test:e2e`. The job carries the `~/.cache/ms-playwright` cache keyed on `hashFiles('package-lock.json')`, `npx playwright install --with-deps chromium-headless-shell` (196 MB rather than 356 MB for the full build), and a failure-artifact upload. `ci/e2e` as a separate PR is deleted from the plan.

The PR also removes `playwright` and `playwright-core` from `devDependencies` and adds `@playwright/test`, which brings both back transitively. The draft had this as a separate `chore/drop-playwright` PR in the knip track; both edit the same two lines of `package.json:50-51` and would have conflicted. Folding it here also means knip is clean on arrival in wave 2 with no `ignoreDependencies` fudge. State in the PR body that anyone still running `npm run check:browser` locally needs `npx playwright install chromium` once, since `playwright-core` alone does not download binaries.

Verification is `npx playwright test` green across four viewport projects, and `npx knip --dependencies` no longer reporting `playwright`.

**`test/server-conformance`** pins the current server's observable behaviour over real HTTP before the rewrite exists. It must come first for the obvious reason: unit tests of `stripVectors` and `isLtmWrite` would be deleted along with their host, whereas an HTTP suite is the contract both implementations satisfy. It adds `test/` and `test/fixtures/`, widens `vitest.config.ts:10`'s include to cover `test/**/*.test.mjs`, and makes a two-line `MC_DIST`/`MC_PUBLIC` override in `server.mjs` so the suite can point at fixtures. Nothing else in this wave opens either file.

**`refactor/shared-savebar`** must precede both the jscpd gate and the i18next config. Gating duplication at today's 0.46% would put the clone inside the budget. Independently, deleting `SectionSaveBar` at `src/tools/presets/PresetsTool.tsx:719-757` removes four of the i18next findings outright — I confirmed by running the proposed config against the real tree that `PresetsTool.tsx:745`, `:748` and `:753` (twice) are among the 27.

**`fix/what-prop-copy`** exports `Key` from `src/copy/index.ts` and types `what` on `Loading`, `NotFound` and `ListEmpty` as `Key`. This class cannot be fixed by the linter at any setting, and understanding why matters for the next section: seven of the twelve `what="…"` leaks are single lowercase words, and the exclusion regexes that make `mode:"all"` usable necessarily exempt those. The type system reaches where the linter cannot. `tsc --noEmit` rejects a misspelled key by name.

**`chore/eslint-transport-client`** adds a `no-restricted-imports` block with `importNames: ["api","default"]` scoped to presentation, excluding `src/shell/**`. It is the sole owner of `eslint.config.js` this wave; the i18next block waits for wave 2 so two flat-config appends never land on the same array tail.

**`chore/deadcss-drift` replaces the draft's `chore/deadcss-domains`, and this is a correction, not a tweak.** The draft proposed deleting the hand-maintained `DOMAINS` table at `scripts/deadcss.mjs:44-54` and exempting any class whose prefix is observed in a template literal. I measured what that costs. Of 542 CSS class names in `src/`, **70 become permanently unjudgeable** under the wildcard, including the entire `.is-*` state vocabulary — `is-open`, `is-active`, `is-editing`, `is-selected` and fifty more. Of those 70, only 20 actually need rescuing; **the other 50 are live today via the literal harvest and are judged normally**, so the wildcard blinds them for no gain. `deadcss.mjs` is by this plan's own repeated argument the only class-liveness check that survives the migration.

The stated problem was drift, not the table itself, so fix drift. Scope the prefix scan to `className=`/`cls=`/`surface=` template positions instead of every backtick in the tree, then assert that every prefix so found has a `DOMAINS` entry and exit 2 if not. I ran that: the class-position scan finds exactly five prefixes — `dec-`, `is-`, `ln-`, `st-`, `type-` — and **all five are already registered**, so the assertion is green today. The un-scoped scan additionally picks up `draft-`, `mut-` and `note-`, which are id templates in `src/tools/memory/test/factories.ts:28,43,63` and not class names at all; under the draft's wildcard, a test fixture could blind a whole CSS namespace. The same run reports `kw-` and `es-` as table entries never observed in a class position, so `kw-` can be deleted (its `.kw-add`/`.kw-edit` are literal in `src/tools/memory/ClaimDetail.tsx`) and `es-` verified by hand, since it is nested inside another template which the class-position regex cannot see past.

The single baselined entry `is-danger-act` stays baselined. `design/deadcss-baseline.json` does not empty out, and it should not — the draft's empty baseline was a consequence of blinding, not of burn-down.

**`fix/toast-static-import`** deletes the lazy `import("./toast")` in `src/shell/api.ts:45-47` and `src/shell/wire.ts:32-34` along with the two comments claiming they avoid a cycle. There is no cycle: `src/lib/store.ts` imports only `useSyncExternalStore` from react, and thirteen modules already import `toast` statically. This must precede `chore/fatal-build-warnings` or that PR is a config change plus a fix and fails on the tree it lands on.

---

### Wave 2 — install the replacements beside the incumbents (8 PRs, 24.25 hours)

**Goal.** Every replacement tool runs green next to the tool it will replace, so CI proves parity once before anything is deleted. Finish the Playwright spec fan-out.

**Gate to close.** `npx knip` prints nothing and exits 0. `npm run typescale` prints "89 literal font-size(s)" and exits 0. `npx stylelint "src/**/*.css"` reports exactly 89 problems, all from `marinara/font-size-token`. `npx eslint src` reports 0 problems at `mode:"all"`. `npm run build` exits 0 with warnings fatal. `npx playwright test` covers smoke, contrast, tap targets, overlays and keyboard.

| Branch | Title | Effort | Depends on |
|---|---|---|---|
| `test/e2e-tap-targets` | Keep the tap-target measurement, cross-check against axe | 6.5h | harness |
| `chore/copy-eslint-mode-all` | i18next at `mode:"all"`, plus a JSX-text backstop, and fix the 20 findings | 4h | what-prop, savebar |
| `test/e2e-keyboard-overlays` | Port the overlay matrix and keyboard walk into specs | 4h | harness |
| `chore/stylelint-typescale` | Replace the bespoke CSS scanner with a stylelint plugin | 3.5h | wave 0 |
| `test/e2e-axe-contrast` | Port the contrast sweep to axe, keeping the exemption rationales | 3h | harness |
| `chore/knip` | Add knip 6 and `knip.json`, tag the deliberate over-exports | 1.5h | harness |
| `chore/fatal-build-warnings` | Make bundler warnings fatal via `build.rolldownOptions.onwarn` | 1h | toast fix |
| `chore/wire-components` | Wire `scripts/components.mjs` into `package.json` | 0.75h | — |

**`test/e2e-tap-targets`** is re-estimated from 4 to 6.5 hours, because "~95 lines move verbatim" is not true. `scripts/verify.mjs:40` opens `const AUDITS = \`((rowSel, exemptions, TAP_PRIMARY, TAP_SECONDARY, TAP_GAP) => {` and the template literal runs unbroken to the `page.evaluate` at `scripts/verify.mjs:337`. It is one in-page IIFE whose `vis`, `clipTo` and `padBox` helpers are shared between the tap loop, the contrast sweep, the overflow check and the density report — and this plan sends those four to three different destinations. Anything inside `page.evaluate` must be self-contained, so a TypeScript module cannot simply import them. The work is a decomposition: extract the shared helpers into one self-contained in-page module injected with `addInitScript`, then have each spec call it.

There is a second, sharper problem the draft missed. `scripts/verify.mjs:148` grades a small target as `secondary: min >= TAP_SECONDARY && !(gap < TAP_GAP)`, and `clearance()` at `scripts/verify.mjs:129-141` returns `Infinity` when nothing else is on the same layer and the same `<nav>` side. With a sparse fixture corpus, `!(Infinity < 8)` is true and **every undersized target grades as a warning rather than a failure**. All three baselined cases are adjacency-driven (`.mem-mid` 35px/6.1px, `.row-summary` 39px/1px, `.mseg` 42px/2px, per `BACKLOG.md:403-411`, measured against a live engine). So the PR's verification cannot be "the baseline array must be exactly the nine entries `verify.mjs` reports today" unless the fixtures reproduce live row density. Add that as an explicit fixture requirement on `chore/playwright-harness`: each list screen needs enough adjacent rows to produce sub-8px clearance. If it cannot be reproduced, baseline what the corpus actually yields and say so, rather than asserting parity with a live-engine measurement.

**`chore/copy-eslint-mode-all` carries the second correction in this plan.** The proposed `words.exclude` list makes `mode:"all"` usable — it takes the raw count from 3,038 to 27 — but two of its seven regexes exempt every bare lowercase word, and that is a live regression against what is enforced on `main` today. I built a probe and ran the repo's own ESLint 9.39.5 under both configs.

Under the current config at `eslint.config.js:44-49`:

```
4:13  error  disallow literal string: <span>keep</span>
5:13  error  disallow literal string: <span>drop</span>
6:46  error  disallow literal string: <button onClick={() => toast("saved")}>ok</button>
7:10  error  disallow literal string: <p>Long-Term Memory</p>
✖ 4 problems
```

Under the proposed `mode:"all"` config, `keep`, `drop` and `ok` all go silent and only `Long-Term Memory` survives. The class is live, not hypothetical: 53 of the 452 rendered strings in `src/copy/*.json` are exactly that shape, including `lorebooks.row.idle = "idle"`, `lorebooks.valueYes = "yes"`, `lorebooks.entry.advChanged = "changed"`. `scripts/copycheck.mjs:103-104` rejects this exemption on purpose, with the comment that "the bare word `keep` (no separator) [is] NOT [exempt] — a one-word lowercase coinage must still be registered."

The obvious fix does not work, and I checked before recommending anything. Tightening `/^_*[a-z][A-Za-z0-9]*$/` to require an internal capital changes nothing, because the route-and-class regex `/^[.#/]{0,1}-{0,2}[a-z0-9]+(?:[_./:-][a-z0-9]+)*\/?$/` also matches `keep`, `drop`, `ok`, `idle` and `yes` — the separator group is zero-or-more. On the real tree, tightening the first regex alone adds three findings, all false positives on `"__text"` at `src/tools/memory/ClaimDetail.tsx:139,324,354`, and recovers nothing. Tightening both takes the tree from 27 findings to **254**, almost all enum and union values: `"mid"`, `"end"`, `"solo"` at `src/tools/presets/data.ts:210`, `"tree"` at `src/ui/JsonView.tsx:20`, `"normal"`/`"slow"`/`"stalled"` at `src/ui/Loading.tsx:21-24`, `"nearest"` at `src/ui/useRovingFocus.ts:89`. That is unusable.

The fix that works is a second rule in the same config block, targeting the JSX-text position specifically, where the word exclusions do not apply:

```js
"no-restricted-syntax": ["error", {
  selector: 'JSXText[value=/^\\s*[a-z][a-z0-9]*\\s*$/]:not([value=/^\\s*[kst]\\s*$/])',
  message: "bare lowercase JSX text must come from t()",
}],
```

The `:not()` clause preserves the `k`/`s`/`t` unit-suffix exemption that `eslint.config.js:48` already grants. I ran the whole thing against the real `src/`: the count stays at exactly 27, **zero new findings**, and the probe recovers all three of `keep`, `drop` and `ok`. Without the `:not()`, it correctly finds the three unit suffixes at `src/shell/Toaster.tsx:30`, `src/tools/lorebooks/BookAudit.tsx:405` and `src/tools/memory/Vault.tsx:213`, which confirms the selector is actually firing.

The finding count this PR fixes is **20, not the 24 the draft claimed**. Twenty-seven total, minus the three `what=` props removed by `fix/what-prop-copy` (`BookAudit.tsx:262,265` and `PresetsTool.tsx:363`), minus the four literals removed by `refactor/shared-savebar` (`PresetsTool.tsx:745,748,753,753`). Of the remaining twenty, most are a mechanical swap to a key the finding itself names.

**`test/e2e-keyboard-overlays`** does **not** delete `scripts/overlaycheck.mjs` or its npm script, contrary to the draft. `package.json` defines `"check:browser": "npm run verify && npm run overlaycheck"`, and deleting one half in wave 2 while the repoint lands in wave 3 would leave `npm run check:browser` failing with `npm error Missing script` for a full wave. The deletion moves to `chore/retire-verify`, which already owns that script's retirement. This PR therefore touches `package.json` not at all.

**`chore/stylelint-typescale`** keeps `design/typescale-baseline.json` and `scripts/lib/baseline.mjs`; stylelint's own `--suppress` is count-based and provably lets a fix-plus-new-violation swap through. Two amendments to the draft.

First, the adapter must not swallow parse failures. `scripts/typescale.mjs:45-46` documents that exit code 2 means "the check itself is compromised and must never read as a pass", and a rule-name filter breaks that. I installed stylelint@17 and measured it against a deliberately malformed sheet:

```
broken.css | errored: true | parseErrors: 0
   rule= CssSyntaxError text= Unclosed block (CssSyntaxError)
good.css | errored: true | parseErrors: 0
   rule= declaration-property-value-allowed-list text= Disallowed value "13px" for property "font-size"
adapter (rule-name filter) sees: 1
```

Note that `parseErrors` is `0`, not populated — so the check has to be `res.warnings.some(w => w.rule === "CssSyntaxError")`, not `res.parseErrors?.length`. Push those into the integrity array so the run exits 2.

Second, this PR must add the `csslint` leaf script now, not leave it to `chore/stylelint-hygiene`. The draft offered "leave it out — `npm run typescale` already runs the full config, so a hygiene finding fails via the typescale step's `stylelint.lint` call", and the measurement above shows that is false: any warning whose `rule` is not `marinara/font-size-token` is discarded. Add `"csslint": "stylelint \"src/**/*.css\""` and one line in `scripts/checks.mjs`, so the wave-3 hygiene rules have somewhere to be enforced.

**`chore/knip`** must land after the harness so `tests/e2e/` and `playwright.config.ts` already exist and their entry rules are authored once. Its `ignore` array is append-only, one path per line, and each later PR that adds an ignored path owns its own line. Two of those lines matter and I verified both by installing knip 6 against a repo copy.

One knip finding in the draft is now moot: with dependency-cruiser rejected, no `.dependency-cruiser.cjs` is ever created, so the plugin never activates and nothing needs adding to `ignore` for it. The finding, for the record, was:

```
Unused files (1)
.dependency-cruiser.cjs
```

That no longer applies. What does still apply: an npm script invoking the `lychee` binary produces `Unlisted binaries (1) / lychee package.json` — which is one of two reasons wave 5 uses `markdown-link-check` instead, see below. `jscpd` produces the same finding until it becomes a real devDependency, which it does in wave 3.

Ordering note: `knip.json` should not pre-seed any path that does not yet exist, because knip emits a `Configuration hints` line reading `<path> knip.json Remove from ignore`. Hints do not fail the build, but each PR that needs an ignored path should add its own line.

With the full config, knip's entire output on today's tree is one unused devDependency (`playwright`, gone by then), seven unused exports, three unused exported types and one config hint — which the eight `/** @public */` tags and the `main` field deletion clear.

**`chore/fatal-build-warnings`** uses `build.rolldownOptions.onwarn`, not `rollupOptions`, which `node_modules/vite/dist/node/index.d.ts:867` marks deprecated. It throws on a named allow-list — `INEFFECTIVE_DYNAMIC_IMPORT`, `CIRCULAR_DEPENDENCY`, `UNRESOLVED_IMPORT`, `EMPTY_BUNDLE` — so a new upstream advisory on a dependency bump does not break CI. The chunk-size warning comes through the reporter plugin's logger, not `onwarn`, so it cannot be made fatal the same way; it gets a `chunkSizeWarningLimit: 700` ceiling with a comment saying that is a ceiling and not an approval.

**`chore/wire-components`** wires only `components`, and drops the draft's `shots` half, which wired an npm script for a file that `chore/retire-verify` deletes two waves later. What survives is real: `BACKLOG.md:398` claims `components.mjs` can be deleted, and it cannot, because `scripts/domsnap.mjs:146` execs it. This PR is also this wave's designated `README.md` owner.

---

### Wave 3 — delete the incumbents (6 PRs, 11.5 hours)

**Goal.** Remove each bespoke script whose replacement has been running green beside it for a full wave.

**Gate to close.** `ls scripts/deadexports.mjs scripts/layercheck.mjs scripts/copycheck.mjs scripts/verify.mjs scripts/overlaycheck.mjs scripts/faceprobe.mjs` reports all absent while `ls scripts/lib/baseline.mjs scripts/lib/imports.mjs scripts/deadcss.mjs scripts/components.mjs scripts/domsnap.mjs` reports all present. `npm run check` exits 0. `node scripts/copycatalog.mjs` prints "496 coined strings · 1171 product keys" and exits 0. `npm run jscpd` reports 3 clones at 0.19%. `git log --oneline main -- scripts/checks.mjs` shows each replacement's line added at least one merge before its incumbent's line was removed — the draft's wave-3 start condition required reading GitHub Actions history, which is not checkable from the repository.

| Branch | Title | Effort | Depends on |
|---|---|---|---|
| `chore/retire-verify` | Retire `verify.mjs`, `overlaycheck.mjs`, `shots.mjs`, `faceprobe.mjs`; rewrite DESIGN.md §7 | 3.5h | all three spec PRs |
| `chore/layercheck-harden` | Rebuild `layercheck.mjs` on `typescript/unstable/*` | 3h | eslint block |
| `chore/copycheck-to-copycatalog` | Delete `copycheck.mjs`; retain catalog integrity in 84 lines | 2.5h | mode:"all" |
| `chore/stylelint-hygiene` | Fifteen rules and the 4 real duplicate selectors they find | 1h | typescale |
| `chore/jscpd` | Gate duplication at 0.3% | 1h | savebar |
| `chore/drop-deadexports` | Drop `scripts/deadexports.mjs` for knip | 0.5h | knip |

**`chore/retire-verify`** is this wave's owner of `README.md`, `CLAUDE.md`, `design/DESIGN.md`, `design/BRIEFING.md` and `design/CHECKLIST.md`. It deletes `scripts/verify.mjs` (426 lines), `scripts/overlaycheck.mjs` (88), `scripts/shots.mjs` (50) and `scripts/faceprobe.mjs` (49), and removes the `verify`, `overlaycheck`, `faceprobe` and `check:browser` npm scripts.

It must also delete two exports from `scripts/lib/browser.mjs`, a file the draft explicitly listed as untouched. Once the four consumers are gone, `domsnap.mjs:17` is the only one left, and knip goes red. I simulated it exactly:

```
Unused exports (9)
loadBaseline    function  scripts/lib/baseline.mjs:16:17
ALL_VIEWPORTS             scripts/lib/browser.mjs:26:14
openPage        function  scripts/lib/browser.mjs:49:23
...
```

`ALL_VIEWPORTS` and `openPage` are new relative to the wave-2 baseline of seven. Delete both in the same commit, or tag them `/** @public */` if they are being kept deliberately. `scripts/lib/browser.mjs` goes on the touched-files list.

`shots.mjs` is referenced as a tool by `design/MOCKUP-KIT.md:48` and `design/DESIGN.md:342` for screenshotting arbitrary mockup URLs. Do not silently delete it while two design documents tell people to run it — fold its four-viewport loop into a `tests/e2e/shots.spec.ts` guarded by `test.skip(!process.env.MC_SHOTS)` and reading `MC_SHOT_URL`, and update both documents.

`design/ARCHITECTURE.md:46` claims "`layercheck.mjs` flags a write to an entity store from a `.tsx` file". I read all 323 lines and there is no such check. That sentence gets fixed by `chore/layercheck-harden`, which owns `ARCHITECTURE.md` this wave — a different file from the set this PR owns, so the two can run in parallel.

**`chore/layercheck-harden`** replaces `layercheck.mjs`'s Babel front end with `typescript/unstable/ast`
and `typescript/unstable/sync`, keeping the file, its two rules, its exit codes and its per-directory
census exactly as they are. The gain over the status quo is resolution: today the per-specifier
type-only decision is a syntactic guess from Babel, and with the real checker it becomes a resolved
fact, which is what `tsconfig.json:12-15` set `verbatimModuleSyntax` up to guarantee. The regression
net is the existing `scripts/fixtures/layercheck/**` corpus plus `scripts/layercheck.test.mjs`; every
fixture directory name states the violation it encodes, and all of them must still fail for the same
reason with the same message. This PR is the sole owner of `design/ARCHITECTURE.md` this wave.

**`chore/copycheck-to-copycatalog`** deletes 784 lines plus `design/copy-baseline.json`, which contains only `_areas` and currently suppresses nothing. It adds an 84-line `scripts/copycatalog.mjs` checking only what the runtime does not: entry shape, coinage note length, two console entries rendering the same text, a coinage whose text already exists in `src/copy/vendor/ltm-en.json`, and `despite` both resolving and actually colliding. It also adds a five-line `src/copy/copy.test.ts`, because the DEV load-time assertions at `src/copy/index.ts:104-122` currently fire in CI only because two unrelated store tests transitively import the module — one refactor away from vanishing silently.

**`chore/drop-deadexports`** must **not** delete `scripts/lib/baseline.mjs`. It is imported by `scripts/typescale.mjs:51` and `scripts/deadcss.mjs:32`, and `deadcss.mjs` has no replacement anywhere in this plan, so `baseline.mjs` survives the whole migration. Same for `scripts/lib/imports.mjs`, still imported by `components.mjs:71`. This PR also corrects `todo/components.md:184-185`, both halves of which are false: `deadexports.mjs` does judge exported types (header at `scripts/deadexports.mjs:15-19`) and all five named types are already parked in `design/deadexports-baseline.json:6-18`.

---

### Wave 4 — the server rewrite and the remaining hygiene (3 PRs, 6.75 hours)

**Goal.** Finish the server. Each of these touches a file a wave-3 PR owned.

**Gate to close.** `npx vitest run test/server.test.mjs` reports 8 passed against the rewritten server, with only the `.ico`/`.txt` assertions flipped. `curl -sD- localhost:7872/assets/index-<hash>.js` shows `cache-control: public,max-age=31536000,immutable` while `/index.html` shows `no-store`, and an `If-None-Match` replay returns 304. `node scripts/pkgcheck.mjs` prints "package.json clean". `design/css-collisions-baseline.json` contains the `.toaster`/`bottom` pair and `node scripts/deadcss.mjs` exits 0.

| Branch | Title | Effort | Depends on |
|---|---|---|---|
| `chore/server-sirv-proxy` | Rebuild static and proxy on sirv and http-proxy-middleware | 4h | conformance suite |
| `chore/css-cross-sheet` | Cross-sheet declaration collisions in `deadcss.mjs` | 2h | deadcss-drift, hygiene |
| `chore/package-hygiene` | `package.json` and `.gitignore` hygiene, asserted by `pkgcheck` | 0.75h | — |

**`chore/server-sirv-proxy`** is this wave's `README.md` owner, because it has to retract two claims that become false. `README.md:35` describes `server.mjs` as a "zero-dep proxy" and `design/ARCHITECTURE.md:13` calls it "a dependency-free proxy".

Three prototype findings are load-bearing and belong in the PR body. `http-proxy-middleware`'s own `responseInterceptor` buffers every response unconditionally and reproduces the exact 595 MB memory defect being fixed, so the `embedding` strip must be a hand-written content-type-conditional `on.proxyRes`. `on.proxyReq` cannot gate an async operation — the request forwards about 3 ms in, 300 ms before an async handler resolves — so the LTM restore point stays a plain `await` in the `node:http` handler before the middleware runs. And sirv needs `dev: true`, because its default snapshots the directory listing at boot and a `npm run build` while the server is up would 404 every newly hashed asset.

**`chore/css-cross-sheet`** is the only mechanism in the plan that catches the `.toaster` defect: four different `bottom` values for one element across `src/styles/lorebooks.css:253,256` and `src/styles/presets.css:255,256`, resolved by stylesheet load order. stylelint is per-file and reports nothing for it. Use the `(selector, property)` form, which yields 23 findings clustered on four real sites; the naive "class name in two sheets" form yields 65 and would be pure noise. Pick the baseline implementation rather than fixing all 23 inline, so the gate above is satisfiable.

**`chore/package-hygiene`** is not "last among the `package.json` editors" — wave 5 has two more. The accurate rationale is that it must follow the last dependency addition and the last edit to the four fields it asserts, which wave 4 satisfies. Note that `npm pkg fix` alone is a no-op on this file; the real work is `npm pkg delete main description keywords author` and `npm pkg set license=UNLICENSED`. Deleting `main` also removes knip's last configuration hint. `.gitignore` has `shots/` twice (lines 5 and 24) and `.decisions` twice (lines 9 and 10).

---

### Wave 5 — the two leaves (2 PRs, 2.5 hours)

**Gate to close.** `npm run linkcheck` reports 0 dead links. `npm run build && curl -sD- -H 'accept-encoding: br' localhost:7872/assets/index-<hash>.js` returns `content-encoding: br` with `vary: accept-encoding`, and an empty accept-encoding still returns the uncompressed original.

| Branch | Title | Effort | Depends on |
|---|---|---|---|
| `perf/precompress-dist` | Precompress `dist/` to `.br`/`.gz` so sirv can serve them | 1.5h | sirv rewrite |
| `chore/linkcheck` | Fix the broken path references and gate with `markdown-link-check` | 1h | — |

**`chore/linkcheck` uses `markdown-link-check`, not lychee.** You named `markdown-link-check` in the decisions, and I verified it works here rather than assuming the draft's substitution was necessary. Against `design/DESIGN.md` under node 24.19.0:

```
ERROR: 1 dead link found in design/DESIGN.md !
[✖] research/dense-ui-survey.md → Status: 400
```

Exit code 1 on a dead link, 0 when clean, `ignorePatterns` for offline mode, 69 packages installed. It is an npm package, so knip sees the binary as listed, and there is no third-party GitHub Action to pin. lychee would have required `lycheeverse/lychee-action` as a new supply-chain surface and produced a permanent `Unlisted binaries` finding in knip.

Be honest about the value. `grep -rhoE '\]\([^)]+\)' README.md CLAUDE.md BACKLOG.md design/*.md` returns **five links in the entire committed doc set**: one external, one dead (`design/research/dense-ui-survey.md`), and three that resolve. The gate is surveilling three working links. The reason to keep it is that the fix converts the backticked path references at `README.md:9`, `README.md:37` and `CLAUDE.md:20-23` into real Markdown links, which is what makes any checker able to see them going forward. If you would rather take the documentation fixes alone and skip the gate, that is a defensible call and saves half an hour plus a `check:static` entry.

**`perf/precompress-dist`** measured: `index-CrxHehqs.js` goes from 666,225 bytes to 156,754 under brotli quality 11.

---

## 4. Coverage lost

This is the section to scrutinise. Nothing here is minimised.

### Losses I judge acceptable

**Bare lowercase words outside JSX text.** After the `no-restricted-syntax` backstop, `<span>keep</span>` is still caught, but `title="keep"`, `toast("saved")` and `{cond ? "keep" : "drop"}` are not, because the word-exclusion regexes apply globally in `mode:"all"`. Fifty-three of 452 rendered strings in `src/copy/*.json` are of that shape. I measured the alternative: tightening the regexes to catch them takes the tree from 27 findings to 254, almost all enum and union values. The residual mitigation is `scripts/copycatalog.mjs`, which still governs whether such a string is registered once someone routes it, and the `what: Key` typing pattern, which is the general answer for props.

**Four copy-carrying DOM attributes.** `scripts/copycheck.mjs:400-404` checks `aria-label`, `aria-description`, `aria-placeholder`, `aria-valuetext`, `aria-roledescription`, `title`, `placeholder` and `alt`. `eslint-plugin-i18next` hard-codes `['placeholder','alt','aria-label','value','title']` at `node_modules/eslint-plugin-i18next/lib/helper/index.js:15` and skips everything else on a native DOM tag before consulting the `jsx-attributes` option. I confirmed on the probe that `<span aria-valuetext="3 of 8" />` is not reported. The gap is latent — `grep -rn 'aria-description\|aria-placeholder\|aria-valuetext\|aria-roledescription' src` returns nothing today — but it becomes permanent. If you want it covered, a second `no-restricted-syntax` selector matching `JSXAttribute[name.name=/^aria-(description|placeholder|valuetext|roledescription)$/] > Literal` costs three lines.

**Copy sentence reconstruction.** `scripts/copycheck.mjs:410-425` reassembles `<>adds to <Skey/> of {ref}</>` so it can be matched against the catalog's `"adds to {{section}} of {{ref}}"`. That machinery existed to *suppress* findings, not produce them. `mode:"all"` reports each fragment individually, which is stricter, not weaker.

**The copycheck mockup mode and baseline ratchet.** `scripts/copycheck.mjs:598-620` is only reachable by passing an `.html` path, which nothing in `package.json` or CI ever does, and `design/copy-baseline.json` holds only `_areas` with no per-file entries. Both are dead weight.

**The `@copy-strict` escape hatch.** Its two consumers, `src/tools/lorebooks/data.ts` and `src/tools/presets/data.ts`, contain no English literals, so the marker is already inert.

**Three deadexports findings and the per-directory census.** knip credits one level of reference from a used export's own declaration, so `FacetGroup`, `PickerOption` and `DisclosureOption` — each appearing in the props annotation of the exported component beside it — become invisible. `FacetValue` and `FacetLine`, referenced only from inside another interface body, are still caught. knip also has no equivalent of `deadexports`' `src/ui  30 files  117 exports  9 used only in their own file` table; that inventory now comes from `scripts/components.mjs`. In exchange knip finds two things `deadexports` structurally cannot see, because its file discovery is `/\.tsx?$/` over `src/` only: `testKeyword` at `src/lib/lorebook-keyword-matching.js:30` and `loadBaseline` at `scripts/lib/baseline.mjs:16`.

**`export *` abstention.** `scripts/deadexports.mjs:164` deliberately judges nothing under a star re-export. knip resolves through them. Different, not worse.

**The `font` shorthand.** `src/ui/JsonView.css:67` has `font: inherit`, a size the scale cannot name. Neither the old scanner nor the stylelint rule sees it. Coverage is unchanged, not reduced.

**Runtime compression, and `If-Modified-Since`.** After `perf/precompress-dist`, only precompressed siblings are served, so a file hand-added to `public/mockups/` is served uncompressed until the script re-runs. sirv implements `If-None-Match` but not `If-Modified-Since`; the current server has neither, so this is still a net gain.

**Generated-content and placeholder contrast, and the two-tier tap rule.** axe does not evaluate `::before`/`::after` or `::placeholder` ink, and cannot express `>=44 OR (>=24 AND edge-gap>=8)` because its `any: [target-size, target-offset]` is a disjunction. Both are handled by keeping the bespoke measurement (`test/e2e-tap-targets`) rather than by losing them — but the measurement now has the fixture-density caveat in §3, wave 2.

**The `data-contrast-exempt` accountability warning.** `scripts/verify.mjs:264` warns when an element carries the attribute with no matching exemption entry. Under axe, an unlisted attribute is simply measured — same outcome, but silently, so nobody is told the attribute is dead. Recoverable in about six lines.

**Nothing is lost on the layer rule.** This was the largest entry in the draft's loss column and §2.1 removes it. `layercheck.mjs` keeps per-specifier violation naming (`imports { SECTION_CAP } from "../api/types"`, where dependency-cruiser would have printed only the module pair), keeps graceful per-file parse degradation, keeps detection of unclassified files that import nothing at all, keeps the per-directory census, and keeps exit code 2.

### Losses I want you to look at twice

**`shots.mjs` as a mockup screenshotter.** Folding it into a skipped-by-default spec preserves the capability but changes the invocation, and two design documents describe the old one. If the spec form is awkward for ad-hoc mockup URLs, keeping it as a 40-line standalone CLI is the better trade.

**jscpd's blind band and its exclusions.** At threshold 0.3% with a 0.19% tree, roughly twelve duplicated lines of headroom go unsurveilled. Three real clones survive and stay under the gate: `entries.tsx:63` against `PresetsTool.tsx:593` (10 lines), `BookAudit.tsx:309` against `PresetsTool.tsx:409` (8 lines), and `Review.tsx:217` against `Review.tsx:248` (6 lines). Test files are excluded, so the 14-line clone between `facets.test.ts:17` and `flags.test.ts:13` is never reported; including tests takes the baseline from 0.19% to 0.50% and the gate stops meaning anything. CSS is excluded, so `RetrievalCard.css:51` against `SectionRow.css:72` is not reported either.

**The chunk-size warning is ceilinged, not gated.** Vite emits it through the reporter plugin's logger, which `onwarn` does not intercept, so a bundle past 700 kB still only prints. There are currently zero `React.lazy` call sites in `src/`; route-level splitting is a feature PR, not a CI change.

**`no-descending-specificity` is deliberately off** — 16 findings, all ordering advice nobody will act on. `at-rule-no-unknown` is off because it false-positives on Tailwind v4's `@theme` at `src/styles/theme.css:14`.

**Nothing catches the `.rail-cell` split.** `src/styles/lorebooks.css:79` holds the only base rule; `src/styles/presets.css:54,58` hold only descendant rules. That is a shared class whose base lives in one tool's sheet and whose variants live in another's — not a duplicate definition, so neither `no-duplicate-selectors` nor the `(selector, property)` cross-sheet check reports it. The generic check that would catch it produces 65 findings including `.is-open` across five sheets, which is exactly the noise `eslint.config.js:18-19` warns against.

### The loss the draft would have introduced, and does not

For the record, since it was close: the `deadcss` prefix wildcard would have made 70 of 542 class names permanently unjudgeable, of which 50 are judged today. The drift assertion in `chore/deadcss-drift` loses nothing and additionally reports a stale table entry (`kw-`). See §3, wave 1.

---

## 5. Conflict hotspots

**`package.json`, the `check` line.** Fifteen PRs would edit one 184-character line. Wave 0 replaces it with `scripts/checks.mjs`, one script name per line, grouped by track. After that every addition is one added line and every removal is one deleted line in a different region.

**`package.json`, the `scripts` object.** Currently in insertion order, not sorted, so two PRs appending leaf scripts land adjacent. Wave 0 sorts it once. Unlisted pairs the draft missed: `chore/knip` against `chore/wire-components` in wave 2, and `chore/jscpd` against `chore/copycheck-to-copycatalog` in wave 3.

**`package-lock.json`.** Additions to `devDependencies` are separate lines in a sorted object and merge; the lockfile does not. Never hand-merge. On conflict, take `main`'s lockfile, re-run `npm install <the one package this PR adds>`, and commit the regenerated file. Wave 2 has two dependency-adding PRs, knip and stylelint; land them a few hours apart.

**`.github/workflows/check.yml`.** Three owners, one per wave: `ci/parallel-check-jobs` in wave 0, `chore/playwright-harness` in wave 1 (adding the required browser job), `chore/retire-verify` in wave 3 (repointing it at `test:e2e`, which it must do because it deletes the script that job would otherwise invoke).

**`knip.json`.** The `ignore` array is append-only, one path per line; each PR that ignores a path owns its own line. No path is pre-seeded before the PR that creates it, to avoid the `Remove from ignore` config hint. `ignoreBinaries` is empty because wave 5 uses `markdown-link-check`, an npm package.

**`README.md`, lines 9 and 35 to 38.** Four PRs edit inside git's three-line context window, so exactly one owner per wave: `chore/wire-components` (wave 2), `chore/retire-verify` (wave 3), `chore/server-sirv-proxy` (wave 4), `chore/linkcheck` (wave 5).

**`design/*.md` and `CLAUDE.md`.** Split by file, not by wave. `chore/layercheck-harden` touches only `design/ARCHITECTURE.md` §1, §2, §5 and §46, so it shares wave 3 with `chore/retire-verify`, which owns `DESIGN.md`, `BRIEFING.md`, `CHECKLIST.md` and `CLAUDE.md`. `chore/server-sirv-proxy`'s `ARCHITECTURE.md:13` edit is a different section a wave later.

**`src/tools/presets/PresetsTool.tsx`.** Three PRs in a 758-line file. `refactor/shared-savebar` (deleting lines 719-757) and `fix/what-prop-copy` (editing 70, 147, 148, 363, 365, 465) share wave 1 because the hunks are far apart. `chore/copy-eslint-mode-all` waits a wave, which is also what removes four of its own findings.

**`eslint.config.js`.** Both `chore/eslint-transport-client` and `chore/copy-eslint-mode-all` append a flat-config block to the same array tail. Serialised across waves 1 and 2. There is no reason to try to parallelise two config appends.

**`src/styles/memory.css` and `src/styles/lorebooks.css`.** `chore/stylelint-hygiene` merges the four duplicate selectors in wave 3; `chore/css-cross-sheet` resolves the 23 collisions against the merged result in wave 4.

**`scripts/deadcss.mjs` and `scripts/lib/baseline.mjs`.** The two `deadcss.mjs` edits serialise across waves 1 and 4. For `baseline.mjs` the constraint is a deletion ban, not a merge conflict: `chore/drop-deadexports` must not remove it, because `typescale.mjs:51` and `deadcss.mjs:32` still import it and `deadcss` has no replacement anywhere in this plan. Same for `scripts/lib/imports.mjs`, still imported by `components.mjs:71`.

---

## 6. Out of scope

**Search libraries.** uFuzzy and MiniSearch are backlog only. Nothing in this plan touches search.

**Component refactoring.** Everything in `todo/components.md` beyond the single `SaveBar` extraction, which is here only because the jscpd gate depends on it. Note in passing that `todo/components.md:171-172` lists `SheetHead` as dead surface to un-export, and it is not — `.design-sync/previews/SheetHead.tsx:2` imports it, and `scripts/deadexports.mjs:34-38` documents exactly this trap. Acting on that line would break the preview.

**`scripts/domsnap.mjs` (200 lines) and `scripts/components.mjs` (505 lines).** Both stay. `BACKLOG.md:417` settles domsnap under "Decided, do not revisit without a reason", and it needs the Vite dev server because `scripts/lib/browser.mjs:113` reads component names off the React fiber tree and throws on a minified bundle. `components.mjs` stays because domsnap execs it.

**`scripts/deadcss.mjs`.** Not replaced by anything. stylelint is per-file and never opens a `.tsx`, so nothing else in the ecosystem does class liveness here.

**dependency-cruiser.** Rejected in §2.1; `layercheck.mjs` is hardened in place instead.

**syncpack.** Rejected; `npm pkg fix` plus `scripts/pkgcheck.mjs` in `chore/package-hygiene` is the substitute.

**typescript-eslint, oxlint `--type-aware`, and `typescript-native-bridge`.** All three are discussed in `typescript7-tooling.md` §8 and none is in this plan. The oxlint path is genuinely interesting because it *wants* TypeScript 7, but evaluating it is separate work.

**Route-level code splitting.** Referenced only as the follow-up the `chunkSizeWarningLimit: 700` comment names.