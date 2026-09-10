# Scope

**Documents:** scope, given in the original as `src/tools/memory/scope.ts`. In
the tree today the scope code sits in `src/tools/memory/model/scope.ts` and
`src/tools/memory/store/scope.ts`. The surface control is
`src/tools/memory/ScopeBar.tsx`.

Character › chat. Chosen once over the views, applied by every view. Three
rules, because a filter that hides records has to be trustworthy:

**Unscoped means everywhere, not nowhere.** The catalog defines scope as the
chats and characters a memory *is available in*, so an empty scope isn't an
orphan. It's global. Imported lorebook sources arrive unscoped and would vanish
the moment anyone picked a scope.

**Show a record the console can't place.** The row stays when the note behind a
review row is still missing. Hiding on ignorance makes the queue understate the
work left, which is worse than showing one row too many.

**Counts follow the list.** Scope narrows the rows *and* every figure beside
them — the vault's chips, the nav badges. A scoped list under a global tally is
a header contradicting its own rows. The review badge counts live rows for the
same reason: the response's `counts.mutations` also counts claims held inside
blocked drafts, and read 190 over a queue listing 77.

The store applies scope to the review queue, so the tally, facets, groups, and
apply dock all narrow with it rather than each filtering by hand.
