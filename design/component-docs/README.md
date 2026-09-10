# Component docs — staged for Storybook

These files hold component-specific design decisions lifted out of
`design/DESIGN.md` (lines 211–361) as that document was retired in favour of a
short design spec. Every passage here was reviewed line by line by the owner and
confirmed correct; it has been re-flowed but not rewritten, and no rule has been
added, generalised or resolved.

The owner's decision: **this content should live as Storybook entries next to the
components it describes.** Storybook is not installed yet (no `storybook` or
`@storybook/*` entry in `package.json`), so these are markdown for now. Each file
names the source file(s) it documents and is written to paste into a Storybook
`Meta`/docs block with minimal editing — at which point it should move next to
its component and this directory should go away.

| File | Documents |
| --- | --- |
| `FilterSheet.md` | `src/tools/memory/review/FilterSheet.tsx` |
| `arrange-rail.md` | the phone arrange rail (source file not named in the original) |
| `icons.md` | `src/tools/memory/icons.tsx` |
| `ClaimDetail.md` | `src/tools/memory/ClaimDetail.tsx` |
| `glossary.md` | `src/tools/memory/glossary.tsx` |
| `scope.md` | scope, documented as `src/tools/memory/scope.ts` |
| `MemoryDetail.md` | `src/tools/memory/detail/` |

Not carried over from that range: the **Styling** bullet (DESIGN.md line 279),
which is handled elsewhere.
