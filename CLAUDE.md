# Agent instructions

- **Run `design/CHECKLIST.md` before showing Luma any UI, mockup, or specimen
  book.** It's built from defects that actually shipped here. The copy phase
  is mechanical: `bun run lint` for the call sites, `bun run copycatalog` for
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
  file or deciding where one goes. `bun run layercheck` enforces the dependency
  rule. It skips a module in no layer directory, which is a gap, not a pass.
- Bun is the runtime and the package manager. Install the version that
  `packageManager` in `package.json` names, then run `bun install`. Use
  `bun run <script>` for a script, and never `bun test`, which is Bun's own
  test runner rather than Vitest.
- Validate with `bun run typecheck && bun run test && bun run layercheck && bun run build`.
  Then run `bun run test:e2e`, which is the definition of done.
  `tests/e2e/README.md` describes the suite.
  It renders every screen at 390/486/768/1280. It fails on a console error or
  warning, on a page error, on a screen that scrolls sideways, and on an overlay
  that won't dismiss. A recorded baseline backs the contrast and tap-target
  checks, so each of those two fails on a new offender and passes the offenders
  already measured.
- The pre-commit hook formats what you stage, so `bun run format` becomes a
  thing you run when you want to rather than something to remember. It stops
  for an unformatted file carrying unstaged edits, since formatting that one
  would commit the half you didn't stage. It also runs `prosecheck` over
  staged Markdown and stops on **every** finding, warnings and suggestions
  included. `bun run prepare` installs the hook, and `bun install` runs that
  afterward. `git commit --no-verify` skips it.
- Prettier owns `.ts`, `.tsx`, `.mjs` and the config files. `format:check`
  sits in `check:static` and fails the build. It doesn't touch CSS or
  Markdown, which belong to stylelint and Vale — see `.prettierignore`, which
  gives a reason for every entry.
- **Write plainly. Don't decorate.** Technical prose here is consistent,
  concise and simple to read. Three habits to avoid:
  - **Sentence fragments used for emphasis.** Write "Use this only when the
    other two don't work, and write the reason in a code comment", not "Last
    resort, and the reason goes in the code."
  - **A new phrase for something you already named.** Use the same word every
    time. A document that calls one thing a rule, a policy and a contract makes
    the reader check whether all three are the same thing.
  - **A clause that carries rhythm rather than meaning.** `Not in color, not in
    absence` reads well and says less than `colour alone isn't enough`. Cut it.
  Delete first when you revise a draft. Rewriting a sentence to satisfy a rule
  usually keeps the ornament and hides it.
- Run `bun run prosecheck` after you edit a `.md` file. It runs Vale over the
  Markdown you changed. It reports only what lands on lines you added, so the
  backlog in the rest of the docs stays out of your way. It exits non-zero on an
  error. `bun run prose` lints the whole repo, which isn't what you want here.
- Model code gets Vitest tests beside it. Pin every copy of a duplicated
  computation *before* merging them, and assert catalog keys rather than English
  so a copy rewording can't break a test.
- Shared UI goes in `src/ui/`, and a new component carries no stylesheet. See
  `design/DESIGN.md` §5. Prove a refactor renders identically before you claim
  it: `bun run domsnap before` then `bun run domsnap after --diff`.
- Engine logic (keyword matching, token estimates) is vendored, never reimplemented.
- The engine repo lives at `~/Documents/code/luma/Marinara-Engine`. UI copy should reuse its en.json vocabulary where a concept exists upstream. There is a decoy `~/code/Marinara-Engine` holding game assets only. It has a `packages/` directory, so its emptiness of engine source isn't obvious. The capability source is under `packages/server/data/capability-packages/versions/long-term-memory/`.
