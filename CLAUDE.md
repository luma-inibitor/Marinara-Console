# CLAUDE.md — Marinara Console

- **Run `design/CHECKLIST.md` before showing Luma any UI, mockup, or specimen
  book.** It is built from defects that actually shipped here; the copy phase
  is mechanical (`node design/copycheck.mjs <file>`) and must pass or every
  untraced string must be justified.
- **Start at `design/BRIEFING.md`** for orientation: what the memory tool is for,
  what is settled, and what the memory types actually look like in the live
  corpus. It points into the other two rather than repeating them.
- **Read `design/DESIGN.md` before writing or changing any UI.** It is the
  authoritative framework: tokens, patterns, owner preferences, decision rules.
  If a session decision contradicts it, update DESIGN.md in the same change.
- Validate: `npx tsc --noEmit && npm run build`, then the checks in DESIGN.md §7
  (screenshot at 390/768/1280, zero console errors, contrast + tap-target floors).
- Shared UI goes in `src/ui/` with a co-located stylesheet; see DESIGN.md §8.
  Before claiming a refactor renders identically, prove it:
  `node design/domsnap.mjs before` then `... after --diff`.
- Engine logic (keyword matching, token estimates) is vendored, never reimplemented.
- The engine repo lives at `~/code/Marinara-Engine`; UI copy should reuse its
  en.json vocabulary where a concept exists upstream.
