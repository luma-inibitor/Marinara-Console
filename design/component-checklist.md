# Component checklist

Every shared component in `src/ui/` must meet this checklist before it ships.
There are five sections and no maturity tiers, so a component either meets the
checklist or it doesn't.

The contrast sweep, stylelint and the tap-target sweep check sections 2, 3
and 4. You write section 1 and section 5 by hand.

Mark each line `yes`, `no` or `n/a`. Every `n/a` must state a reason.

---

## 1. States

List which of these nine states the component has. Mark the rest `n/a` with a
reason.

    default · hover · down · keyboard-focus · disabled
    selected · loading · read-only · error

- Style every state the component has with tokens, never with hardcoded values.
- State which of these three ways the component disables a control:
  - **avoid**: don't render the control when it can't act.
  - **`aria-disabled`**: the control stays in the tab order, so a screen reader
    can reach the reason it's disabled.
  - **native `disabled`**: the control leaves both the tab order and the
    accessibility tree. Use this only when the other two don't work, and write
    the reason in a code comment.
- State in text why a control is disabled. Colour alone isn't enough, and
  neither is removing the control from the page. `Button.tsx` does this with its
  `disabledReason` prop.
- Don't change the size of the component when it loads.

## 2. Colour

Checked by the contrast sweep and by stylelint.

- Text has a contrast ratio of at least 4.5:1. Large text has at least 3:1.
- Non-text parts of the interface, including state indicators, have at least
  3:1.
- The focus ring has at least 3:1 on both surfaces it touches.
- Never use colour as the only way to convey information.
- Both themes work. Never define a state only inside a media query.

## 3. Tailwind and tokens

Checked by stylelint and by the Tailwind lint rules.

- Use semantic tokens for every colour and every spacing value, never a
  hardcoded one.
- Style focus with `focus-visible:` rather than `focus:`. Skip links are the
  exception, because they must show for every input mode.
- Don't use an arbitrary-value class where a token already covers the value.
- Write every class string as a whole literal. Tailwind reads the source text,
  so `bg-${tone}` generates no CSS and the element renders without style and
  without an error. Put the variable in the lookup key instead, as `Button.tsx`
  does.

## 4. Tap target

Checked by the tap-target sweep.

- A primary control is at least 44px. A secondary control is at least 24px and
  has 8px of clearance. `DESIGN.md` §3 marks the 44px floor as open for review.
- The hit area may be larger than the visible control. Hit areas must not
  overlap.
- Everything available on hover is also available on focus.

## 5. Accessibility

Write the keyboard table and the focus contract by hand. axe checks the rest of
this section.

**Role and attributes.** State the role and every `aria-*` attribute the
component sets.

**Keyboard.** Write one row per key. A table containing only
`n/a — single tab stop` is valid.

| Key | Result |
| --- | ------ |

**Focus contract.** Fill this in for overlays and for composite widgets. Every
other component writes `n/a — not a surface`.

| | |
| --- | --- |
| opens | focus moves to ___ |
| Escape | ___ · a nested surface closes only its top layer |
| closes | focus returns to the trigger, or to the next element in DOM order that can take focus when the trigger no longer exists |
| trapped | yes / no |
| composite | arrows move within · Tab exits · Enter commits |

`src/shell/overlays.ts` records which element opened the surface and returns
focus to it. A component that registers with the overlay stack gets this
behaviour without writing any of it. State that the component registers with the
stack rather than writing the behaviour again.

**Provided and required.** State what the component handles and what the caller
must supply. An icon-only control that needs a label from the caller states that
here.

- axe reports zero violations.
- A screen reader reads the component correctly in its default state and in one
  more complex state.

---

## Where each line came from

This checklist draws on five design systems: Cloudscape, Adobe Spectrum, Carbon,
GitLab Pajamas, and GitHub Primer.

| Line | Source |
| --- | --- |
| The nine states, and listing which apply | Spectrum, which publishes the only canonical list and states that not every component has every state |
| `loading` and `read-only`, added to Spectrum's eight | Cloudscape, where they're the second and third most common states |
| `yes` / `no` / `n/a` rather than a checkbox | Spectrum, whose per-component data uses `n/a` often |
| The three ways to disable a control | Pajamas, which ranks them preferred, default and last resort |
| Stating in text why a control is disabled | The `disabledReason` prop in Cloudscape, and the split Primer draws between inactive and disabled |
| Contrast ratios | Spectrum and Carbon, both citing Web Content Accessibility Guidelines (WCAG) 1.4.3 and 1.4.11 |
| Never using colour as the only way to convey information | Spectrum, citing WCAG 1.4.1 |
| Both themes, and no state defined only in a media query | The four-theme rule in Spectrum, and the colour-modes criterion in Primer |
| Using tokens rather than hardcoded values | Primer, from its alpha criteria |
| `focus-visible:` rather than `focus:` | Pajamas, which already writes this rule in Tailwind terms |
| Hover content also being available on focus | The engineering checklist in Primer |
| Focus moving to the first element that can take focus when a surface opens | Primer. Carbon adds that a destructive dialog moves focus to cancel rather than to the danger button |
| A nested surface closing only its top layer | The dialog guidelines in Primer |
| Focus returning to the trigger, or to the next element that can take focus | Cloudscape, the only one of the five that covers a trigger that no longer exists |
| Arrows moving within, Tab exiting, Enter committing | Pajamas, which writes the clearest contract for composite widgets. None of the five uses the term "roving tabindex" anywhere. All five describe the behaviour instead |
| Provided and required | The split Cloudscape draws around what it handles, and the built-in accessibility features Primer lists |
| Zero axe violations | Primer, Cloudscape and Carbon all require this |
| A screen reader in the default state and one more complex state | Carbon, whose accessibility verification tests split the same way |

This checklist leaves out two things all five design systems publish: writing
guidance, and anatomy diagrams. Each would add a section, no check can
verify either one, and together they would turn a one-page checklist into a
three-page template that nobody fills in.
