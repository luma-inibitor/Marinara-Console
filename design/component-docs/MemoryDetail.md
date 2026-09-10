# Memory detail card

**Documents:** `src/tools/memory/detail/` (`MemoryDetail.tsx`,
`RetrievalCard.tsx`, `SectionRow.tsx`)

A read-only screen for one stored record. Three rules carry it, and all three are
load-bearing:

**One bordered surface.** The retrieval block (modes · keywords · links) is the
only box on the screen, so *boxed means metadata, unboxed means content*. A
second card — especially around a section body — collapses that distinction and
was the single biggest failure of the directions that lost.

**One section, one row, one behavior.** Every section expands in place, however
long, so the chevron has only one thing it can mean. An earlier pass routed
oversized sections to a bottom-sheet peek and made the glyph predict which of
the two you would get (chevron vs diagonal arrow). Luma retired it — two
interaction models and a size threshold to explain, in exchange for a problem
stickiness solves outright.

**A long section carries its own way out.** Its row is `position: sticky` under
the card's head while the section is open, so the control that closes it stays
on screen the whole way down. Sticky needs no length threshold and no
measurement to decide it applies: a row whose body is shorter than the remaining
viewport never reaches its offset. Collapsing must anchor the scroll back to the
row — the document shrinks under the reader otherwise, and the sticky control
creates the disorientation it exists to prevent.

**No truncation notices.** No "141 lines between," no dashed count boxes, no
"show rest." The row states the size and the chevron opens it. Every notice
tried here read as noise.

Collapse-all is the manifest state, with every section a bare row. A long memory
therefore needs no separate overflow design, only `defaultCollapsed`.

The flag's popover states cap pressure in words. The meter bar that it once
carried died with the peek and doesn't come back into the row, where it competed
with content for attention.
