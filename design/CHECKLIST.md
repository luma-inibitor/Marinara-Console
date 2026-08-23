# Design checklist

Run this before showing Luma anything — a mockup, a specimen book, or shipped
UI. Every line here exists because that exact defect shipped in this repo and
Luma caught it. The parenthetical is the real incident, kept so the rule is not
abstract.

Order matters: the phases run top to bottom, and the cheap checks come last on
purpose — the expensive mistake is building the wrong thing, not misaligning it.

---

## 1. Before designing — what is this surface for?

- [ ] **Name the decision this surface serves, in one sentence.** If the answer
      is "it shows the data", stop and start over.
      *(The import result card led with a per-source ledger. What the reviewer
      actually needed: did it work, is there anything to fix, should I go review
      now. The ledger was audit material wearing a headline.)*
- [ ] **List every state before drawing one.** Empty, loading, running, partial
      failure, error, one item, many items, more than fits. A state you do not
      draw is a state someone else will improvise.
      *(Six specimens jumped from a confirm button to a finished result with no
      running state in between — for an action that spends minutes of model
      calls. The edit mode the curate path was built around was never drawn.)*
- [ ] **Design both projections in the same pass** — pointer and touch, wide and
      narrow. Not "make it responsive later".
      *(The curate path had no mobile projection at all, on the device Luma
      actually uses.)*
- [ ] **Check the domain before designing around it.** Query the engine, read
      the schema, reproduce the failure.
      *(A whole repair panel was built around a free "revalidate" action. The
      engine enforces the block at preflight and exposes no such route.)*

## 2. Copy — before writing any label

- [ ] **Run `node design/copycheck.mjs <file>`.** Every user-visible string must
      trace to `ltm-en.json` or be registered in `OURS` with a reason.
- [ ] **Search the catalog for the concept, not the word.** The product almost
      always already has it.
      *(Coined state names three separate times while the catalog shipped New /
      Already imported / Update available / Context changed / Extraction
      incomplete. Coined "Saving and extracting…" while the catalog had it
      verbatim.)*
- [ ] **Copy must be true about the product.** Check the mechanism before
      describing it.
      *("Nothing was imported from it" on a failed extraction — but import saves
      the source note; only extraction failed. The catalog said so.)*
- [ ] **Plain sentences: subject, verb, object.** No fragments, no stacked
      clauses, no shorthand.
      *("Saved with this source and reused on re-extraction." — two subjectless
      fragments.)*
- [ ] **Say each fact once per screen.** Two sentences meaning the same thing is
      one sentence too many.
      *(A help line and a bar note six inches apart both explained when an edit
      takes effect.)*
- [ ] **Help text gets the information icon. Every time, the same icon.**
      *(One help line had no icon; the next had a clock.)*

## 3. Numbers

- [ ] **Add them up.** Every count on screen must reconcile with every other.
      *(A rail claiming 197 pending + 96 imported against a total of 213. A
      header claiming 61 proposed memories over rows summing to 58.)*
- [ ] **Does any number appear twice?** If two counts can never differ, show one.
      *("4 selected" beside a button reading "Import and extract (4)". A button
      reading "(16) ✨16". A footer repeating the three counts already in the
      rail.)*
- [ ] **Numeric columns: right-aligned, tabular figures, unit in the column
      head** — never repeated in every cell.

## 4. Layout and vocabulary

- [ ] **One meaning per channel.** Accent means interactive. Colour is never the
      only carrier. One icon per concept, one concept per icon.
      *(An "edited" chip in accent, which the detail pane had just established
      means interactive. Two different yellow states meaning opposite things.)*
- [ ] **The most important value must never be the one that truncates.**
      *(The single failed source's name cut to "Nam…" — the one name in the card
      that had to survive.)*
- [ ] **Sibling controls share a height and do not wrap.**
      *("SAVE" beside a two-line "DISCARD CHANGES".)*
- [ ] **Measure alignment, do not eyeball it.** Read the geometry back with
      Playwright and assert on the numbers.
      *(Column alignment took three rounds by eye; one measurement settled it.)*
- [ ] **Element order is the task's real order,** and a price sits with the
      control that spends it.
      *(The running state appeared before the confirm that starts it. A cost chip
      sat between two unrelated buttons.)*

## 5. Before showing Luma

- [ ] **Render it and look at it.** Screenshot every surface at 390 / 768 /
      1280. Reading your own source does not count — every occlusion, wrap and
      clipping defect in this repo was invisible in the markup and obvious in a
      screenshot.
- [ ] **Are the two layers separable at a glance?** The specimen is the object;
      labels, captions and verdicts are commentary about it. Commentary sits
      outside the specimen's box and never changes its spacing.
      *(Frame titles were rendered inside the wireframe boxes, so they read as
      part of the interface being wireframed — and duplicated the label above.)*
- [ ] **Re-read your captions against the render.** Do they describe what is
      actually drawn, or what you meant to draw?
      *(A caption promised the rail hid imported sources while the mockup showed
      them.)*
- [ ] **Run the mechanical checks**: `copycheck.mjs`, and `verify.mjs` for app
      code (contrast, tap targets, keyboard walk).
- [ ] **Ask what Luma will catch in five seconds.** It is almost always one of:
      a repeated number, a truncated name, a wrapped button, a coined word, or
      two things that should share an edge and do not.
