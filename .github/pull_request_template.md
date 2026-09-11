## What this does

One or two sentences on what changed and why. Link the `BACKLOG.md` entry or the
request it answers.

## Before you mark this ready

Tick a line only after checking it. Delete a line that doesn't
apply and say why.

### Checks

- [ ] `npx tsc --noEmit && npm test && npm run layercheck && npm run build`
      passes.
- [ ] `npx playwright test` passes.
- [ ] `npm run prosecheck` reports nothing on the Markdown this branch adds,
      warnings and suggestions included.

### Commits

- [ ] Each commit is one change, and the branch carries no commit that fixes up
      or reverts an earlier commit on the same branch.

### The diff

- [ ] Read every comment the diff adds. Delete a comment that restates the code
      below it, narrates the change, labels an obvious section, or explains a
      framework. What survives is a reason a reader can't get from the code, in
      one plain sentence. `git diff main... | grep -E '^\+.*(//|/\*)'` lists
      them.
- [ ] No dead code, no leftover scaffolding, no unused import, no commented-out
      code.

### Docs

- [ ] A change in behaviour updates the documentation that describes that
      behaviour, in this pull request.
- [ ] A normative rule added to `design/DESIGN.md` carries an owner citation.
      A normative rule is a must, an always, a never, a threshold, a numeric
      constant or a token restriction. Quote what Luma asked for, or link the
      `[Luma]` entry in `BACKLOG.md`.
- [ ] Prose this pull request adds uses the same word for the same thing every
      time, and carries no sentence fragment written for emphasis and no clause
      written for rhythm.

### UI

- [ ] A change to any UI ran `design/CHECKLIST.md`.
- [ ] A new component in `src/ui/` carries no stylesheet.
