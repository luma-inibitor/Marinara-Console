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

## Layout

| path | what |
| --- | --- |
| `server.mjs` | zero-dep proxy: strips `embedding` vectors from entry payloads (~85% of bytes), serves `dist/` at `/` and the design mockups at `/mockups/`; for the memory tool it also keeps a rotating LTM restore point before each run's first write (`.backups/`), stores review decisions (`.state/`), and forwards `MARINARA_ADMIN_SECRET` for engines off loopback |
| `src/` | the console — Vite + Preact + TS, hash routing, tokens-based CSS |
| `design/` | DESIGN.md, tokens rationale, vendored UI research |
| `.githooks/` | the tracked git hooks; `npm install` points `core.hooksPath` here |
| `scripts/` | the executable checks: `verify.mjs` (definition of done — screenshots, contrast, tap targets, console errors), `copycheck`, `layercheck`, `deadcss`, `domsnap`, `faceprobe`, `overlaycheck`, `shots`; browser ones share `lib/browser.mjs` |

## Commits and pull requests

Commit subjects follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) — `type(optional-scope): description`, with `type` one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`. `npm install` runs `prepare`, which points `core.hooksPath` at `.githooks/`, so the `commit-msg` hook checks the subject before the commit exists. `git commit --no-verify` skips it; the Conventions workflow checks the same rule over the branch's commits, so a skipped hook only moves where you find out.

A pull request title is held to the same rule, because a squash merge writes it as the commit subject. A pull request body opens with a plain-language paragraph of at least two sentences — what the problem is, and what the change does about it — readable by someone who has not seen the diff, and naming no file, code span or `#123`. Everything after that first paragraph is unchecked. Run either locally:

```sh
npm run commitcheck -- --range origin/main..HEAD
npm run prcheck -- --title "fix: …" --body "…"
```
