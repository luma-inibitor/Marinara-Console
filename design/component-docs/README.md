# Component docs — staged for Storybook

These files hold component-specific design decisions lifted out of
`design/DESIGN.md` (lines 211–361) on the retirement of that document in favour
of the short `design/DESIGN.md`. The owner reviewed every passage here line by
line and confirmed it correct. The re-flow rewrote nothing and added,
generalised, or resolved no rule.

The owner's decision: **this content should live as Storybook entries next to the
components it describes.** Storybook isn't installed yet (no `storybook` or
`@storybook/*` entry in `package.json`), so these are markdown for now. Each file
names the source files it documents and should paste into a Storybook
`Meta`/docs block with minimal editing. At that point it should move next to its
component, and this directory should go away.

| File | Documents |
| --- | --- |
| `FilterSheet.md` | `src/tools/memory/review/FilterSheet.tsx` |
| `arrange-rail.md` | the phone arrange rail (source file not named in the original) |
| `icons.md` | `src/tools/memory/icons.tsx` |
| `ClaimDetail.md` | `src/tools/memory/ClaimDetail.tsx` |
| `glossary.md` | `src/tools/memory/glossary.tsx` |
| `scope.md` | scope, documented as `src/tools/memory/scope.ts` |
| `MemoryDetail.md` | `src/tools/memory/detail/` |

The **Styling** bullet (DESIGN.md line 279) wasn't carried over from that range.
It lives elsewhere.
