# CLAUDE.md — Marinara Console

- **Run `design/CHECKLIST.md` before showing Luma any UI, mockup, or specimen
  book.** It is built from defects that actually shipped here; the copy phase
  is mechanical (`node scripts/copycheck.mjs <file>`) and must pass or every
  untraced string must be justified.
- **Start at `design/BRIEFING.md`** for orientation: what the memory tool is for,
  what is settled, and what the memory types actually look like in the live
  corpus. It points into the other two rather than repeating them.
- **`design/MEMORY-SCHEMA.md`** is the note shape: the eight types, which fields
  are universal, which are restricted by type, and what a section carries beyond
  its text. Check it before designing around a field.
- **Read `design/DESIGN.md` before writing or changing any UI.** It is the
  authoritative framework: tokens, patterns, owner preferences, decision rules.
  If a session decision contradicts it, update DESIGN.md in the same change.
- **`design/ARCHITECTURE.md`** is the code layout: the layers, which directory
  carries which, and the rules a module has to obey. Read it before adding a
  file or deciding where one goes. `npm run layercheck` enforces the dependency
  rule; a module in no layer directory is unchecked, which is a gap, not a pass.
- **Queue choices in `.decisions/`** instead of asking inline or fixing on a
  hunch. The directory is the index, `.decisions/README.md` is the format, and
  a defect found while doing something else belongs there rather than in the
  diff that found it. A decision that changes is rewritten correct at the top,
  never appended to.
- Validate: `npx tsc --noEmit && npm test && npm run layercheck && npm run build`,
  then the checks in DESIGN.md §7 (screenshot at 390/768/1280, zero console errors, contrast +
  tap-target floors).
- Model code gets Vitest tests beside it. Pin every copy of a duplicated
  computation *before* merging them, and assert catalog keys rather than English
  so a copy rewording cannot break a test.
- Shared UI goes in `src/ui/` with a co-located stylesheet; see DESIGN.md §8.
  Before claiming a refactor renders identically, prove it:
  `node scripts/domsnap.mjs before` then `... after --diff`.
- Engine logic (keyword matching, token estimates) is vendored, never reimplemented.
- The engine repo lives at `~/Documents/code/luma/Marinara-Engine`; UI copy should reuse its en.json vocabulary where a concept exists upstream. There is a decoy `~/code/Marinara-Engine` holding game assets only — it has a `packages/` directory, so its emptiness of engine source is not obvious. The capability source is under `packages/server/data/capability-packages/versions/long-term-memory/`.
