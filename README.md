<!-- vale Microsoft.Headings = NO -->
# Marinara Console
<!-- vale Microsoft.Headings = YES -->

A standalone management console for [Marinara Engine](https://github.com/luma-inibitor/Marinara-Engine):
power-user tools for lorebooks, presets, and the long-term-memory agent, designed
dense-first for desktop and mobile.

**Read [`design/DESIGN.md`](design/DESIGN.md) before you touch any UI.** It holds
the visual language, the interaction rules, and the component catalog.
The definition of done is the browser suite, `tests/e2e/README.md`. The research
behind it lives at `design/research/`, which sits outside version control, so a
clone won't have it.

## Run

Use the Node version in `.nvmrc`, and switch to it before you install.

```sh
npm install
npm run build
MARINARA_URL=http://<engine-host>:7860 node server.mjs   # serves dist/ on :7872
# engines off loopback gate privileged routes: add MARINARA_ADMIN_SECRET=<secret>
```

Dev loop: `node server.mjs` in one shell (API proxy), `npm run dev` in another
(Vite hot reload on :5173, which proxies /api to :7872). `MC_PROXY_TARGET` and
`MC_DEV_PORT` override those two defaults, so a second pair can target another
engine:

```sh
MARINARA_URL=http://100.x.y.z:7860 PORT=7874 node server.mjs
MC_PROXY_TARGET=http://127.0.0.1:7874 MC_DEV_PORT=5174 npm run dev
```

## Prose

[Vale](https://vale.sh) checks the Markdown docs. Its configuration comes from
the Luma package in
[`luma-inibitor/vale-styles`](https://github.com/luma-inibitor/vale-styles), which
`imagegen` pulls too. The package pins the Google and Microsoft styles. It also
carries the hand-written `Luma` rules, the `Code` rules for comments, and a
shared vocabulary. `.vale.ini` here names the package version, this repo's
vocabulary and the files exempt from linting. Change a rule in the package repo
rather than here.

Treat Vale as advisory: `npm run check` doesn't run it, and the CI job never
blocks a merge.

CI annotates only the lines a pull request touches, which keeps it useful while
the rest of the docs still carry a large backlog. `npm run prosecheck` does the
same locally: it lints the Markdown your branch changed and reports the alerts on
lines you added, so a clean run means clean annotations on the pull request. `npm
run prose` reports on the whole repo.

```sh
brew install vale
npm run prose
```

`.vale/styles/` holds the downloaded Luma package and the Google and Microsoft
packages it pins. It isn't version controlled, so a fresh clone or worktree
starts without it. `npm run prosecheck` runs `vale sync` itself when it finds
the package missing, and stops with a message naming the problem when Vale can't
run at all. `npm run prose` and a bare `vale` need `vale sync` by hand the first
time.

Run `vale sync` again whenever `.vale.ini` names a new package version.

`BACKLOG.md` stays exempt for now. An empty `BasedOnStyles` isn't enough to
exempt a file. The package sets a severity on `Google.Parens`, `Google.Passive`
and `Microsoft.Passive`, and a severity turns its rule on for every Markdown
file. Each exempt section switches those three off by name.

Put a word in the project vocabulary when a rule fires on it but it means
something specific here. Vale skips the vocabulary in every check except
`sequence`, and `Luma.PerfectTense` is a sequence check. To exempt a word from
that rule, edit the rule in the package repo.

Vocabulary lives in `scripts/genvocab.py`, which expands plain word lists into the
patterns Vale wants. Add the word there, re-run the script, commit both files. A
word both repos need belongs in the package's shared list instead.

```sh
python3 scripts/genvocab.py > .vale/styles/config/vocabularies/Marinara/accept.txt
```

Prefer a code span or a fence over a vocabulary entry. Vale already skips both,
and a fenced example fixes the cause rather than the symptom.

## Layout

| path | what |
| --- | --- |
| `server.mjs` | Static server and proxy, built on `sirv` and `http-proxy-middleware`. Strips `embedding` vectors from entry payloads (~85% of bytes), serves `dist/` at `/` and the design mockups at `/mockups/`, preferring the `.br` or `.gz` sibling `scripts/precompress.mjs` wrote where the request accepts it. For the memory tool it rotates a long-term-memory restore point before each run's first write (`.backups/`), stores review decisions (`.state/`), and forwards `MARINARA_ADMIN_SECRET` for engines off loopback |
| `src/` | the console: Vite + Preact + TS, hash routing, tokens-based CSS |
| `tests/e2e/` | the browser suite: the definition of done, written up in `tests/e2e/README.md` — screens, contrast, tap targets, sideways scroll, overlays, keyboard, screen captures. It drives the built bundle at four viewports and answers every request from a fixture corpus |
| `design/` | DESIGN.md, tokens rationale, vendored UI research |
| `scripts/precompress.mjs` | Part of `npm run build`, not a check: writes a `.br` and a `.gz` beside each compressible file in `dist/` for the server to send. `npm run precompress` runs it alone |
| `.vale.ini` | prose lint config: the package version, this repo's vocabulary and its exempt files. The rules live in the Luma package |
| `.prettierrc.json` | formatter config. One setting, `printWidth`. `.prettierignore` names what Prettier stays out of and why: CSS belongs to stylelint, Markdown to Vale, and the vendored engine sources to the engine |
| `.githooks/` | the pre-commit hook, installed by `npm run prepare` through `core.hooksPath`. It formats staged code and holds a commit whose staged Markdown carries any Vale finding |
| `scripts/` | the executable checks that run without a test runner: `components`, an inventory of what returns markup and what each one couples to, `copycatalog`, `layercheck`, `deadcss`, `typescale`, `specificity`, `ratchet`, `pkgcheck`, `prosecheck`, `domsnap`. `domsnap` drives a real browser and takes its harness from `lib/browser.mjs` |
