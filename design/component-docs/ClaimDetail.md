# Detail pane zones (v5)

**Documents:** `src/tools/memory/ClaimDetail.tsx`

A claim's pane answers the reviewer's questions in reading order:

1. **headline sentence** — what this does, to which memory
2. **preview** — op-specific consequence: after-state for append, diff for
   update, the memory-as-it-will-exist for create, resolved facts for metadata
   ops; stored context and unchanged runs fold behind labeled expanders
3. **evidence** — source snippet + attribution, confidence as a sentence,
   diagnostics, quiet extraction line
4. **decide bar** at the bottom, in the list's ring vocabulary

Editing is a mode: accent border, textarea in place of the proposed lines only,
save/discard replace keep/drop.

Preview lines speak diff: + tint = lands in the vault, − = dies on apply; the
gutter glyph carries the meaning when color fails.

Zone labels use catalog vocabulary (preview · existing → proposed · evidence ·
extraction).
