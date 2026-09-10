# Browser suite — definition of done

`npx playwright test` (`npm run test:e2e`).

This is the verification section lifted out of `design/DESIGN.md` §7 as that
document was retired, so it lives next to the specs it describes. The content is
owner-confirmed and has been re-flowed but not rewritten.

A UI change is not done until the browser suite passes. The suite builds the
bundle, serves it with `vite preview`, answers every request from the fixture
corpus in `tests/e2e/fixtures/`, and runs each spec at the four standard
viewports.

## 1. The standard viewports

- **390×844** `narrow`, the floor
- **486×1085** `phone`, Luma's device and the one that must be right
- **768×1024** `tablet`, the band between the breakpoints
- **1280×800** `desktop`

Those four names are the only viewport vocabulary; they are declared once as
Playwright projects in `playwright.config.ts` and every spec runs in all four. A
"mobile" rendering drawn in a small box on a wide page is not a mobile rendering;
render at the viewport or do not claim the result.

CSS breakpoints are two, semantic: **720px** (below it everything stacks) and
**900px** (above it master-detail sits side by side).

## 2. Screen assembly — `smoke.spec.ts`

Every screen assembles from the corpus and lists what the corpus put in it.

## 3. Console silence

Zero console errors, console warnings and page errors on every screen visited.
The shared fixture in `tests/e2e/harness.ts` fails any test that leaves a request
unanswered, writes anything to the console at error or warning level, or throws
an exception after render, so this holds for the whole suite rather than for one
spec. There is no allow list, so the check is absolute. The suite runs silent
today, and an escape hatch no test exercises is a worse answer than editing this
check on the day a message genuinely cannot be fixed.

## 4. Tap-target sweep — `tap-targets.spec.ts`

Interactive elements ≥44px primary / ≥24px+spacing secondary. A control under
44px fails unless it clears 24px *and* sits ≥8px from the nearest other target —
that spacing is what a secondary control is granted, so without it there is no
band left for the element to be legitimate in. Segments of one `[role="group"]`
are a single control, not competing targets.

Held to the `RECORDED` list in that spec, so a new undersized target fails while
those recorded ones pass — 47 elements across 16 signatures today.

The 44px floor is under review (`design.md` §3). Measured at a 35px floor it
would fall to 34 elements across 10 signatures, so the decision is costed; it
just hasn't been made. Until it is, 44px stands.

## 5. Contrast sweep — `contrast.spec.ts`

axe over element text, plus a pass of our own over `::before`, `::after` and
`::placeholder` ink, against the project's contrast floors. Held to
`design/contrast-baseline.json`, so only growth fails.

## 6. Dismissal and keyboard — `overlays.spec.ts`, `keyboard.spec.ts`

Every layered surface closes on scrim tap, on Escape and on back, and the command
palette, the `g` jump sequences and j/k down a list all work without a mouse.

## 7. No sideways scroll — `overflow.spec.ts`

On every screen at every viewport, neither the document nor any box that scrolls
may scroll horizontally. Every scroll container on the screen is measured, not
just the document, because a box that sets `overflow-y: auto` computes
`overflow-x` to auto too, so an over-wide row scrolls that box and leaves the
document at exactly the viewport width. A document-only measure reports every
screen clean. The boxes are found by their computed overflow rather than named,
because `.stage` carries the rows on two screens and `.audit-list` carries them
on six. The chip rail is allowed to scroll sideways by name, since it asks for
`overflow-x: auto` itself and fades its right edge to say so.

## 8. Screen captures — `shots.spec.ts`

Skipped unless `MC_SHOTS=1`:

```
MC_SHOTS=1 MC_SHOT_URL=/#/memory/vault npx playwright test shots
```

The address is resolved against the preview server the suite starts, so a bare
path reaches an app route or a mockup page. It writes
`/tmp/shots/shot-<viewport>.png` at all four viewports and reports horizontal
document overflow per viewport. `MC_SHOT_NAME` changes the file stem,
`MC_SHOT_SEL` captures one element, `MC_SHOT_FULL` captures the whole page.
Density on list screens is read off the narrow capture: the mobile target is
about ten collapsed rows a screen.

---

Screenshot before claiming; measure before asserting density. This habit has
caught real bugs every time it was applied — treat it as part of the build, not
QA.
