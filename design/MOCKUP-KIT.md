# Mockup kit

One stylesheet for every specimen book and wireframe:
`design/mockup-kit.css` → built to `public/mockups/kit.css` with `bun run kit`.

The kit imports `src/styles/tokens.css` and `src/styles/theme.css`, so
**the books and the product read the same tokens**.

## Using it

```html
<link rel="stylesheet" href="/mockups/kit.css">
<div class="mk-page wf"> … </div>
```

Run `bun run kit` after you edit the kit or add classes.
Tailwind scans `public/mockups` for utility usage.

## Primitives

**Book chrome** — `mk-page` `mk-h1` `mk-sub` `mk-band` `mk-sec` `mk-h2` `mk-no`
`mk-intro`

**The meta layer** (what the book says *about* a specimen — never mixed into the
specimen itself): `mk-spec` `mk-label` `mk-stage` `mk-body` `mk-caption`
`mk-note` `mk-list` + `mk-tag mk-tag-s|w|n` `mk-legend` `mk-mark` `mk-mark-abs`
`mk-var` `mk-verdict` `mk-table`

**Wireframe** (greyscale, no product color — layout only): `wf-frame`
`wf-title` `wf-row` `wf-box` `wf-badge` `wf-col` `wf-colhead` `wf-item`
`wf-phone` `wf-cols` `wf-phones` `wf-sp`

Box roles: `wf-grow` `wf-tab` `wf-brand` `wf-sq` `wf-scope` `wf-inst`
`wf-counts` `wf-lab` `wf-btn` `wf-chip` `wf-search` `wf-crumb` `wf-fill`
Row roles: `wf-ctx` `wf-bottom` `wf-scroll`
State: `is-on` `is-off` `is-wide`

Tailwind utilities are available too (`bg-surface-2`, `text-dim`, `font-data`,
`p-3`, `rounded-m`), generated from the same theme.

## Rules

- **A phone frame is `wf-phone`, which is 486px** — the width Luma's device
  reports. A 300px box on a desktop page isn't a phone and proves nothing.
- **Capture the screen with
  `MC_SHOTS=1 MC_SHOT_URL=/mockups/<file>.html MC_SHOT_NAME=<name> bun run test:e2e shots`**,
  which renders at 390 / 486 / 768 / 1280 and reports horizontal overflow per
  viewport. The images land in `/tmp/shots/<name>-<viewport>.png`. A bare path
  is enough, because the suite starts its own preview server and resolves the
  address there.
- **Wireframes stay greyscale.** Color is a decision. A wireframe is about
  where things sit. A wireframe that needs color to make its point is a
  specimen.
- **The label goes outside the box.** `mk-label` sits on the page background,
  outside `wf-frame` / `mk-body`, never inside it. A label inside the specimen
  reads as part of the specimen and changes its spacing. That makes the
  specimen a lie about the layout it claims to depict. One label per specimen,
  too: a name outside the frame and a title inside it's the same fact twice.
- **Real values only.** Books use the seeded test corpus or synthesized data in
  its flavour, never live-instance content (see the publish-scrub rule).
