# Agent instructions

- **Run `design/CHECKLIST.md` before showing Luma any UI, mockup, or specimen
  book.** It's built from defects that actually shipped here. The copy phase
  is mechanical: `npm run lint` for the call sites, `npm run copycatalog` for
  the catalog itself. It must pass, or you must justify every untraced string.
- **Start at `design/BRIEFING.md`** for orientation: what the memory tool is for,
  what's settled, and what the memory types actually look like in the live
  corpus. It points into the other two rather than repeating them.
- **`design/MEMORY-SCHEMA.md`** is the note shape: the eight types, which fields
  are universal, which ones a type restricts, and what a section carries beyond
  its text. Check it before designing around a field.
- **Read `design/DESIGN.md` before writing or changing any UI.** It's
  authoritative on tokens, patterns, owner preferences, and decision rules.
  Update it in the same change when a session decision contradicts it.
- **A normative rule needs an owner citation.** Don't add, change or remove a
  must, an always, a never, a threshold, a numeric constant or a token
  restriction in `design/DESIGN.md` without a citation. Quote what Luma asked
  for, or link the `[Luma]` entry in `BACKLOG.md` that carries it. The framework
  this one replaces accumulated a great many rules nobody asked for, written in
  the same authoritative voice as the real decisions. By the end the two were
  impossible to tell apart. Record what the code does today if it's worth
  recording, but mark it as an observation rather than policy. An observation
  binds nobody.
- **`design/ARCHITECTURE.md`** is the code layout: the layers, which directory
  carries which, and the rules a module has to obey. Read it before adding a
  file or deciding where one goes. `npm run layercheck` enforces the dependency
  rule. It skips a module in no layer directory, which is a gap, not a pass.
- Validate: `npx tsc --noEmit && npm test && npm run layercheck && npm run build`,
  then `npx playwright test`, which is the definition of done — `tests/e2e/README.md`.
  It renders every screen at 390/486/768/1280. It fails on a console error or
  warning, on a page error, on a screen that scrolls sideways, and on an overlay
  that won't dismiss. A recorded baseline backs the contrast and tap-target
  checks, so each of those two fails on a new offender and passes the offenders
  already measured.
- The pre-commit hook formats what you stage, so `npm run format` becomes a
  thing you run when you want to rather than something to remember. It stops
  for an unformatted file carrying unstaged edits, since formatting that one
  would commit the half you didn't stage. It also runs `prosecheck` over
  staged Markdown and stops on **every** finding, warnings and suggestions
  included. `npm run prepare` installs the hook, and npm runs that after an
  install. `git commit --no-verify` skips it.
- Prettier owns `.ts`, `.tsx`, `.mjs` and the config files. `format:check`
  sits in `check:static` and fails the build. It doesn't touch CSS or
  Markdown, which belong to stylelint and Vale — see `.prettierignore`, which
  gives a reason for every entry.
- Run `npm run prosecheck` after you edit a `.md` file. It runs Vale over the
  Markdown you changed. It reports only what lands on lines you added, so the
  backlog in the rest of the docs stays out of your way. It exits non-zero on an
  error. `npm run prose` lints the whole repo, which isn't what you want here.
- Model code gets Vitest tests beside it. Pin every copy of a duplicated
  computation *before* merging them, and assert catalog keys rather than English
  so a copy rewording can't break a test.
- Shared UI goes in `src/ui/`, and a new component carries no stylesheet. See
  `design/DESIGN.md` §5. Prove a refactor renders identically before you claim
  it: `node scripts/domsnap.mjs before` then `... after --diff`.
- Engine logic (keyword matching, token estimates) is vendored, never reimplemented.
- The engine repo lives at `~/Documents/code/luma/Marinara-Engine`. UI copy should reuse its en.json vocabulary where a concept exists upstream. There is a decoy `~/code/Marinara-Engine` holding game assets only. It has a `packages/` directory, so its emptiness of engine source isn't obvious. The capability source is under `packages/server/data/capability-packages/versions/long-term-memory/`.
