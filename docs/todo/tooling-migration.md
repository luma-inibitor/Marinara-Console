# Check script migration plan

> Prose here follows the repo's Vale rules (`npm run prose`). Command text,
> file paths and tool output are literal and aren't linted.

## 1. Summary

This plan replaces the special check scripts in `scripts/` with standard tools.

The plan has 29 pull requests. The pull requests are in six waves.
The total work is about 67 hours.
The elapsed time is about 29.5 hours if three or four persons do the work together.
This is four work days. This number includes the time for reviews.

The plan removes about 950 lines from the repository.
The check script code in `scripts/` decreases from 3,774 lines to about 1,940 lines.

The longest chain of dependent work is the browser test track. This chain has four pull requests:

1. `ci/parallel-check-jobs`
2. `chore/playwright-harness`
3. `test/e2e-tap-targets`
4. `chore/retire-verify`

The total work in this chain is 24 hours.

The two decisions in section 2 are complete.
This plan hardens `layercheck.mjs` in the repository. This plan doesn't use dependency-cruiser.
This plan adds `.decisions/README.md` to the repository. The directory `design/research/` stays local.
Nothing in this plan waits on a decision.

---

## 2. Decisions

### 2.1 Rejecting dependency-cruiser, and hardening `layercheck.mjs` instead

**Decision: don't use dependency-cruiser.**
Keep `scripts/layercheck.mjs`. Write it again with `typescript/unstable/*`.

dependency-cruiser needs a second TypeScript installation. This repository must not have one.

The evidence is below:

- In this repository, `require("typescript")` gives only `["version","versionMajorMinor"]`.
- `ts.createSourceFile` is `undefined`.
- The manifest of dependency-cruiser@18.2.0 sets `supportedTranspilers.typescript` to `>=2.0.0 <7.0.0`.
- Thus dependency-cruiser refuses typescript@7 because of the version range.
- The version range refuses typescript@7 even if the API returns.

The file `typescript7-tooling.md:249` gives the decision about a second TypeScript:
*"Do not do it."* That decision stays in force.

The replacement method is in `typescript7-tooling.md:271` section 8.2.
A test in this repository shows these facts:

- `require("typescript/unstable/sync")` gives 44 symbols. The symbols include `Checker`.
- `typescript/unstable/ast` gives 409 symbols.

This method adds no new dependency.
It needs no second lock file, no `tools/` directory, and no `postinstall` script.

This method keeps five functions. A change to dependency-cruiser removes these five functions:

1. The report of the specific import name in a violation.
2. The detection of an unclassified file that imports nothing.
3. The count of files for each directory.
4. The continuation after a parse failure in one file.
5. The exit code 2 for a damaged run.

Merge `chore/eslint-transport-client` in wave 1.
This pull request moves one half of the layer ownership rule into eslint.
eslint is the correct place for this half. This is true for any decision about the other half.

### 2.2 `design/research/` and `.decisions/`

**Decision: complete.**

Two directories are in `.gitignore`. Both directories are absent. Documents refer to both directories.

The evidence is below:

- The command `ls design/research .decisions` gives `No such file or directory` for both.
- `.gitignore:30` excludes `design/research/`.
- `.gitignore:9-10` excludes `.decisions/` two times.
- `design/DESIGN.md:6` has a link to `design/research/dense-ui-survey.md`.
- `README.md:9` says the research is at `design/research/`.
- `README.md:37` says `design/` holds vendored user interface research.
- `CLAUDE.md:20-23` makes `.decisions/` a work rule. It names `.decisions/README.md` as the format.

**For `design/research/`:** keep the directory in `.gitignore`.
Change the three text references. The new text must say that the directory is local only.
`.gitignore:29` already gives the reason.

**For `.decisions/`:** add `.decisions/README.md` to the repository.
Exclude the other files with `.decisions/*` and `!.decisions/README.md`.
A work rule in `CLAUDE.md` isn't a rule if no other person can read its format document.

### 2.3 Prose linting applies to every later wave

Main now runs Vale on pull requests (`.github/workflows/prose.yml`, `filter_mode: added`).
The job is advisory: `fail_on_error: false`, so it never blocks a merge.
But each wave in this plan writes documentation, and each will collect annotations.
Run `npm run prose` before you open a pull request.
Add a new tool name to `scripts/genvocab.py`, then regenerate the vocabulary. Never edit
`accept.txt` by hand.
The Microsoft style requires contractions, so write “doesn't” rather than the long form.

### 2.4 Support for TypeScript 7, tool by tool

A test of each tool occurred. Only dependency-cruiser fails.

| Tool | Result | Evidence |
|---|---|---|
| knip 6 | Good | `npm view knip@6.32.2 dependencies` lists `oxc-parser`, `oxc-resolver`, and 11 more. It doesn't list `typescript`. Its `peerDependencies` is empty. knip@5.88.1 sets `peerDependencies.typescript` to `>=5.0.4 <7` and fails. Use version `^6`. A test installed knip@6.32.2 with typescript@7.0.2 in a copy of the repository. The result was `added 21 packages in 1s`. The tool then made a full report. |
| stylelint 17 | Good | The tool uses PostCSS only. A test installed it. The result was `added 116 packages`. The tool examined real CSS files. It doesn't use typescript. |
| Playwright | Good | The tool has its own Babel transform for `.ts` files. |
| eslint-plugin-i18next | Good | The plugin doesn't need a specific parser. It operates with `@babel/eslint-parser` today. |
| markdown-link-check | Good | The tool reads Markdown files only. |
| jscpd | Good | The tool has its own tokenizer. |
| **dependency-cruiser** | **Not used** | The version range refuses typescript@7. Refer to section 2.1. |

---

## 3. The waves

### Wave 0 — remove the merge conflict point (1 pull request, 3 hours)

**Goal.** Change the `check` script into a structure that accepts new lines.

The `check` script is one line in `package.json`. The line has 184 characters.
The line uses `&&` between each tool. An `awk` command shows this.
Fifteen of the 29 pull requests must change this one line.

**Conditions to complete this wave.**

- The commands `npm run check`, `npm run check:static`, `npm run check:test`, and `npm run check:build` each give exit code 0 on `main`.
- The file `scripts/checks.mjs` has one tool on each line.
- The commands `rm -rf node_modules`, `npm ci`, and `npm run check` give exit code 0 in a new clone.

| Branch | Title | Work | Depends on |
|---|---|---|---|
| `ci/parallel-check-jobs` | Divide the check into parallel jobs and a list with one tool for each line | 3h | — |

`check:static` becomes `node scripts/run-checks.mjs`.
This script reads `scripts/checks.mjs`.
That file holds an array with one npm script name on each line.
It holds seven names, not eight, because `test` is absent by design.
Naming it there would run Vitest twice inside `npm run check`,
and would put the whole suite back into the build system's `static` job.
That's the split this wave exists to make.
The array groups the names by track. Each track has a continuous area in the array.

An addition then becomes one new line, and a removal one deleted line.
Git merges these changes because the areas don't touch.

