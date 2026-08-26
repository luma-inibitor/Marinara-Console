# Marinara Console

A standalone management console for [Marinara Engine](https://github.com/luma-inibitor/Marinara-Engine):
power-user tools for lorebooks, presets, and the long-term-memory agent, designed
dense-first for desktop and mobile.

**Before touching any UI, read [`design/DESIGN.md`](design/DESIGN.md).** It encodes
the design framework, owner preferences, and the definition of done. The research
behind it is vendored at `design/research/`.

## Run

Use the Node version in `.nvmrc`, and switch to it before installing.

```sh
npm install
npm run build
MARINARA_URL=http://<engine-host>:7860 node server.mjs   # serves dist/ on :7872
# engines off loopback gate privileged routes: add MARINARA_ADMIN_SECRET=<secret>
```

Dev loop: `node server.mjs` in one shell (API proxy), `npm run dev` in another
(Vite HMR on :5173, proxying /api to :7872). `MC_PROXY_TARGET` and `MC_DEV_PORT`
override those two defaults, so a second pair can run against another engine:

```sh
MARINARA_URL=http://100.x.y.z:7860 PORT=7874 node server.mjs
MC_PROXY_TARGET=http://127.0.0.1:7874 MC_DEV_PORT=5174 npm run dev
```

## Prose

Docs are linted with [Vale](https://vale.sh) against the Microsoft style, plus a
small local style in `.vale/styles/Marinara/`. It is advisory: `npm run check`
does not run it, and the CI job never blocks a merge.

```sh
brew install vale
vale sync          # fetch the Microsoft package into .vale/styles (gitignored)
npm run prose
```

`BACKLOG.md` and `design/DESIGN.md` are exempt for now. No rule is switched off
repo-wide; where a rule fires on a word that means something specific here, the
word goes in the project vocabulary instead, which Vale skips in every check.

Vocabulary lives in `scripts/genvocab.py`, which expands plain word lists into the
patterns Vale wants. Add the word there, re-run the script, commit both files:

```sh
python3 scripts/genvocab.py > .vale/styles/config/vocabularies/Marinara/accept.txt
```

Prefer a code span or a fence over a vocabulary entry: Vale already skips both,
and fencing a sample fixes the cause rather than the symptom.

## Layout

| path | what |
| --- | --- |
| `server.mjs` | zero-dep proxy: strips `embedding` vectors from entry payloads (~85% of bytes), serves `dist/` at `/` and the design mockups at `/mockups/`; for the memory tool it also keeps a rotating LTM restore point before each run's first write (`.backups/`), stores review decisions (`.state/`), and forwards `MARINARA_ADMIN_SECRET` for engines off loopback |
| `src/` | the console — Vite + Preact + TS, hash routing, tokens-based CSS |
| `design/` | DESIGN.md, tokens rationale, vendored UI research |
| `.vale.ini` | prose lint config: Microsoft style, exemptions in the vocabulary rather than rule switches |
| `scripts/` | the executable checks: `verify.mjs` (definition of done — screenshots, contrast, tap targets, console errors), `copycheck`, `layercheck`, `deadcss`, `domsnap`, `faceprobe`, `overlaycheck`, `shots`; browser ones share `lib/browser.mjs` |
