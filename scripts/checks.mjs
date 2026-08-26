// The static checks, one npm script name on each line.
//
// This file exists to be edited BY MERGE. The tooling migration adds a tool,
// retires a tool, or swaps one for another across fifteen pull requests, and
// before this file every one of them had to rewrite the same 168-character
// `&&` chain in package.json. Two branches that touch that line conflict every
// time, and resolving it means hand-merging a shell command — which is exactly
// where a tool gets dropped and nobody notices, because a shorter chain still
// exits 0. One name per line, in groups that do not touch, means git resolves
// an addition in one group and a deletion in another on its own.
//
// Order is run order. A cheap check that fails often belongs above an expensive
// one, so `typecheck` runs before the whole-tree scanners. The runner does not
// stop at the first failure, so order is about how fast the FIRST finding
// appears, not about what gets reported.
//
// ── What is deliberately not here: `test` and `build` ─────────────────────
// Both were in the old chain, `build` on the end of it. Each now has its own
// npm script and its own CI job (`check:test`, `check:build`) so the three run
// in parallel on a pull request. Naming either one here would run it a second
// time in `npm run check`, and would put the whole test suite back inside the
// `static` job, which is the split this change exists to make. `npm run check`
// still runs static, test, and build in that order, so the command means what
// it has always meant.
// `prose` is deliberately absent, like `test`. Vale runs advisorily on pull
// requests (.github/workflows/prose.yml sets fail_on_error: false), so listing
// it here would make it blocking and change a decision main already made.
export const checks = [
  // Types
  "typecheck",
  // Lint
  "lint",
  // Layers: imports point downward, and no component owns a fetch
  "layercheck",
  // Inventory, not a gate: `components` always exits 0.
  "components",
  // Copy: every user-visible string comes from the catalog
  "copycheck",
  // Dead code
  "deadcss",
  "knip",
  // Duplication
  "jscpd",
  // Design system
  "csslint",
  "typescale",
  // Docs: Markdown links resolve
  "linkcheck",
];
