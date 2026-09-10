# Icon vocabulary

**Documents:** `src/tools/memory/icons.tsx` (`@tabler/icons-preact` in the
original text; the package installed today is `@tabler/icons-react`). The shared
set lives in `src/ui/icons.tsx`.

Icons are reserved silhouette families: the decision family = decision states,
the flag = exception flags, files/scripts = content ops (script = whole note,
file = one section; shared + marks additive ops, pencil marks replacement).

What the decision family reserves is the **interior mark on a solid round
outline** — a tick or a cross — **plus the dotted circle** (`circle-dotted`, 12
dots) that means undecided. A round outline holding anything else (an `i`, an
`!`, a segmented arc, a speech tail) is a different object and is free —
`info-circle`, `message-circle`, `alert-circle` and the whole `progress-*` family
including `progress-x` are all fine, and so is `circle-dashed`.

`undecided` moved from `circle-dashed` to `circle-dotted` for exactly this
reason: circle-dashed is 8 arc segments and `progress-*` is 5 arc segments, one
shared vocabulary, so the decision family and the progress family were colliding.
12 dots is a different vocabulary; the collision is gone and both `circle-dashed`
and the arcs are released. Only the reserved interiors can be misread as a
decision; that is the whole point of the rule (owner-decided).

No icon may borrow another family's silhouette (that rule killed `flag-2` for
status and a bare pencil for the edited mark). Type icons carry the categorical
hue.

## State signals (owner-decided)

One glyph per state, so a banner, a row mark and an empty state reporting the
same condition look alike:

- error — `alert-circle` (`Failure`)
- partial — `progress-x` (`PartialResult`)
- degraded — `progress-alert` (`Degraded`)
- waiting on the user — `list-check` (`Pending`, the same binding as the Review
  nav tab — the glyph means "the review queue" in both places, so a pending count
  names where the user should go)
- info — `info-circle` (`Info`)
- a *pane* waiting on data — **no icon** (`Loading.tsx` deliberately carries none
  — a spinner standing in for content reads as a state you can act on)

A **control** waiting on its own action is the narrower case and does get one:
`Working` (`loader-2`, spun by `Button.css`), which is the button reporting on
work the user already started rather than content that has not arrived.
Placeholder glyph, owner to revisit.

Two more that are easy to conflate: `AllClear` is `checks` (double tick — "all of
them", nothing left in the set) against `Confirm`'s single `check` (the checkbox
tick); and `ValidationOk` is `zoom-check` — a check was run and it passed — on the
high-confidence branch of the claim-detail confidence row.

`alert-triangle` is no longer generic failure: it is now only `Incomplete`, the
source-freshness state `extraction_incomplete`, which is a harvest that stopped
short rather than a thing that failed.

Owner-decided mapping lives in `BACKLOG.md`; don't re-litigate per screen.
