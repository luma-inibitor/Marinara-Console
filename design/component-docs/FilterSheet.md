# Facet sheet

**Documents:** `src/tools/memory/review/FilterSheet.tsx`

Multi-select facets, ordered by how often they are reached for rather than by
provenance: the exception filter ("has quality flags", one toggle plus a drill-in
to the named flags) · the short taxonomies as tiles (memory type, decision) · the
long tail behind search (sources) and behind a disclosure (the model's enums).

Provenance grouping — computed / from the model / yours — was the earlier shape
and is retired here: it answered "who asserted this", a question about trust,
while a reviewer opening the filter has a question about narrowing. Authority
still separates the console's own signals from the model's, by level rather than
by a labelled block.

Counts exclude the facet's own filter ("what would I get if I toggled this"), and
two facets narrowing one set exclude each other (`countsIgnore` — flags ↔
anyFlag).

**A facet lists its whole vocabulary, always**, from a declared `domain` or from
the unfiltered rows: a value at zero renders disabled rather than vanishing,
because an axis that shrinks as you narrow it tells the reviewer the missing
choices do not exist (owner-decided 2026-08-24 — the risk facet was hiding "high"
on a batch with none, and the decision facet was offering nothing but
"undecided").
