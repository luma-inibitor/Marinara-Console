import { extendTailwindMerge } from "tailwind-merge";

/** Join Tailwind classes; on any property two of them set, the later wins.
 *
 *  Tailwind itself resolves that by the GENERATED sheet's order, not the
 *  written one, so a concatenated list renders unpredictably (DESIGN.md §8).
 *
 *  tailwind-merge does not read `@theme`: a new `--text-*`, `--color-*` or
 *  `--spacing-*` token must be added below and pinned in `cx.test.ts`, or it
 *  will not merge. */
export const cx = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["label", "label-s", "data", "data-s", "data-l", "prose", "title", "head"] }],
      // Colours are declared per property, or `text-ink` reads as a font size.
      "text-color": [{ text: THEME_COLORS() }],
      "bg-color": [{ bg: THEME_COLORS() }],
      "border-color": [{ border: THEME_COLORS() }],
      // The numeric spacing steps match tailwind-merge's own number rule; the
      // named tap floors do not.
      ...SPACING_GROUPS(),
    },
  },
});

function SPACING_GROUPS() {
  const groups: Record<string, unknown[]> = {};
  for (const g of ["w", "h", "min-w", "min-h", "max-w", "max-h", "size", "p", "px", "py", "m", "mx", "my", "gap"]) {
    groups[g] = [{ [g]: ["tap", "tap-2"] }];
  }
  return groups;
}

/** A function, not a shared array: tailwind-merge mutates the config it is given. */
function THEME_COLORS() {
  return [
    "canvas", "surface-1", "surface-2", "surface-3", "edge", "edge-strong",
    "ink", "dim", "faint",
    "ok", "warn", "danger", "off", "accent", "flag",
    "ok-ink", "warn-ink", "danger-ink", "accent-ink",
    "ok-wash", "warn-wash", "danger-wash", "accent-wash", "flag-wash",
    "scrim",
    "type-character", "type-relationship", "type-timeline-event",
    "type-thread", "type-world", "type-tone", "type-neutral",
  ];
}
