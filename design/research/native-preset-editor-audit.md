# Native preset editor — density & mobile audit (engine 2.4.4, mock data)

Captured from a local engine instance with only stock/mock content, desktop
1280×800 and mobile 390×844, Aug 2026. Screenshots are not committed (shots/
is ignored); re-capture with the st-notes harness — `dismissOverlays()` first,
click panel rows at their left edge, and expect stock presets to demand
"Create editable copy" before the editor opens.

## What the native editor does

Preset editor = three tabs. **Overview**: picture, name, description, wrap
format (XML / Markdown / None). **Sections**: reorderable list of prompt
sections (drag handle, up/down arrows, expand chevron, duplicate, enabled-eye,
delete per row; MARKER and group chips). **Prompts**: per-mode system prompts
(conversation, game). Explicit Save button; stock presets read-only behind a
copy interstitial.

## Findings against the dense-UI guidelines

1. **Mobile row titles truncate to one letter** — "Setting" → "S…",
   "Characters" → "C…", "Persona"/"Past Events" → "P…" — while *seven controls
   per row* (drag, up, down, chevron, duplicate, eye, delete) keep their full
   width. The one thing that identifies a row is destroyed to preserve controls
   a user touches rarely. Exactly inverted priority (survey §1: information
   scent; §2 data-ink).
2. **No data on rows.** Neither viewport shows token/char counts, content
   preview, or injection position — you must expand every section to learn
   anything. The total prompt cost appears nowhere in the editor at all.
3. **Enabled state is an eye icon + green color only** — icon-only, color-only
   (WCAG 1.4.1), and invisible as a *state* on scan.
4. **Desktop wastes the middle** — full-width rows carry a name on the left,
   controls on the right, and ~700px of empty dead center; 11 rows fill the
   screen with whitespace instead of information.
5. **~370px of mobile header** (top bar, title, save row, tabs, add-bar) before
   the first row.
6. **Hover-action pills** on panel rows intercept clicks on touch (documented
   in the harness troubleshooting).
7. **Explicit Save** with no dirty indicator; up/down single-step reorder as
   ~28px icon buttons.

## Console answers (implemented in `src/tools/presets/`)

- One tap target per row; every action lives in the detail (drawer / side
  panel). Titles wrap, never truncate.
- Rows carry data: role, ~tokens, MARKER/group chips, enabled via the status
  dot vocabulary (ok/off) with the state named in the detail.
- A budget-style meter totals enabled section + system prompt tokens — the
  number the native editor never shows.
- Reorder without drag: move up/down as 44px controls in the detail, writing
  `sectionOrder` on the preset.
- Field-level PATCH autosave with save pills; soft-delete with undo toast.
- Desktop master-detail (j/k, Enter); mobile inline accordion — same markup.
