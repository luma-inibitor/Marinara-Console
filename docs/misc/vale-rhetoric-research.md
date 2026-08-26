# What Vale can and can't detect

Research note behind the rhetoric rules in `.vale/styles/Luma/`. Every claim
below was tested against Vale 3.18.0, the version the CI job pins. The paired
hit and control fixtures are in `.vale/fixtures/rhetoric.txt`.

Six rules came out of this; three were kept. `EmDashClause`, `LeftBranching`
and `Polysyndeton` are precise enough to leave on. `Chiasmus`, `Epistrophe` and
`Litotes` were built, measured and dropped — their patterns and their failure
rates are recorded below, because the finding is worth more than the rule was.

## The finding that decides most of the list

**Non-`script` rules run on a backtracking regex engine, not Go's RE2.**
Backreferences and lookaround both work:

```yaml
# fires on "a a", captures the repeat
raw: ['\b(\w+) \1\b']

# fires on "big apple", not on "big apple pie" or "small apple"
raw: ['(?<=big )apple(?! pie)']
```

Both verified. The docs never say this outright; they only warn that `script`
rules are "limited to the standard Go regex syntax," which is the inverse
statement and easy to read as applying everywhere. It doesn't.

This matters because the figures that repeat a word — epistrophe, antimetabole,
isocolon — are exactly the ones that need a backreference. They're in reach.

The four extension points that carry the work:

| Point | Gives you | Costs |
| --- | --- | --- |
| `existence` | full backtracking regex over the flattened document | no structure, no word counts |
| `sequence` | Penn Treebank POS tags, `skip`, `negate`, `target` | project vocabulary doesn't apply |
| `occurrence` | count a pattern within `scope: sentence`/`paragraph` | counting only |
| `script` | arbitrary Tengo over the scope text | RE2 only, no POS tags |

## Verdict by item

Legend: **built** = shipped in `.vale/styles/Luma`; **dropped** = written and
measured, then cut for noise; **exists** = an off-the-shelf
package already does it; **feasible** = mechanism proven, rule not written;
**no** = not reachable this way.

| Item | Verdict | Where |
| --- | --- | --- |
| "It's not X — it's Y." | exists | `ai-tells.ContrastiveFormulas` (~120 tokens) |
| "Not X. Not Y. Just Z." | exists | `ai-tells.StackedAnaphora`, `ParallelStaccato` |
| "The X? A Y." | exists | `ai-tells.RhetoricalSelfAnswer` (44 enumerated nouns) |
| "It's worth noting", "notably" | exists | `ai-tells.HedgingPhrases`, `Metacommentary`; `write-good.Weasel` |
| Litotes | **dropped** | works, never fires here |
| Tricolon | exists | `ai-tells.VerbTricolon` + `VerbTricolonDensity` (`occurrence`) |
| Epistrophe | **dropped** | backreference; flags clear repetition |
| Isocolon | feasible | Tengo — compare word counts of comma-split segments |
| Polysyndeton | **built** | `occurrence`, `scope: sentence`, one line |
| Chiasmus / antimetabole | **dropped** | two backreferences + a stoplist |
| Prolepsis / throat-clearing | exists | `ai-tells.ExplainerLeads`, `CataphoricForecasting` |
| Periphrasis | exists | `Microsoft.Wordiness`, `write-good.TooWordy` |
| Hedging (honestly, simply, clearly) | exists | `write-good.Weasel` + `ai-tells.HedgingPhrases` |
| Zeugma | **no** | needs to know one object is concrete and one abstract |
| Em-dash joining independent clauses | **built** | `sequence`, POS-based |
| "Full stop." / "Period." | exists | `ai-tells.MicDrop` |

### The rules worth having

Polysyndeton is one line and it works:

```yaml
extends: occurrence
message: "Polysyndeton: %d coordinating conjunctions in one sentence."
scope: sentence
max: 2
token: '\b(?:and|or|nor|but)\b'
```

