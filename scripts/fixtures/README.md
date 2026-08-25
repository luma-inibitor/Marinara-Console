# scripts/fixtures

Trees the checks in `scripts/` are run against by their tests. Each subdirectory is one case: a whole `src/` in miniature, laid out so the classifier sees the same directory names it sees in the real tree.

Nothing here is compiled, linted or shipped — `tsconfig.json` includes `src` only, and `eslint` runs on `src`. The files exist to be read by a parser, so they hold the smallest import that expresses the case and nothing else.

A rule without a fixture is a rule that can be disabled by an edit and stay green. `scripts/layercheck.test.mjs` asserts a violating case for every rule and a passing case beside it, so a change to the layer table that lets a violation through fails `npm test`.
