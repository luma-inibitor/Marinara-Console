<!-- vale Microsoft.Headings = NO -->
# Marinara Console
<!-- vale Microsoft.Headings = YES -->

A standalone management console for [Marinara Engine](https://github.com/luma-inibitor/Marinara-Engine):
power-user tools for lorebooks, presets, and the long-term-memory agent, designed
dense-first for desktop and mobile.

**Before you touch any UI, read [`design/DESIGN.md`](design/DESIGN.md).** It holds
the design framework, owner preferences, and the definition of done. The research
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

[Vale](https://vale.sh) checks the Markdown docs. It reads the Microsoft style
plus a small local style in `.vale/styles/Luma/`. Treat it as advisory: `npm run
check` doesn't run it, and the CI job never blocks a merge.

CI annotates only the lines a pull request touches, which keeps it useful while
the rest of the docs still carry a large backlog. `npm run prosecheck` does the
same locally: it lints the Markdown your branch changed and reports the alerts on
lines you added, so a clean run means clean annotations on the pull request. `npm
run prose` reports on the whole repo.

```sh
brew install vale
vale sync          # fetch the Microsoft package into .vale/styles (gitignored)
npm run prose
```

`BACKLOG.md` and `design/DESIGN.md` stay exempt for now. Every rule stays on
repo-wide. When a rule fires on a word that means something specific here, put
the word in the project vocabulary, which Vale skips in every check.

`.vale/styles/Luma/` holds hand-written rules, which `vale sync` leaves alone.
One comes from `ASD-STE100`, the Simplified Technical English standard, and
catches the perfect tenses, which neither Google nor Microsoft check. It matches
on part-of-speech tags rather than on spelling, so `has a value` stays quiet.

One caveat matters here. The vocabulary doesn't apply to that rule, because Vale
skips vocabulary terms for every check except `sequence`. To exempt a word from
it, edit the rule.

Vocabulary lives in `scripts/genvocab.py`, which expands plain word lists into the
patterns Vale wants. Add the word there, re-run the script, commit both files:

```sh
python3 scripts/genvocab.py > .vale/styles/config/vocabularies/Luma/accept.txt
```

Prefer a code span or a fence over a vocabulary entry. Vale already skips both,
and a fenced example fixes the cause rather than the symptom.

## Layout

| path | what |
| --- | --- |
| `server.mjs` | Static server and proxy, built on `sirv` and `http-proxy-middleware`. Strips `embedding` vectors from entry payloads (~85% of bytes), serves `dist/` at `/` and the design mockups at `/mockups/`, preferring the `.br` or `.gz` sibling `scripts/precompress.mjs` wrote where the request accepts it. For the memory tool it rotates a long-term-memory restore point before each run's first write (`.backups/`), stores review decisions (`.state/`), and forwards `MARINARA_ADMIN_SECRET` for engines off loopback |
| `src/` | the console: Vite + Preact + TS, hash routing, tokens-based CSS |
| `tests/e2e/` | the browser suite: the definition of done in DESIGN.md §7 — screens, contrast, tap targets, sideways scroll, overlays, keyboard, screen captures. It drives the built bundle at four viewports and answers every request from a fixture corpus |
| `design/` | DESIGN.md, tokens rationale, vendored UI research |
| `scripts/precompress.mjs` | Part of `npm run build`, not a check: writes a `.br` and a `.gz` beside each compressible file in `dist/` for the server to send. `npm run precompress` runs it alone |
| `.vale.ini` | prose lint config: Microsoft style, exemptions in the vocabulary rather than rule switches |
| `.prettierrc.json` | formatter config. One setting, `printWidth`. `.prettierignore` names what Prettier stays out of and why: CSS belongs to stylelint, Markdown to Vale, and the vendored engine sources to the engine |
| `.githooks/` | the pre-commit hook, installed by `npm run prepare` through `core.hooksPath`. It formats staged code and holds a commit whose staged Markdown carries any Vale finding |
| `scripts/` | the executable checks that run without a test runner: `components` (inventory of what returns markup, and what each one couples to), `copycatalog`, `layercheck`, `deadcss`, `typescale`, `specificity`, `pkgcheck`, `prosecheck`, `domsnap`. `domsnap` drives a real browser and takes its harness from `lib/browser.mjs` |