The `scripts` object in `package.json` is in the order of addition, not alphabetical order.
The present order is `test, dev, build, copycheck, preview, kit, test:watch, typecheck, layercheck`.
This pull request sorts the object one time.
Two pull requests that add different scripts then write to different areas.

No `postinstall` script is necessary.
That script was only for the dependency-cruiser installation.
Section 2.1 removes that need.
Each tool in this plan installs from the top-level `package.json`.
The command `npm ci` is sufficient for each condition in this document.

The file `check.yml` gets `permissions: contents: read` at the workflow level.
It also gets three plain jobs: `static`, `test`, and `build`. A one-entry matrix buys nothing.
It gets a `build` job. The `build` job sends `dist/` to the artifact store.
This wave doesn't add a browser job.

---

### Wave 1 — correct the violations and build the browser test tool (7 pull requests, 19 hours)

**Goal.** Merge each correction and each new test.
Then each tool in wave 2 passes when it arrives.
Also start the longest pull request in the plan.

**Conditions to complete this wave.**

- `npm run check` gives exit code 0.
- Every `what` value is a dotted catalog key, and `tsc --noEmit` rejects a misspelling by name.
  (The earlier wording said this grep must give no result. That can't happen: after the fix the
  values are catalog keys, and emptying the grep would need pointless `what={"..."}` braces.)
