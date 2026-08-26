# scripts/fixtures

Trees the checks in `scripts/` are run against by their tests. Each subdirectory is one case: a whole `src/` in miniature, laid out so the classifier sees the same directory names it sees in the real tree.

Nothing here is compiled, linted or shipped — `tsconfig.json` includes `src` only, and `eslint` runs on `src`. The files exist to be read by a parser, so they hold the smallest import that expresses the case and nothing else.

A rule without a fixture is a rule that can be disabled by an edit and stay green. `scripts/layercheck.test.mjs` asserts a violating case for every rule and a passing case beside it, so a change to the layer table that lets a violation through fails `npm test`. `scripts/deadexports.test.mjs` does the same for re-export judging: a dead forwarding line, a live one, and an `export *` that names nothing to judge.

`deadexports` reads the whole real `src/` as consumers on every run, which a fixture can't turn off. That's harmless — the real tree never imports from `scripts/fixtures`, and each fixture's own files are consumers of each other — but it does mean a fixture must export only what its case is about, or the extra symbols show up as findings of their own.