The other three regex rules — antimetabole, epistrophe, litotes — all work, and
none of them survived measurement. See "The three that were dropped" below.

A note on how they died, because it generalises. On three files antimetabole
scored one hit and that hit was real, which read as excellent precision. Across
all 22 it scored 12, and 8 were cross-sentence false positives the small sample
had no chance of containing. **Precision measured on a sample of three files is
not precision.** Run a candidate rule over everything `npm run prose` covers
before believing a number.

### The em-dash rule is the one to actually take

`ai-tells.EmDashUsage` bans the em-dash outright. On this repo that's **148
alerts** — it is unusable here, because these docs use the em-dash on purpose.

A `sequence` rule that asks for the *clause* instead of the character:

```yaml
extends: sequence
message: "Em-dash joins two independent clauses ('%s')."
tokens:
  - pattern: '—'
  - tag: PRP|DT
  - tag: VBZ|VBD|VBP|MD
    skip: 2
    target: true
```

**10 alerts instead of 148.** Appositives (`the cache — a plain map — holds`)
and glosses (`returns a value — a plain integer`) stay quiet, verified against
paired test cases.

Restricting the subject to `PRP|DT` was necessary. A wider `NNS` arm misfired on
`**Tag panel** — group stats with bars`, where the tagger reads "stats" as a
verb. The residual imprecision is the *paired* parenthetical dash
(`— a check was run and it passed —`), which does wrap an independent clause but
isn't the construction you're hunting. Excluding a span with a second dash
before the sentence end would clean that up.

## What we actually want: harder, and only by inversion

Vale flags; it can't reward. Each positive target has to become a rule against
its opposite.

**Right-branching** — invert to left-branching, and this works well. Flag a
sentence opening with a subordinator that defers the main clause behind a comma.
Uses `scope: sentence` so `^` anchors per sentence:

```yaml
extends: existence
scope: sentence
nonword: true
raw:
  - '^\s*(?:Although|Though|While|Because|Since|When|If|Unless|Until|After|Before|Once|Given that|Despite|Rather than|By \w+ing|Having \w+)\b[^.!?]{5,}?,\s'
```

5 hits across the three files, all genuine, and the right-branching control
sentence stays quiet. This one is ready to use.

**Given-new contract** — proven possible, and *not* ready. I wrote a Tengo
script that splits sentences, strips stopwords, and flags a sentence whose first
three content words share nothing with the previous sentence's last five. It's
correct on a clean fixture: it passes the coherent paragraph and flags all three
sentences of a deliberately disjointed one. On the real docs it produced **609
alerts** — `scope: raw` hands the script the markdown source, so tables, list
items and fenced code all read as prose. It needs the block-stripping that the
`ai-tells-experimental` scripts do, plus a reset at paragraph boundaries. The
mechanism is sound; the naive rule is noise.

Two Tengo gotchas cost me a cycle each and aren't in the docs:

- Map keys parse as identifiers, so reserved words need quoting: `{"for": 1}`.
- Scripts really are RE2 — `(?<=[.!?])\s+` fails to compile, so sentence
  splitting has to be a manual scan.

And one Vale gotcha that matters more: **`scope: summary` mis-maps script match
offsets across block boundaries.** The same script reported columns 49 and 118
on a line whose sentences start at 1, 61 and 128. Switching to `scope: raw`
fixed it exactly. Use `raw` for any `script` rule that reports positions.

**Hypotaxis** and **end-weight** are the two I'd leave alone. Both are
measurable in Tengo — subordinator density per sentence, trailing-constituent
length — but neither has a threshold you could defend, and both would fire
constantly on ordinary technical prose. The failure mode of `GivenNew` is the
preview.

## On adopting the packages

All four sync cleanly (`Microsoft`, `ai-tells`, `write-good`, `proselint`).
Together they put **680 alerts** on `README.md`, `DESIGN.md` and `BACKLOG.md`.
Three rules are 72% of that, five are 81%:

