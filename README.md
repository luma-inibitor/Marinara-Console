# Marinara Console

A standalone management console for [Marinara Engine](https://github.com/luma-inibitor/Marinara-Engine):
power-user tools for lorebooks, presets, and the long-term-memory agent, designed
dense-first for desktop and mobile.

**Before touching any UI, read [`design/DESIGN.md`](design/DESIGN.md).** It encodes
the design framework, owner preferences, and the definition of done. The research
behind it is vendored at `design/research/`.

## Run

```sh
npm install
npm run build
MARINARA_URL=http://<engine-host>:7860 node server.mjs   # serves dist/ on :7872
```

Dev loop: `node server.mjs` in one shell (API proxy), `npm run dev` in another
(Vite HMR on :5173, proxying /api to :7872).

## Layout

| path | what |
| --- | --- |
| `server.mjs` | zero-dep proxy: strips `embedding` vectors from entry payloads (~85% of bytes), serves `dist/` at `/`, legacy app at `/legacy/` |
| `src/` | the console — Vite + Preact + TS, hash routing, tokens-based CSS |
| `design/` | DESIGN.md, tokens rationale, vendored UI research |
| `public/` | the original no-build lorebook app ([docs](public/README.md)), alive at `/legacy/` until the console reaches parity |
| `verify.mjs` | definition-of-done checks (screenshots, contrast, tap targets, console errors) |
