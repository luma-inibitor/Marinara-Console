# Test fixtures

Input trees for the tests of the checks in `scripts/`. Each subdirectory is one case: a whole `src/` in miniature, laid out so the classifier sees the same directory names it sees in the real tree.

Nothing here compiles, lints or ships: `tsconfig.json` includes `src` only, and `eslint` runs on `src`. Only a parser reads these files, so they hold the smallest import that expresses the case and nothing else.

A rule without a fixture is a rule that can be disabled by an edit and stay green. `scripts/layercheck.test.mjs` asserts a violating case for every rule and a passing case beside it, so a change to the layer table that lets a violation through fails `bun run test`.

`deadcss` has a fixture set to guard a different failure. A person maintains its `DOMAINS` table by hand. A prefix nobody added doesn't misjudge one class. It drops every class under that prefix out of the scan and still prints a clean run.

`scripts/deadcss.test.mjs` covers four cases:

- a registered prefix
- an unregistered one
- an unregistered one nested a template deep inside the class template
- a `draft-${n}` identifier that isn't a class name at all