| Rule | Alerts | |
| --- | --- | --- |
| `write-good.E-Prime` | 273 | flags every form of "to be" |
| `ai-tells.EmDashUsage` | 148 | bans the em-dash |
| `write-good.Passive` | 70 | |
| `ai-tells.SemicolonUsage` | 36 | |
| `write-good.TooWordy` | 26 | |

Turning off those five drops it to **127**, which is a real backlog but a
readable one. `proselint` contributes 7 alerts total — nearly all of its value
here is already in `Microsoft`.

`ai-tells` is the one worth taking: 111 rules, dense commentary explaining each
regex and its known false positives, and a separate `ai-tells-experimental`
package of Tengo rules doing sentence-length variance, paragraph-length
variance, sentence-start repetition and near-duplicate paragraph detection. Its
own README lists what it gave up on, and that list overlaps ours: it judged
adjective-led fragments and noun-phrase-plus-participle fragments to need real
dependency parsing.

Note that `ai-tells` sets almost everything to `level: error`. Against the
advisory posture in `prose.yml` that's harmless, but `MinAlertLevel` won't help
you dial it back — you'd override per rule.

## What this branch costs

`npm run prose` covers 22 files, and the three kept rules add **100** to a
standing backlog of about 1,750:

| Rule | Alerts | Precision, spot-checked |
| --- | --- | --- |
| `EmDashClause` | 61 | good — against 148 for banning the character |
| `Polysyndeton` | 22 | mechanical; it counts, so it is always right |
| `LeftBranching` | 17 | good, though many are legitimate choices |

Only 3 of those land where CI can see them today, all on `README.md`;
`BACKLOG.md` and `design/DESIGN.md` are still exempt, and `filter_mode: added`
limits annotations to touched lines regardless.

## The three that were dropped

Each worked. None earned its noise.

**`Chiasmus`** — 7 alerts, about 4 of them real. The pattern is worth keeping on
record, because it proves the backreference point:

```yaml
extends: existence
nonword: true
scope: sentence
raw:
  - '\b(?!(?:the|and|for|that|this|with|from|…)\b)(\w{3,})\b'
  - '(?:\W+\w+){0,5}\W+'
  - '\b(?!(?:the|and|for|that|this|with|from|…)\b)(\w{3,})\b'
  - '(?:\W+\w+){0,6}?\W+\b\2\b(?:\W+\w+){0,5}?\W+\b\1\b'
```

Two lessons survive it. The closed-class stoplist is not optional — without it
"the" and "and" pair with anything and ordinary coordination reports. And
`scope: sentence` is not optional either: unscoped, the rule reported 12 times
and 8 of those paired a word with its next appearance in a *different sentence*,
because Vale flattens the document to one string and the gap classes run
straight past a full stop. `ai-tells` documents the same trap in its tricolon
rule. **Any rule whose pattern spans a clause gap needs `scope: sentence` or gap
classes that exclude `.!?`.**

**`Epistrophe`** — 9 alerts, mixed. `'\b(\w{3,})([,;] | — )(?:\w+[ ,]){1,8}\1\b'`
finds real repetition, but in these docs most of what it finds is terse spec-list
phrasing ("file, the file"; "button, mid button") where repeating the noun is the
unambiguous choice. The rule is right and the advice is wrong, which is the worst
kind of lint.

**`Litotes`** — 0 alerts. Never fired on 22 files, so it buys nothing here. The
finding that matters is the one that killed the first draft: litotes cannot be
derived from spelling. `not (?:un|in|im)\w+` fires on "not imported" and "not
interactive", and it was wrong both times it fired. A curated adjective list
works, but it needs a corpus that actually contains the figure to be worth
carrying.

## What's left

Not in this branch, in order of value per unit of noise:

1. Add `ai-tells` with the five loud rules disabled — it's the largest single
   gain available and none of it needs writing.
2. `GivenNew`, once the script strips markdown blocks.
3. Isocolon, if the Tengo word-count comparison proves cheap.
