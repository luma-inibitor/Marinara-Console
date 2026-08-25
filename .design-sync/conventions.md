# Marinara Console — how to build with these components

A dark-only instrument panel for power users. Dense-first, data-as-ornament: no
decorative shadows, no gradients, hairline borders. Every component here is
already styled — your job is the layout glue around them.

## No wrapper, no provider

Components render correctly on their own. There is no theme provider and no root
wrapper to remember. Tokens live on `:root`, so importing the stylesheet is the
whole setup:

```jsx
import "./styles.css";           // tokens + fonts + component CSS, one closure

<Chip pressed onClick={…}>Constant</Chip>
```

Two optional attributes on `<html>` change global rendering:

- `data-theme="dark"` — the only theme that exists today. Light is a token swap
  that has not been done; do not design for it.
- `data-density="compact"` — tightens row padding and drops `--fs-title` by 1px.
  Default is comfortable.

## Style with tokens, not utility classes

This system is **hand-written CSS on design tokens**. There is no Tailwind
vocabulary to reach for and no `sx`/style-prop system. For your own layout glue,
write CSS that references these `var(--*)` names — all verified present in the
shipped stylesheet:

| family | names |
|---|---|
| surfaces | `--canvas` `--surface-1` `--surface-2` `--surface-3` `--edge` `--edge-strong` |
| text | `--text` `--text-dim` `--text-faint` |
| status (reserved) | `--ok` `--warn` `--danger` `--off` |
| chrome | `--accent` `--flag` `--warn-ink` `--scrim` |
| object-type hues | `--type-character` `--type-relationship` `--type-timeline-event` `--type-thread` `--type-world` `--type-tone` `--type-neutral` |
| type faces | `--font-label` `--font-data` `--font-prose` |
| space (4px grid) | `--s1` `--s2` `--s3` `--s4` `--s5` `--s6` |
| shape | `--r-s` `--r-m` `--r-l` `--hairline` `--focus-ring` |
| targets | `--tap` (44px primary) `--tap-2` (34px secondary) |
| elevation | `--shadow-pop` `--shadow-panel` `--shadow-modal` |
| prose width | `--measure` (68ch) |

**Three colour axes, and they do not mix.** `--accent` means *interactive* —
focus, selection, primary. The status four mean *state*. The `--type-*` hues mean
*identity* (which kind of object this is) and are always paired with the type name
in text. Never use a status hue for chrome, or `--accent` for anything
non-interactive.

## Three type faces, strict roles

| token | use for |
|---|---|
| `--font-label` | section labels, buttons, nav — 9.5–11px, caps, tracked |
| `--font-data` | **all** data: numbers, ids, keys, counts, timestamps, meta lines |
| `--font-prose` | sentences a human reads |

Never set data in the prose face or prose in mono. Four utility classes ship for
this and are the idiomatic way to apply it:

`.t-label` · `.t-label-s` (smaller caps) · `.t-data` · `.t-num` (tabular figures,
for numeric columns)

There is also `.hit`, which expands a small control's tap target without changing
its box.

## Where the truth is

Read these before styling anything — they beat this summary:

- `_ds/<folder>/styles.css` and its `@import` closure (`fonts/fonts.css`,
  `_ds_bundle.css`) — every token definition and every component rule
- `components/<Group>/<Name>/<Name>.d.ts` — the real prop contract
- `components/<Group>/<Name>/<Name>.prompt.md` — per-component usage

## Composition

Components take content as props and children rather than being configured by
variant strings. `EmptyState` is the base that `ErrorState`, `NotFound` and
`ListEmpty` compose — prefer the named one when it fits, because each fixes the
icon and tone you would otherwise have to get right yourself.

`IconButton` requires a `label` — it is the accessible name, not decoration.

```jsx
<div style={{ display: "grid", gap: "var(--s3)", padding: "var(--s4)",
              background: "var(--canvas)" }}>
  <SearchBar value={q} onInput={setQ} label="Search entries" count={rows.length} />

  <ListGroup
    collapsed={collapsed}
    onToggle={() => setCollapsed(!collapsed)}
    label="Characters"
    count={rows.length}
    head={<span className="t-label">Characters</span>}
  >
    {rows.map((r) => (
      <div key={r.id} style={{ display: "flex", alignItems: "center",
                               gap: "var(--s2)", minHeight: "var(--tap)",
                               borderBottom: "var(--hairline)" }}>
        <span className="t-data">{r.id}</span>
        <span style={{ flex: 1 }}>{r.title}</span>
        <Tag className="type-character">character</Tag>
      </div>
    ))}
  </ListGroup>

  {rows.length === 0 && (
    <ListEmpty kind="filtered" what="entries" onClearAll={() => setQ("")} />
  )}
</div>
```

## Two things to know

**Titles wrap, they never truncate.** The most important value on a row must
never be the one that gets cut. Let it wrap.

**One primary tap target per row**, at least `--tap` (44px). Secondary controls
may be smaller but need ≥8px spacing and a padded hit area — that is what `.hit`
is for.