- `grep -rn 'import("./toast")' src` gives no result.
- `npx eslint src` gives exit code 0.
- `npx vitest run test/server.test.mjs` passes, and `server.mjs` changes by at most the two
  `MC_DIST`/`MC_PUBLIC` lines. (The suite is 87 tests. The six areas the brief names can't fit in 8.)
- `npx playwright test` passes in the build system as a necessary job.
- `jq -r '.devDependencies|keys[]' package.json | grep playwright` gives only `@playwright/test`.

| Branch | Title | Work | Depends on |
|---|---|---|---|
| `chore/playwright-harness` | Playwright Test on the built preview, with API fixtures and a necessary job | 11h | wave 0 |
| `test/server-conformance` | HTTP conformance tests for `server.mjs` | 3h | wave 0 |
| `refactor/shared-savebar` | One shared `SaveBar` for lorebook entries and preset sections | 1.5h | — |
| `fix/what-prop-copy` | Give the `what` property the copy `Key` type | 1.5h | — |
| `chore/eslint-transport-client` | Move one half of the layer ownership rule into eslint | 1h | — |
| `chore/deadcss-drift` | Test that the `DOMAINS` table stays correct | 0.5h | — |
| `fix/toast-static-import` | Import `toast` statically in `api.ts` and `wire.ts` | 0.5h | — |

#### `chore/playwright-harness`

The work is 11 hours. This is more than the first estimate of 7.25 hours.
This pull request has three parts.

**Part 1: the fixture set.** The first list of six fixtures wasn't correct.
The route `/api/long-term-memory/sources` doesn't exist.
`src/tools/memory/store/sources.ts:15-17` builds that screen from `fetchChats`, `fetchReview`, and `importPreview`.
Four necessary routes were absent from the first list:

- `src/tools/presets/data.ts:219-224` gets `/prompts/${id}/full`. This object holds four collections: `preset`, `sections`, `groups`, and `choiceBlocks`. Each collection goes through a `norm*` function. This is the largest fixture.
- `src/tools/memory/store/scope.ts:49-50` gets `/characters` and `/chats`. It does this each time a memory view starts.
- `src/tools/memory/MemoryTool.tsx:51` calls `refreshLtmStatus()`. Thus each of the three memory views gets `/long-term-memory/status`.
- The memory detail view needs `/long-term-memory/notes/:id`.

The full set is about ten routes.

**Part 2: the schema test is smaller than the first estimate.**
The command `grep -rln Valibot src` gives six files:
`src/copy/shell.json`, `src/shell/wire.ts`, `src/shell/wire.test.ts`, and three files in `src/tools/memory/api/`.
No schema exists for lorebook entries or presets.
So parsing each fixture with the Valibot schemas covers only about half the set.
Write in the pull request text that the tests cover the memory fixtures only.
The other option is worse here. Writing schemas for `Entry`, `PromptPreset` or `PromptSection`
means editing `src/tools/lorebooks/data.ts` plus `src/tools/presets/data.ts`, two files that
other branches in this wave own.

**Part 3: this pull request owns the browser job.**
The job is necessary from the day of the merge.
The first plan put this job in wave 4. That delay was an error.
With that delay, 15 pull requests, and 33.5 hours of work merge while the tests don't operate.
These pull requests include the CSS changes and the text changes.
Those changes are the most probable cause of a test failure.
The deletion of `verify.mjs` isn't a condition for the operation of `test:e2e`.

The job holds the `~/.cache/ms-playwright` cache.
The cache key is `hashFiles('package-lock.json')`.
The job runs `npx playwright install --with-deps chromium-headless-shell`. This is 196 MB.
The full browser is 356 MB.
The job sends the failure artifacts to the artifact store.

This pull request also removes `playwright` and `playwright-core` from `devDependencies`.
It adds `@playwright/test`. That package brings both other packages.
The first plan had a separate pull request for this change.
Both pull requests write to the same two lines at `package.json:50-51`. Thus they conflict.
This change also makes knip correct in wave 2 with no `ignoreDependencies` entry.

Write this note in the pull request text:
a person who runs `npm run check:browser` locally must run `npx playwright install chromium` one time.
The package `playwright-core` doesn't get the browser files.

**Tests for this pull request.**
`npx playwright test` passes for the four viewport projects.
`npx knip --dependencies` doesn't report `playwright`.

#### `test/server-conformance`

This pull request records the behaviour of the present server over real HTTP.
It must come before the new server.

The reason is clear. Unit tests of `stripVectors` and `isLtmWrite` go away with their file.
An HTTP test holds for the old server and the new one alike.

This pull request adds `test/` and `test/fixtures/`.
It makes `vitest.config.ts:10` include `test/**/*.test.mjs`.
It adds a `MC_DIST` and `MC_PUBLIC` option to `server.mjs`. This option is two lines.
The tests then point at the fixtures.
No other pull request in this wave writes to either file.

#### `refactor/shared-savebar`

This pull request must come before the jscpd limit and before the i18next configuration.

A limit at the present value of 0.46% permits the duplicate code.
Also, the deletion of `SectionSaveBar` at `src/tools/presets/PresetsTool.tsx:719-757` removes four i18next findings.
Running the new configuration over the repository shows this.
The four findings are at `PresetsTool.tsx:745`, `:748`, and `:753` two times.

#### `fix/what-prop-copy`

This pull request exports `Key` from `src/copy/index.ts`.
It gives the `what` property the `Key` type on `Loading`, `NotFound`, and `ListEmpty`.

The linter can't correct this group of errors at any setting.
Seven of the twelve `what="…"` errors are one lowercase word.
The word rules that make `mode:"all"` usable must permit those words.
The type system finds what the linter can't find.
`tsc --noEmit` refuses an incorrect key by its name.

#### `chore/eslint-transport-client`

This pull request adds a `no-restricted-imports` block.
The block sets `importNames` to `["api","default"]`.
The block applies to the presentation layer. It doesn't apply to `src/shell/**`.

This pull request is the only owner of `eslint.config.js` in this wave.
The i18next block waits for wave 2.
Then two configuration blocks don't go to the same array end at the same time.

#### `chore/deadcss-drift`

**This pull request replaces `chore/deadcss-domains`. This is a correction.**

The first plan deleted the `DOMAINS` table at `scripts/deadcss.mjs:44-54`.
It then permitted any class with a prefix that occurs in a template string.
A measurement shows the cost of that method.

The repository has 542 CSS class names in `src/`.
That method makes 70 of them permanently invisible to the check.
The 70 names include each `is-*` state name: `is-open`, `is-active`, `is-editing`, `is-selected`, and 50 more.
Only 20 of the 70 names need this help.
The other 50 names are visible today. The check examines them correctly.
Thus that method hides 50 names and gives no advantage.
`deadcss.mjs` is the only check for CSS class use that continues after this migration.

The problem was drift, not the table. Thus correct the drift.

Limit the prefix search to the `className=`, `cls=`, and `surface=` positions.
Don't search each template string in the repository.
Then test that each prefix in those positions has a `DOMAINS` entry.
Exit with code 2 if a prefix has no entry.

A test of this method gives these results:

- The search of class positions finds five prefixes: `dec-`, `is-`, `ln-`, `st-`, and `type-`.
- Each of the five prefixes is already in the table. Thus the test passes today.
- The unlimited search also finds `draft-`, `mut-`, and `note-`.
- Those three are identifier templates at `src/tools/memory/test/factories.ts:28,43,63`. They're not class names.
- Thus with the first method, a test file can hide a full CSS name group.
- The same test shows that `kw-` and `es-` are table entries with no use in a class position.
- Delete `kw-`. Its `.kw-add` and `.kw-edit` classes are literal in `src/tools/memory/ClaimDetail.tsx`.
- Examine `es-` manually. It's inside a second template. The class position pattern can't see it.

Keep the one entry `is-danger-act` in `design/deadcss-baseline.json`.
That file doesn't become empty. The empty file in the first plan was a result of the hidden names.

#### `fix/toast-static-import`

This pull request deletes the dynamic `import("./toast")` at `src/shell/api.ts:45-47` and `src/shell/wire.ts:32-34`.
It also deletes the two comments. The comments say that the dynamic import prevents a cycle.

There is no cycle.
`src/lib/store.ts` imports only `useSyncExternalStore` from react.
Thirteen modules already import `toast` statically.

This pull request must come before `chore/fatal-build-warnings`.
That pull request otherwise carries a configuration change plus a code correction, and fails on the tree it lands on.

---

### Wave 2 — install each new tool next to the old tool (8 pull requests, 24.25 hours)

**Goal.** Operate each new tool next to the tool that it replaces.
The build system then shows equal results one time before any deletion.
Also complete the Playwright test files.

**Conditions to complete this wave.**

- `npx knip` gives no output and exit code 0.
- `npm run typescale` reports `82 literal font-size(s), 40 of them off the scale entirely` and gives exit code 0.
- `npx stylelint "src/**/*.css"` reports exactly 82 problems. Each problem comes from `marinara/font-size-token`.
  The first plan said 89. Wave 2 measured 83. Pull request #76 deleted
  `src/ui/IconButton.css`, which held one literal, and the count became 82.
- `npx eslint src` reports 0 problems with `mode:"all"`.
- `npm run build` gives exit code 0 with fatal warnings.
  Note: the chunk-size line survives the toast fix. `onwarn` receives it as a plugin warning
  from `builtin:vite-reporter`. A `chunkSizeWarningLimit` of 100 makes the build exit 1
  with `Error [RolldownError]: bundler warnings are fatal`.
  A `throw` inside `onwarn` doesn't fail the build. Rolldown swallows it.
  The build then gives exit code 0 and prints no message.
  Thus `onwarn` must collect each warning. `closeBundle` must raise them.
- `npx playwright test` covers the smoke test, contrast, tap targets, overlays, and the keyboard.

| Branch | Title | Work | Depends on |
|---|---|---|---|
| `test/e2e-tap-targets` | Keep the tap target measurement. Compare it with axe | 6.5h | harness |
| `chore/copy-eslint-mode-all` | i18next `mode:"all"`, a JSX text rule, and 23 corrections | 4h | what-prop, savebar |
| `test/e2e-keyboard-overlays` | Move the overlay tests and the keyboard test into test files | 4h | harness |
| `chore/stylelint-typescale` | Replace the special CSS scanner with a stylelint rule | 3.5h | wave 0 |
| `test/e2e-axe-contrast` | Move the contrast tests to axe. Keep the exemption reasons | 3h | harness |
| `chore/knip` | Add knip 6 and `knip.json`. Mark the intentional exports | 1.5h | harness |
| `chore/fatal-build-warnings` | Make bundler warnings fatal with `onwarn` and `closeBundle` | 1h | toast fix |
| `chore/wire-components` | Add `scripts/components.mjs` to `package.json` | 0.75h | — |

#### `test/e2e-tap-targets`

The work is 6.5 hours, not 4 hours.
The statement "about 95 lines move without change" isn't correct.

`scripts/verify.mjs:40` starts with this text:
`const AUDITS = \`((rowSel, exemptions, TAP_PRIMARY, TAP_SECONDARY, TAP_GAP) => {`.
The template string continues to the `page.evaluate` call at `scripts/verify.mjs:337`.
This is one function that operates in the page.
Its `vis`, `clipTo`, and `padBox` helpers are common to four tests:
the tap test, the contrast test, the overflow test, and the density report.
This plan sends those four tests to three different files.
Code inside `page.evaluate` must be complete in itself. Thus a TypeScript module cannot import the helpers.
The work is a division of one function into parts.
Put the common helpers into one complete module. Add it with `addInitScript`.
Each test file then calls that module.

There is a second problem. The first plan didn't find it.

`scripts/verify.mjs:148` grades a small target with this rule:
`secondary: min >= TAP_SECONDARY && !(gap < TAP_GAP)`.
The function `clearance()` at `scripts/verify.mjs:129-141` gives `Infinity` in one condition.
That condition is: no other element is on the same layer and the same `<nav>` side.
With few rows in the fixtures, `!(Infinity < 8)` is true.
Then each small target gets a warning grade, not a failure grade.

Each of the three recorded cases comes from adjacent elements.
`BACKLOG.md:403-411` gives the measurements from a live engine:
`.mem-mid` is 35px with 6.1px clearance, `.row-summary` is 39px with 1px, and `.mseg` is 42px with 2px.

Thus the test for this pull request can't be "the array must hold the nine entries that `verify.mjs` reports today."
That test is only correct if the fixtures have the same row density as the live engine.
Add this condition to `chore/playwright-harness`:
each list screen needs sufficient adjacent rows to give clearance below 8px.
Record the values the fixtures actually give if that proves impossible, and write the reason in the pull request text.

#### `chore/copy-eslint-mode-all`

**This pull request holds the second correction to the first plan.**

The `words.exclude` list makes `mode:"all"` usable.
It decreases the count from 3,038 findings to 27 findings.
But two of its seven patterns permit each lowercase word.
This loses coverage that the rules on `main` have today.

A test used the eslint 9.39.5 of this repository with both configurations.

With the present configuration at `eslint.config.js:44-49`:

```
4:13  error  disallow literal string: <span>keep</span>
5:13  error  disallow literal string: <span>drop</span>
6:46  error  disallow literal string: <button onClick={() => toast("saved")}>ok</button>
7:10  error  disallow literal string: <p>Long-Term Memory</p>
✖ 4 problems
```

With the new `mode:"all"` configuration, `keep`, `drop`, and `ok` give no error.
Only `Long-Term Memory` gives an error.

This loss is real, not theoretical.
`src/copy/*.json` holds 452 strings for the screen. 53 of them have this shape.
Examples are `lorebooks.row.idle` = `"idle"`, `lorebooks.valueYes` = `"yes"`, and `lorebooks.entry.advChanged` = `"changed"`.
`scripts/copycheck.mjs:103-104` refuses this exemption on purpose.
Its comment says that "the bare word `keep` (no separator) [is] **not** [exempt]."

The obvious correction doesn't operate. A test shows this.

Make `/^_*[a-z][A-Za-z0-9]*$/` stricter with a necessary capital letter. Nothing changes.
The reason is the second pattern for routes and classes:
`/^[.#/]{0,1}-{0,2}[a-z0-9]+(?:[_./:-][a-z0-9]+)*\/?$/`.
That pattern also matches `keep`, `drop`, `ok`, `idle`, and `yes`.
Its separator group accepts zero occurrences.

A test of the stricter first pattern alone adds three findings.
Each of the three is incorrect. Each is the string `"__text"` at `src/tools/memory/ClaimDetail.tsx:139,324,354`.
It finds nothing correct.

A test of both stricter patterns gives 254 findings, not 27.
Almost every finding is an enumeration or union value:

- `"mid"`, `"end"`, `"solo"` at `src/tools/presets/data.ts:210`
- `"tree"` at `src/ui/JsonView.tsx:20`
- `"normal"`, `"slow"`, `"stalled"` at `src/ui/Loading.tsx:21-24`
- `"nearest"` at `src/ui/useRovingFocus.ts:89`

This count is too large to use.

The correct method is a second rule in the same configuration block.
The rule matches the JSX text position only. The word rules don't apply there.

```js
"no-restricted-syntax": ["error", {
  selector: 'JSXText[value=/^\\s*[a-z][a-z0-9]*\\s*$/]:not([value=/^\\s*[kst]\\s*$/])',
  message: "bare lowercase JSX text must come from t()",
}],
```

The `:not()` part keeps the `k`, `s`, and `t` unit exemption from `eslint.config.js:48`.

Running the full configuration over the real `src/` gives these results:

- The count stays at exactly 27. There are no new findings.
- The test recovers each of `keep`, `drop`, and `ok`.
- Without the `:not()` part, the rule finds the three unit letters at `src/shell/Toaster.tsx:30`, `src/tools/lorebooks/BookAudit.tsx:405`, and `src/tools/memory/Vault.tsx:213`.
- Thus the selector operates correctly.

This pull request corrects **23 findings**. A run of the full configuration over `src/` gives that count.

The first plan gave 20. It reached that number by this calculation:

- 27 findings in total.
- Subtract the three `what=` properties that `fix/what-prop-copy` removes. They're at `BookAudit.tsx:262,265` and `PresetsTool.tsx:363`.
- Subtract the four strings that `refactor/shared-savebar` removes. They're at `PresetsTool.tsx:745,748,753,753`.

That calculation is incomplete. It leaves out the exclusions that the configuration also needs.
One of them is a block for test files. It turns off `i18next/no-literal-string` and `no-restricted-syntax` there.
A fixture string reaches no reader.
Use the measured count of 23. Don't use the calculation.

Nineteen of the 23 corrections are a change to a key. The finding gives the key name.
The other four are a literal that no reader sees.
Examples are `this.name = "ApiError"` at `src/shell/api.ts:18` and `window.matchMedia("(min-width: 900px)")` at `src/tools/presets/PresetsTool.tsx:185`.
Each of those four carries a disable comment with a reason.

#### `test/e2e-keyboard-overlays`

Don't delete `scripts/overlaycheck.mjs` or its npm script in this pull request.
The first plan deleted them. That was an error.

`package.json` sets `"check:browser"` to `"npm run verify && npm run overlaycheck"`.
A deletion of one half in wave 2 leaves `npm run check:browser` with a failure for a full wave.
The failure text is `npm error Missing script`.

The deletion moves to `chore/retire-verify`. That pull request already removes the script.
Thus this pull request doesn't write to `package.json`.

#### `chore/stylelint-typescale`

This pull request keeps `design/typescale-baseline.json` and `scripts/lib/baseline.mjs`.
The `--suppress` option of stylelint counts findings.
Thus it permits one correction together with one new violation. A test shows this.

The two tools give the same set of findings, except for one baseline key.
The old scanner reads characters. It resets its selector buffer at a `;`.
The header comment of `src/tools/memory/components/NoteRef.css` holds a `;`.
Thus the old scanner records the selector as `this file owns the default. */ .notelink`.
PostCSS gives `.notelink`. This is a defect in the outgoing scanner.
Correct the key in `design/typescale-baseline.json` in this pull request.

There are two changes to the first plan.

**Change 1: the adapter must not hide a parse failure.**
`scripts/typescale.mjs:45-46` says that exit code 2 means a damaged check.
It says that a damaged check must never look like a pass.
A filter on the rule name breaks this.

A test installed stylelint@17 and used a CSS file with an error:

```
broken.css | errored: true | parseErrors: 0
   rule= CssSyntaxError text= Unclosed block (CssSyntaxError)
good.css | errored: true | parseErrors: 0
   rule= declaration-property-value-allowed-list text= Disallowed value "13px" for property "font-size"
adapter (rule-name filter) sees: 1
```

Note that `parseErrors` is `0`. The array is empty.
Thus the test must be `res.warnings.some(w => w.rule === "CssSyntaxError")`.
The test must not be `res.parseErrors?.length`.
Put each such failure into the integrity array. The run then gives exit code 2.

**Change 2: this pull request must add the `csslint` script now.**
The first plan gave this option: leave the script out, because `npm run typescale` uses the full configuration.
The measurement earlier in this section shows otherwise.
The adapter removes each warning with a rule name that's not `marinara/font-size-token`.
Add `"csslint": "stylelint \"src/**/*.css\""`. Add one line to `scripts/checks.mjs`.
The wave 3 rules then have a place to operate.

#### `chore/knip`

Merge this pull request after the Playwright work.
Then `tests/e2e/` and `playwright.config.ts` exist. Their entry rules get written one time.

The `ignore` array accepts new lines. Each line holds one path.
Each later pull request that needs an ignored path adds its own line.

One finding from the first plan is now void.
Section 2.1 removes dependency-cruiser. Thus no `.dependency-cruiser.cjs` file exists.
The knip plugin never starts. Nothing needs an `ignore` entry for it.
This was the finding:

```
Unused files (1)
.dependency-cruiser.cjs
```

This still applies: an npm script that calls the `lychee` program gives `Unlisted binaries (1)`.
This is one of the two reasons for `markdown-link-check` in wave 5.
`jscpd` gives the same finding until it becomes a real `devDependency`. That occurs in wave 3.
knip also reports `Unlisted binaries (1): vale`, from main's `prose` script. That one is main's,
not any branch's, but it lands in the same report.

Order note: don't put a path into `ignore` before the path exists.
knip then gives a `Configuration hints` line with the text `<path> knip.json Remove from ignore`.
A hint doesn't fail the build. But each pull request must add its own line.

---

### Wave 3 — delete the old scripts (6 pull requests, 11.5 hours)

**Goal.** Delete each special script. Its replacement operated correctly for one full wave.

**Conditions to complete this wave.**

- The command `ls scripts/deadexports.mjs scripts/layercheck.mjs scripts/copycheck.mjs scripts/verify.mjs scripts/overlaycheck.mjs scripts/faceprobe.mjs` shows that each file is absent.
- The command `ls scripts/lib/baseline.mjs scripts/lib/imports.mjs scripts/deadcss.mjs scripts/components.mjs scripts/domsnap.mjs` shows that each file is present.
- `npm run check` gives exit code 0.
- `node scripts/copycatalog.mjs` reports `496 coined strings · 1171 product keys` and gives exit code 0.
- `npm run jscpd` reports 3 duplicates at 0.19%.
- The command `git log --oneline main -- scripts/checks.mjs` shows the order. Each new tool line comes at least one merge before the deletion of its old tool line.

| Branch | Title | Work | Depends on |
|---|---|---|---|
| `chore/retire-verify` | Delete `verify.mjs`, `overlaycheck.mjs`, `shots.mjs`, `faceprobe.mjs`. Write DESIGN.md section 7 again | 3.5h | the three test pull requests |
| `chore/layercheck-harden` | Write `layercheck.mjs` again with `typescript/unstable/*` | 3h | eslint block |
| `chore/copycheck-to-copycatalog` | Delete `copycheck.mjs`. Keep the catalog test in 84 lines | 2.5h | mode:"all" |
| `chore/stylelint-hygiene` | Fifteen rules and the four real duplicate selectors | 1h | typescale |
| `chore/jscpd` | Limit duplication to 0.3% | 1h | savebar |
| `chore/drop-deadexports` | Delete `scripts/deadexports.mjs`. Use knip | 0.5h | knip |

#### `chore/retire-verify`

This pull request owns these documents in this wave:
`README.md`, `CLAUDE.md`, `design/DESIGN.md`, `design/BRIEFING.md`, and `design/CHECKLIST.md`.

It deletes four files:
`scripts/verify.mjs` (426 lines), `scripts/overlaycheck.mjs` (88 lines),
`scripts/shots.mjs` (50 lines), and `scripts/faceprobe.mjs` (49 lines).
It removes the `verify`, `overlaycheck`, `faceprobe`, and `check:browser` npm scripts.

It must also delete two exports from `scripts/lib/browser.mjs`.
The first plan said that this file has no changes. That was an error.
Only `domsnap.mjs:17` still imports it once those four users go, and knip then reports a failure.
A test gives this result:

```
Unused exports (9)
loadBaseline    function  scripts/lib/baseline.mjs:16:17
ALL_VIEWPORTS             scripts/lib/browser.mjs:26:14
openPage        function  scripts/lib/browser.mjs:49:23
...
```

`ALL_VIEWPORTS` and `openPage` are new relative to the wave 2 count of seven.
Delete both in the same commit. Or mark them `/** @public */` if they must stay.
Add `scripts/lib/browser.mjs` to the file list for this pull request.

Don't delete `shots.mjs` without a replacement.
`design/MOCKUP-KIT.md:48` and `design/DESIGN.md:342` tell a person to use it for mockup screen captures.
Move its four viewport loop into `tests/e2e/shots.spec.ts`.
Protect the test with `test.skip(!process.env.MC_SHOTS)`. Read the address from `MC_SHOT_URL`.
Correct both documents.

`design/ARCHITECTURE.md:46` says that `layercheck.mjs` finds a write to a store from a `.tsx` file.
A read of each of the 323 lines shows no such test.
`chore/layercheck-harden` corrects that sentence. That pull request owns `ARCHITECTURE.md` in this wave.
That file sits outside the set listed earlier, so the two pull requests can run together.

#### `chore/layercheck-harden`

This pull request replaces the Babel front end of `layercheck.mjs`.
It uses `typescript/unstable/ast` and `typescript/unstable/sync`.
It keeps the file, its two rules, its exit codes, and its count for each directory.

The advantage over the present code is resolution.
Today the decision about a type-only import is a guess from the Babel syntax.
With the real checker, the decision becomes a resolved fact.
`tsconfig.json:12-15` sets `verbatimModuleSyntax` for this purpose.

The test set is `scripts/fixtures/layercheck/**` and `scripts/layercheck.test.mjs`.
Each fixture directory name states its violation.
Each fixture must still fail for the same reason with the same message.

This pull request is the only owner of `design/ARCHITECTURE.md` in this wave.

#### `chore/copycheck-to-copycatalog`

This pull request deletes 784 lines. It also deletes `design/copy-baseline.json`.
That file holds only `_areas`. It hides nothing today.

It adds `scripts/copycatalog.mjs`. The new file has 84 lines.
The file tests only what the program doesn't test at run time:

1. The shape of each entry.
2. The length of each coinage note.
3. Two console entries with the same text.
4. A coinage with text that already exists in `src/copy/vendor/ltm-en.json`.
5. A `despite` value that resolves and that gives a real conflict.

It also adds `src/copy/copy.test.ts`. That file has five lines.
The reason is important.
The dev-only assertions at `src/copy/index.ts:104-122` operate in the build system today.
They operate only because two unrelated store tests import the module.
One change to those tests removes the assertions with no message.

#### `chore/drop-deadexports`

This pull request must **not** delete `scripts/lib/baseline.mjs`.
`scripts/typescale.mjs:51` and `scripts/deadcss.mjs:32` import it.
This plan has no replacement for `deadcss`. Thus `baseline.mjs` continues after the migration.
The same is true for `scripts/lib/imports.mjs`. `components.mjs:71` imports it.

The deletion leaves a reference to `scripts/deadexports.mjs` in four files this pull request doesn't own.
`design/ARCHITECTURE.md` describes the script and its baseline ratchet.
`docs/architecture-prose` rewrites that document and keeps the paragraph on purpose.
The reason is that `deadexports` is still a live blocking check on that branch.
A document has to be true of the tree it ships with.
So whichever of the two pull requests lands second must delete the paragraph in the same change.
`design/BRIEFING.md:211` lists `node scripts/deadexports.mjs` as a command a person runs.
`chore/retire-verify` owns that file in wave 3, and the head of that branch still holds the row.
Delete the row there.
`tests/e2e/contrast.spec.ts:26` names the `deadcss/deadexports` shape in a comment about its own baseline.
`test/e2e-axe-contrast` owns that file and the reference is still at its head, so the correction belongs there.
`scripts/lib/baseline.mjs:50` gives `deadexports src/ui` as an example inside a comment.
`fix/baseline-ghosts` and `chore/css-cross-sheet` both write to that file, so the correction belongs to whichever lands first.
`chore/deadcss-drift` doesn't: it has no commits ahead of main, and its own plan section scopes it to `scripts/deadcss.mjs`.
`linkcheck` reports neither Markdown reference, because each one is inline code rather than a Markdown link.
It never opens `scripts/lib/baseline.mjs`, because `package.json:23` hands it `README.md`, `CLAUDE.md`, `BACKLOG.md` and `design/*.md` only.

This pull request adds no check to replace the listing `deadexports` printed.
`deadexports` named every baseline finding on every run and suppressed only the exit code.
knip prints nothing about an export that carries a `/** @public */` tag.
`npx knip --exports --tags=+public` prints nothing either, so knip offers no way to list the tagged exports.
A reader who wants the list runs `grep -rn -A1 '@public' src`, which prints each tag with the line below it.
The tree carries seven tags today, in `src/ui/ListGroup.tsx`, `src/ui/icons.tsx`, `src/ui/index.ts` and `src/tools/memory/detail/model.ts`.

This pull request also corrects `docs/todo/components.md:184-185`.
Both statements there are wrong.
`deadexports.mjs` does examine exported types. Its header at `scripts/deadexports.mjs:15-19` says so.
Each of the five named types is already in `design/deadexports-baseline.json:6-18`.

---

### Wave 4 — the new server and the remaining corrections (3 pull requests, 6.75 hours)

**Goal.** Complete the server. Each pull request writes to a file that a wave 3 pull request owned.

**Conditions to complete this wave.**

- `npx vitest run test/server.test.mjs` passes for the new server. Only the `.ico` and `.txt` assertions change.
- `curl -sD- localhost:7872/assets/index-<hash>.js` shows `cache-control: public,max-age=31536000,immutable`.
- `curl -sD- localhost:7872/index.html` shows `no-store`.
- A second request with `If-None-Match` gives status 304.
- `node scripts/pkgcheck.mjs` reports `package.json clean`.
- `design/css-collisions-baseline.json` holds the `.toaster` and `bottom` pair.
- `node scripts/deadcss.mjs` gives exit code 0.

| Branch | Title | Work | Depends on |
|---|---|---|---|
| `chore/server-sirv-proxy` | Build the static server and proxy on sirv and http-proxy-middleware | 4h | the conformance tests |
| `chore/css-cross-sheet` | Add cross-file declaration conflicts to `deadcss.mjs` | 2h | deadcss-drift, hygiene |
| `chore/package-hygiene` | Correct `package.json` and `.gitignore`. Test with `pkgcheck` | 0.75h | — |

#### `chore/server-sirv-proxy`

This pull request owns `README.md` in this wave.
It must correct two statements that become wrong.
`README.md:35` calls `server.mjs` a "zero-dep proxy."
`design/ARCHITECTURE.md:13` calls it "a dependency-free proxy."

Three test results are important. Write them in the pull request text.

1. The `responseInterceptor` of `http-proxy-middleware` holds each response in memory.
   It does this for each content type.
   Thus it repeats the 595 MB memory fault that this work corrects.
   The `embedding` removal must be a manual `on.proxyRes` handler with a content type test.
2. `on.proxyReq` can't wait for an asynchronous operation.
   The request goes to the engine about 3 ms after the start.
   An asynchronous handler completes about 300 ms later.
   Thus the restore point stays an `await` in the `node:http` handler. It runs before the middleware.
3. sirv needs `dev: true`.
   Its default setting reads the directory one time at start.
   Then a `npm run build` during operation gives status 404 for each new file.

#### `chore/css-cross-sheet`

This is the only test in the plan that finds the `.toaster` fault.
That fault is four different `bottom` values for one element.
The values are at `src/styles/lorebooks.css:253,256` and `src/styles/presets.css:255,256`.
The stylesheet load order decides the result.
stylelint examines one file at a time. Thus it reports nothing for this fault.

Use the form that compares a selector and a property together.
That form gives 23 findings at four real places.
The simple form compares a class name in two files. That form gives 65 findings and isn't useful.

Use a record file. Don't correct each of the 23 findings in this pull request.
That gate condition then becomes possible to meet.

#### `chore/package-hygiene`

This pull request isn't the last one to write to `package.json`. Wave 5 has two more.
The correct reason for its position is different.
It must come after the last dependency addition and after the last change to its four fields.
Wave 4 meets both conditions.

Note that `npm pkg fix` alone changes nothing in this file.
The real work is `npm pkg delete main description keywords author`.
Then declare the licence with `npm pkg set license=UNLICENSED`.
The deletion of `main` also removes the last knip configuration hint.

`.gitignore` repeats `shots/` (lines 5 and 24).
It repeats `.decisions` (lines 9 and 10).

---

### Wave 5 — the last two pull requests (2 pull requests, 2.5 hours)

**Conditions to complete this wave.**

- `npm run linkcheck` reports 0 dead links.
- On a built tree, `curl -sD- -H 'accept-encoding: br' localhost:7872/assets/index-<hash>.js` returns `content-encoding: br` and `vary: accept-encoding`.
- A request with an empty `accept-encoding` gives the file without compression.

| Branch | Title | Work | Depends on |
|---|---|---|---|
| `perf/precompress-dist` | Compress `dist/` to `.br` and `.gz` files for sirv | 1.5h | the new server |
| `chore/linkcheck` | Correct the broken path references. Add `markdown-link-check` | 1h | — |

#### `chore/linkcheck`

Use `markdown-link-check`. Don't use lychee.
A test of `markdown-link-check` in this repository with node 24.19.0 gives this result:

```
ERROR: 1 dead link found in design/DESIGN.md !
[✖] research/dense-ui-survey.md → Status: 400
```

The tool gives exit code 1 for a dead link and exit code 0 for no dead link.
It has an `ignorePatterns` option for offline operation. It installs 69 packages.
It's an npm package. Thus knip sees the program in the package list.
There is no external GitHub Action to pin.
lychee needs `lycheeverse/lychee-action`. That's a new supply chain risk.
lychee also gives a permanent `Unlisted binaries` finding in knip.

Be honest about the value of this test.
The command `grep -rhoE '\]\([^)]+\)' README.md CLAUDE.md BACKLOG.md design/*.md` gives five links.
One link is external. One link is dead. Three links are correct.
Thus the test examines three correct links.

The reason to keep the test is different.
The correction changes the path references at `README.md:9`, `README.md:37`, and `CLAUDE.md:20-23`.
Those references become real Markdown links.
Then any link tool can see them in the future.

You can take the document corrections and remove the test.
That's a reasonable decision. It saves 30 minutes and one entry in `check:static`.

#### `perf/precompress-dist`

A measurement gives this result:
`index-CrxHehqs.js` decreases from 666,225 bytes to 156,754 bytes with brotli quality 11.

---

## 4. Lost coverage

This is the section to scrutinise. It hides nothing.

### Losses that are acceptable

**Lowercase words outside JSX text.**
With the `no-restricted-syntax` rule, `<span>keep</span>` still gives an error.
But `title="keep"`, `toast("saved")`, and `{cond ? "keep" : "drop"}` don't give an error.
The word rules apply to each position in `mode:"all"`.
`src/copy/*.json` holds 452 strings for the screen. 53 of them have this shape.
A measurement of the alternative gives 254 findings, not 27. Almost each is an enumeration value.
`scripts/copycatalog.mjs` still controls the registration of such a string.
The `what: Key` type is the general answer for a property.

**Four attributes that hold text.**
`scripts/copycheck.mjs:400-404` examines eight attributes:
`aria-label`, `aria-description`, `aria-placeholder`, `aria-valuetext`, `aria-roledescription`,
`title`, `placeholder`, and `alt`.
`eslint-plugin-i18next` has a fixed list of five at
`node_modules/eslint-plugin-i18next/lib/helper/index.js:15`:
`['placeholder','alt','aria-label','value','title']`.
It ignores each other attribute on a DOM element. It does this before it reads the `jsx-attributes` option.
A test confirms that `<span aria-valuetext="3 of 8" />` gives no error.
No file uses the four missing attributes today.
The command `grep -rn 'aria-description\|aria-placeholder\|aria-valuetext\|aria-roledescription' src` gives no result.
But the loss becomes permanent.
A second `no-restricted-syntax` selector corrects this. It costs three lines.

**Sentence reconstruction.**
`scripts/copycheck.mjs:410-425` builds a full sentence from `<>adds to <Skey/> of {ref}</>`.
It then compares the sentence with the catalog text `"adds to {{section}} of {{ref}}"`.
That code removes findings. It doesn't create findings.
`mode:"all"` reports each part as its own finding. That's stricter, not weaker.

**The copycheck HTML mode and its record file.**
`scripts/copycheck.mjs:598-620` operates only with an `.html` path.
No script in `package.json` and no build job gives such a path.
`design/copy-baseline.json` holds only `_areas`. It has no file entries.
Nothing uses either part.

**The `@copy-strict` marker.**
Its two files are `src/tools/lorebooks/data.ts` and `src/tools/presets/data.ts`.
Neither file holds an English string. Thus the marker does nothing today.

**Three deadexports findings and the count for each directory.**
knip counts an exported type as used when a used export names it in a signature.
This is a rule, not a fact about three symbols.
Every exported type of that shape stays invisible, the ones written later included.
`FacetGroup`, `PickerOption`, and `DisclosureOption` were the instances on the tree at the time.
Each of the three occurs in the property type of the exported component next to it.
`FacetValue` and `FacetLine` occur only inside another type. knip still finds them.
No knip option closes this gap. `npx knip --trace-export DisclosureOption` prints `(no imports found)` and a tick.
knip has no equivalent of the `deadexports` table.
That table gives lines such as `src/ui  30 files  117 exports  9 used only in their own file`.
Nothing replaces that table.
`scripts/components.mjs` prints a component inventory with an `exp` and a `refs` column for each component.
It prints no export count and no over-export count for each directory.
knip finds two items that `deadexports` can't find.
The reason is that `deadexports` searches `/\.tsx?$/` in `src/` only.
The two items are `testKeyword` at `src/lib/lorebook-keyword-matching.js:30`
and `loadBaseline` at `scripts/lib/baseline.mjs:16`.

**Star re-exports.**
`scripts/deadexports.mjs:164` examines nothing under a star re-export. This is on purpose.
knip follows them. This is different, not worse.

**The `font` shorthand property.**
`src/ui/JsonView.css:67` declares `font: inherit`, a size the scale can't name.
The old scanner doesn't find it. The stylelint rule doesn't find it.
Thus the coverage doesn't change.

**Compression at run time, and `If-Modified-Since`.**
The server sends only the compressed files that already exist, once `perf/precompress-dist` merges.
A new file in `public/mockups/` goes without compression until the script operates again.
sirv supports `If-None-Match`. It doesn't support `If-Modified-Since`.
The present server supports neither. Thus this is still an improvement.

**Generated content, placeholder contrast, and the two-level tap rule.**
axe doesn't examine `::before`, `::after`, or `::placeholder` text.
axe can't express the rule `>=44 OR (>=24 AND edge-gap>=8)`.
Its `any: [target-size, target-offset]` is an OR condition.
This plan keeps the special measurement in `test/e2e-tap-targets`. Thus it doesn't lose these tests.
But the measurement has the fixture density condition in wave 2.

**The `data-contrast-exempt` warning.**
`scripts/verify.mjs:264` gives a warning for an element with the attribute and no list entry.
With axe, an element with no list entry gets a normal measurement.
The result is the same, but nobody learns that the attribute does nothing.
About six lines of code recover this warning.

### The layer rule loses nothing

This was the largest item in the first plan. Section 2.1 removes it.

`layercheck.mjs` keeps each of these five functions:

1. The report of the specific import name, such as `imports { SECTION_CAP } from "../api/types"`.
2. The continuation after a parse failure in one file.
3. The detection of an unclassified file that imports nothing.
4. The count of files for each directory.
5. The exit code 2 for a damaged run.

dependency-cruiser gives only the pair of file names. It doesn't give the import name.

### Losses to examine a second time

**`shots.mjs` as a mockup screen capture tool.**
The move to a test file keeps the function. But the command changes.
Two design documents give the old command.
A 40-line command line program is better if the test form is difficult for one address.

**The jscpd limit and its exclusions.**
The limit is 0.3%. The repository is at 0.19%.
Thus about twelve duplicate lines can occur without a report.
Three real duplicates stay below the limit:

- `entries.tsx:63` and `PresetsTool.tsx:593` (10 lines).
- `BookAudit.tsx:309` and `PresetsTool.tsx:409` (8 lines).
- `Review.tsx:217` and `Review.tsx:248` (6 lines).

The configuration excludes test files.
Thus it doesn't report the 14-line duplicate between `facets.test.ts:17` and `flags.test.ts:13`.
With test files, the value goes from 0.19% to 0.50%. The limit then has no use.
The configuration excludes CSS files.
Thus it doesn't report `RetrievalCard.css:51` and `SectionRow.css:72`.

**The chunk size warning has a limit of 700 KB.**
Vite gives this warning through the reporter plugin logger.
`onwarn` receives it. Thus a bundle larger than 700 KB fails the build.
But the bundle is 684 KB today. So the limit gives about 16 KB of room.
`src/` has no `React.lazy` call today.
A division by route is a new feature, not a build system change.

**The rule `no-descending-specificity` is off on purpose.**
It gives 16 findings. Each finding is advice about order. No person will act on it.
The rule `at-rule-no-unknown` is off. It gives an incorrect error for the Tailwind v4 `@theme` at `src/styles/theme.css:14`.

**No test finds the `.rail-cell` division.**
`src/styles/lorebooks.css:79` holds the only base rule.
`src/styles/presets.css:54,58` hold only descendant rules.
Thus one tool holds the base rule and another tool holds the variants.
This isn't a duplicate definition.
`no-duplicate-selectors` doesn't report it. The cross-file test doesn't report it.
The general test that finds it gives 65 findings. It includes `.is-open` across five files.
`eslint.config.js:18-19` gives the reason to avoid that quantity of noise.

### The loss that the first plan almost introduced

The prefix rule for `deadcss` makes 70 of 542 class names permanently invisible.
The check examines 50 of those names correctly today.
The drift test in `chore/deadcss-drift` loses nothing.
It also reports one unused table entry, `kw-`.
Refer to wave 1.

---

## 5. Conflict points

**`package.json`, the `check` line.**
Fifteen pull requests must change one line of 184 characters.
Wave 0 replaces the line with `scripts/checks.mjs`.
That file holds one script name on each line, in groups by track.
Then each addition is one new line. Each removal is one deleted line in a different area.

**`package.json`, the `scripts` object.**
The object is in the order of addition, not alphabetical order.
Thus two pull requests that add scripts write to adjacent lines.
Wave 0 sorts the object one time.
The first plan didn't list two pairs:
`chore/knip` with `chore/wire-components` in wave 2,
and `chore/jscpd` with `chore/copycheck-to-copycatalog` in wave 3.

**`package-lock.json`.**
Additions to `devDependencies` are separate lines in a sorted object. Git merges them.
Git doesn't merge the lock file. Never merge it manually.
For a conflict, use these steps:

1. Take the lock file from `main`.
2. Run `npm install <the one package for this pull request>`.
3. Commit the new lock file.

Wave 2 has two pull requests that add a dependency: knip and stylelint.
Merge them some hours apart.

**`.github/workflows/check.yml`.**
Three pull requests own this file, one for each wave:

- `ci/parallel-check-jobs` in wave 0.
- `chore/playwright-harness` in wave 1. It adds the necessary browser job.
- `chore/retire-verify` in wave 3. It points the job at `test:e2e`.

`chore/retire-verify` must change the file. It deletes the script that the job calls.

**`knip.json`.**
The `ignore` array accepts new lines. Each line holds one path.
Each pull request that needs an ignored path adds its own line.
Don't add a path before the pull request that creates it.
This avoids the `Remove from ignore` configuration hint.
`ignoreBinaries` is empty. Wave 5 uses `markdown-link-check`, which is an npm package.

**`README.md` (line 9, plus lines 35 to 38).**
Four pull requests write inside the three-line context window of git.
Thus one pull request owns the file in each wave:

- `chore/wire-components` in wave 2.
- `chore/retire-verify` in wave 3.
- `chore/server-sirv-proxy` in wave 4.
- `chore/linkcheck` in wave 5.

**`design/*.md` and `CLAUDE.md`.**
Divide these by file, not by wave.
`chore/layercheck-harden` writes only to `design/ARCHITECTURE.md`, sections 1, 2, 5, and line 46.
`chore/retire-verify` owns `DESIGN.md`, `BRIEFING.md`, `CHECKLIST.md`, and `CLAUDE.md`.
Thus the two can operate together in wave 3.
`chore/server-sirv-proxy` writes to `ARCHITECTURE.md:13` one wave later. That's a different section.

**`src/tools/presets/PresetsTool.tsx`.**
Three pull requests write to this file of 758 lines.
`refactor/shared-savebar` deletes lines 719 to 757.
`fix/what-prop-copy` writes to lines 70, 147, 148, 363, 365, and 465.
These two share wave 1 because the areas are far apart.
`chore/copy-eslint-mode-all` waits for wave 2.
That delay also removes four of its own findings.

**`eslint.config.js`.**
`chore/eslint-transport-client` and `chore/copy-eslint-mode-all` both add a block to the same array end.
Put them in wave 1 and wave 2.
Don't try to merge two configuration additions together.

**`src/styles/memory.css` and `src/styles/lorebooks.css`.**
`chore/stylelint-hygiene` joins the four duplicate selectors in wave 3.
`chore/css-cross-sheet` corrects the 23 conflicts in wave 4, after the join.

**`scripts/deadcss.mjs` and `scripts/lib/baseline.mjs`.**
The two changes to `deadcss.mjs` go in wave 1 and wave 4.
For `baseline.mjs`, the rule is a deletion ban, not a merge order.
`chore/drop-deadexports` must not delete it.
`typescale.mjs:51` and `deadcss.mjs:32` still import it. `deadcss` has no replacement in this plan.
The same rule applies to `scripts/lib/imports.mjs`. `components.mjs:71` still imports it.

---

## 6. Work that this plan excludes

**Search libraries.** uFuzzy and MiniSearch are in the backlog. This plan doesn't change the search.

**Component work.** `docs/todo/components.md` holds this work.
The one exception is the `SaveBar` extraction. It's in this plan because the jscpd limit needs it.

**`scripts/domsnap.mjs` (200 lines) and `scripts/components.mjs` (505 lines).**
Both files stay.
`BACKLOG.md:417` puts domsnap under "Decided, don't revisit without a reason."
domsnap needs the Vite development server.
`scripts/lib/browser.mjs:113` reads component names from the React fiber tree.
That code fails on a minified bundle.
`components.mjs` stays because domsnap calls it.

**`scripts/deadcss.mjs`.** No tool replaces it.
stylelint examines one file at a time and never reads a `.tsx` file.
No other tool tests CSS class use in this way.

**dependency-cruiser.** Section 2.1 gives the decision.
`layercheck.mjs` gets the improvement instead.

**syncpack.** This plan doesn't use it.
`npm pkg fix` and `scripts/pkgcheck.mjs` in `chore/package-hygiene` do this work.

**typescript-eslint, oxlint `--type-aware`, and `typescript-native-bridge`.**
`typescript7-tooling.md` section 8 examines each of the three. This plan uses none of them.
The oxlint option is interesting because it needs TypeScript 7. But it's separate work.

**Code division by route.**
The comment for `chunkSizeWarningLimit: 700` names this as the next step.
