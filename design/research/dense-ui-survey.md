# Dense UI/UX Design Guidelines & Literature Survey

Two deliverables follow: **Report 1** is prescriptive, LLM-facing design guidance for information-dense poweruser UIs; **Report 2** is an annotated literature survey. Report 1 is written to be dense itself.

---

## REPORT 1 — Prescriptive Design Guidelines for Information-Dense UIs (LLM Reference)

### 0. How to use this document
You are generating UIs for expert users working with dense, relational data (triage, review/approval, faceted search, CRUD on deeply nested objects). Default to density, keyboard operability, and speed. Each rule is do-X / avoid-Y / because-Z. When a rule conflicts with a specific product's user research, the research wins; absent that, follow these defaults. Mobile is a first-class target — every pattern has a defined collapse (§12, §10).

### 1. Philosophy and goals
- **Treat density as respect for the expert user.** Power users live in one tool for hours a day; every extra click or scroll is a tax repeated thousands of times. Bloomberg's UX team explicitly frames its core constraint as "a tight, information-dense screen." Do NOT apply consumer-marketing spacing to poweruser tools — it wastes the expert's screen and slows scanning.
- **Optimize information scent (Pirolli & Card, information foraging).** Users decide whether to pursue or abandon a "patch" of the UI from proximal cues — labels, trigger words, icons. Make row/tab/link labels specific and predictive of what's behind them. Weak scent = wasted navigation and premature abandonment.
- **Progressive disclosure vs. everything-visible is a real tradeoff, not a bias toward hiding.** Nielsen: defer *advanced or rarely used* features to a secondary surface; keep everything users *frequently* need visible. Never exceed two disclosure levels — beyond that users get lost. For powerusers, bias toward showing more at once (that is the point of the tool); disclose only genuinely secondary detail.
- **"Don't make me click" for powerusers.** Every routine action should be reachable without navigation — via keyboard, inline editing, hover peek, or a command palette. Linear's model: navigation is search, issue creation is search.
- **Speed is a feature, not an implementation detail** (§7).

### 2. Information density: definition and measurement
- **Definition:** useful information plus interactive capability delivered per unit of screen space *and* per unit of time. A 200ms app is denser than a 3s app showing identical content.
- **Apply Tufte's data-ink ratio to UI chrome.** Maximize the share of pixels carrying data; erase non-data ink (heavy borders, full gridlines, decorative backgrounds, gratuitous shadows, oversized padding). Use one subtle row separator or whitespace instead of a full grid of lines.
- **Ship density modes.** Provide at least "comfortable" (default, balanced) and "compact" (data-intensive). Build both off a 4px base unit; compact reduces vertical spacing in 4px increments (Material's density scale and AWS Cloudscape both do this). Let the *user* choose and persist it. Gmail's Compact/Cozy/Comfortable is the canonical example.
- **Do NOT achieve density by shrinking type below readable limits.** Use a compact density mode with sane type (13-14px body), not 10px text. Shrinking type to fit more rows trades readability for count — a bad trade.

### 3. Organizing information: hierarchy, nesting, relational data
- **Master-detail is the workhorse layout** for triage, review, and record editing: list/table on one side, full record on the other. On desktop use a split pane; keep the list keyboard-navigable while the detail updates in place.
- **Choose the nesting strategy by depth and task:**
  - *Inline row expansion* — one shallow level of child data scanned in place (Carbon's expandable table). Don't nest expansions beyond one level.
  - *Side panel / drawer (non-modal)* — viewing/editing a record's details and child collections without losing list context. Preferred over modals for relational data because the parent context stays visible.
  - *Drill-down with breadcrumbs* — deep hierarchies where each level is itself rich. Always show a breadcrumb path back; never trap the user.
  - *Peek/hover popover* — a quick read of a cross-referenced entity without navigating away.
- **Flatten when comparison matters; preserve hierarchy when structure matters.** A flat, filterable table beats a tree when users compare across items. Keep the tree when parent-child relationships are the primary thing being edited.
- **Never nest modals** (§6). Use a side panel or a dedicated page.

### 4. Core patterns (and how to build them)
- **Data tables** (the component powerusers live in — get it right):
  - Sticky header once the table exceeds one screen; add a subtle shadow on the sticky header only while scrolling.
  - Freeze the identifier/first column during horizontal scroll in wide tables.
  - Left-align text; right-align numbers; align headers to their column content. Never center-align data. Use tabular/monospaced numerals so digits and decimals line up.
  - Omit repeated words in cells (put "Lead" in the header, not in every cell) to cut visual noise.
  - Inline editing for single-value, spreadsheet-style edits (typo, status). Push multi-field or cross-field-validated edits to a side panel or modal (Pencil & Paper, PatternFly).
  - Reveal row checkboxes and row actions on hover on desktop — but ALSO expose them for touch and keyboard (never hover-only; §6, §10).
  - Column management: let users show/hide, reorder, and resize columns; indicate hidden-column count.
  - Bulk actions: show a contextual action bar only once ≥1 row is selected.
  - Virtualize (window) rather than paginate for large scrollable datasets (§7).
- **Saved views / filters:** let users name, save, and share filter+sort+column configurations — a top poweruser accelerator.
- **Faceted filtering:** show the 3-5 highest-value facets inline; put the long tail behind "Advanced." Reflect active filters as removable chips so the current view is always legible.
- **Command palette (Cmd/Ctrl-K):** provide one. It is the discoverability backstop for every action and shortcut and the fastest navigation for powerusers (GitHub, Linear, VS Code, Superhuman). Search local state, not the server, so it's instant.
- **Inspector panel:** a persistent right-side panel showing properties of the current selection (VS Code, design tools). Good for dense attribute editing.
- **Keyboard-driven triage queue (Superhuman/Linear style):** J/K to move, Enter/O to open, single keys to act (E = archive, etc.), auto-advance to the next item after acting. The fastest known pattern for review/approval workflows.

### 5. Keyboard support
- **Layer shortcuts by frequency:** single keys for the most frequent actions on the focused object; two-key sequences (`g` then `i` = go to inbox, Gmail/Linear) for navigation; chorded modifiers (Cmd-K, Cmd-Enter) for global/app-level actions. Gmail and Linear use single letters for the most-used actions because they're used most.
- **Make shortcuts discoverable:** show hints in the UI (Superhuman shows shortcut hints inline), provide a `?` cheat-sheet overlay, and surface each action's shortcut in the command palette and context menus. Superhuman deliberately shows the shortcut every time you use the palette so users graduate to muscle memory.
- **Focus management is mandatory.** WCAG 2.1.1 requires all functionality operable by keyboard. Use the WAI-ARIA APG composite-widget patterns. Implement **roving tabindex** (focused item `tabindex=0`, siblings `tabindex=-1`) or `aria-activedescendant` for lists, grids, toolbars, trees, and menus so the composite is a single tab stop with arrow-key navigation inside.
- **Use the ARIA `grid` pattern for editable/navigable tables** (2-D arrow navigation, `aria-colindex`/`aria-rowindex`, Enter to edit a cell, Escape to exit). Heed Adrian Roselli's caveat ("ARIA Grid As an Anti-Pattern"): `role=grid` adds real complexity — you must hand-manage entering/exiting interactive cell contents — so prefer a native `<table>` for static data and only reach for `role=grid` when true cell navigation is required.
- **Vim-style j/k/h/l** is a proven mental model for developer/poweruser audiences; offer it where the audience expects it.
- Never trap focus except intentionally in a modal, and restore focus to the trigger on close.

### 6. Anti-patterns (do NOT do these)
- **Over-modaling.** Modals block context and serialize work. Use side panels/drawers for detail and editing; reserve modals for short must-decide-now interruptions and destructive confirmations.
- **Nested/infinite modals.** Never open a modal from a modal.
- **Consumer-style padding/whitespace in poweruser tools.** 24px paddings and huge line-heights waste the expert's screen; use tighter paddings (4/8/12px) in dense contexts.
- **Hover-only actions on touch.** Anything revealed on hover is invisible on touch. Provide a persistent affordance (kebab menu, long-press, or an always-visible control) as well.
- **Pagination where virtualization is right.** For continuous scanning of large datasets, windowed lists beat page-by-page. (Pagination is still fine as a DOM/perf bound or when users jump to known pages.)
- **Hamburger-menu abuse on desktop.** Nielsen Norman Group's Dec-2015 quantitative study (179 UK participants, 6 sites; Pernice/Whitenton) found "discoverability is cut almost in half by hiding a website's main navigation"; on desktop "people used the hidden menus in only 27% of the cases, while they used visible or combo navigation almost twice as much: in 48% and 50% of the cases." Keep primary nav visible in dense desktop tools.
- **Low-contrast gray-on-gray text.** This is the most common accessibility failure: per the WebAIM Million 2026 report (Feb 2026), "low contrast text, below the WCAG 2 AA thresholds, was found on 83.9% of home pages" (up from 79.1% in 2025), averaging 34 instances per page. Meet WCAG AA (§9).
- **Icon-only buttons without labels or tooltips.** Ambiguous icons cost recognition time; always provide a tooltip and, for primary actions, a visible label.
- **Destructive actions without undo.** Prefer undo (with a toast) over a confirm dialog for reversible bulk actions; reserve confirm dialogs for truly irreversible operations. Linear/Gmail-style "Undo" is faster and less annoying than constant confirmation.
- **Over-reliance on tooltips for critical info.** Tooltips are invisible on touch and to many keyboard/AT users; never hide information users *need* behind hover-only tooltips.
- **Spinners everywhere** (§7 for the alternative).

### 7. Performance and perceived speed
- **Latency budgets — Nielsen's three limits** ("Response Times: The 3 Important Limits," an excerpt of *Usability Engineering* 1993, based on Miller 1968 and Card et al. 1991):
  - **0.1s (100ms):** the limit for feeling the system reacts instantaneously; no special feedback needed beyond showing the result. Budget this for taps, toggles, filters, inline edits.
  - **1.0s:** the limit for the user's flow of thought staying uninterrupted; the user notices the delay but stays in control.
  - **10s:** the limit for keeping attention on the task; beyond it, show a determinate progress indicator and let the user do other things.
  - **Doherty Threshold** — Doherty & Thadani, "The Economic Value of Rapid Response Time," *IBM Systems Journal*, Nov 1982: "When a computer and its users interact at a pace that ensures that neither has to wait on the other, productivity soars, the cost of the work done on the computer tumbles" — setting the response-time requirement at 400ms vs. the prior 2-second standard. ~400ms is the practical flow target; Google's INP treats ≤200ms as good responsiveness.
- **Optimistic UI for predictable, low-risk actions.** Update the UI immediately and reconcile with the server in the background; the network becomes a confirmation, not a permission gate (Linear's local-sync model). Roll back with a brief flicker on the rare failure. Use for likes, toggles, status changes, marking done. (Simon Hearne / Remix frame the decision: busy indicator when the outcome is unpredictable, optimistic when predictable, skeleton fallback when the data is non-critical.)
- **Loading-state ladder:**
  - <1s: no indicator (avoid flicker); optionally delay any spinner ~100ms so it never flashes for fast responses (GitLab Pajamas does exactly this).
  - Short waits: skeleton screens where the layout is predictable (feeds, lists, cards, tables); spinner for unstructured content (charts) and short blocking actions. eBay Playbook: skeletons only for loads ≥500ms; Carbon: skeletons should appear ~1-3s.
  - 3-10s: determinate progress bar.
  - 10s+: progress bar + percentage/status, and let the user multitask.
  - **Skeletons are NOT a guaranteed win.** Viget's study (Katherine Olvera, "A Bone to Pick with Skeleton Screens") found: "We gave the test to 136 people, and the skeleton screen performed the worst by all metrics" — the skeleton group "took longer to complete the task" and "guessed that the wait time had been longer" than spinner or blank-screen groups (70 of 136 participants sourced via Amazon Mechanical Turk). Peer-reviewed work (Mejtoft et al., 2018) found the opposite on *perceived* speed, and Bill Chung found a slow left-to-right shimmer perceived as slightly shorter. Net: effect sizes are small and context-dependent — use skeletons where layout is known, keep them short, and don't treat them as an automatic upgrade.
- **Virtualize/window large lists and tables** (react-window and similar): render only visible rows plus a small overscan buffer. Start considering it around 500+ items; it keeps the DOM small and scrolling smooth. Caveat: virtualized content is invisible to native Ctrl-F and can harm screen-reader access — provide in-app search and test with AT.
- **Prefetch** likely-next data (the record about to open, the next page) to stay under 100ms perceived.

### 8. Static vs. real-time data
- **Don't yank content out from under the user.** When new data arrives above the current scroll position, preserve scroll position (compensate for inserted height) so the user doesn't lose their place — a long-standing failure mode of live feeds.
- **Separate interaction urgency from data urgency.** A click/keystroke must feel immediate; a background update does not. Schedule live updates so they don't interrupt interaction (e.g., React `startTransition`); commit visual changes only when they won't disrupt the user.
- **Pause live updates during active interaction** (while a row is selected, a menu is open, or the user is typing); apply queued updates when idle. This aligns with WCAG 2.2.2, whose recommended model for status data is pause-and-jump-to-current.
- **Show a stale-data/freshness indicator** ("updated 3s ago") and a manual refresh for data that changed while paused.
- **Signal insertions/reordering gently** (fade-in, sub-300ms slide) to counter change blindness — but never let motion reorder items under an active pointer or selection.

### 9. Color
- **Functional, not decorative.** Color is a signal. Use a small semantic palette (success/warning/error/info + neutrals) and reserve one saturated accent for primary action/focus (Linear uses a single accent for action and status).
- **Never encode information by color alone** (WCAG 1.4.1). Pair status color with an icon, shape, or text label — critical for red-green color-vision deficiency, which affects about 8% of men and ~0.5% of women of European ancestry (Britannica; Deeb/Wong review, *J. Opt. Soc. Am. A*, 2012: "about 8% in men and about 0.4% in women").
- **Meet WCAG AA contrast:** 4.5:1 for normal text, 3:1 for large text (18pt/14pt bold) and for UI components/focus indicators (1.4.3, 1.4.11). Re-check contrast in *both* light and dark themes.
- **Dark mode for long sessions:** avoid pure white (#fff) on pure black — it causes halation/eye strain; use off-white (~#E0-#F0) on dark gray (~#121-#1E). Desaturate saturated hues on dark backgrounds. Build a surface ladder (canvas → surface-1..n) for depth without heavy shadows (Linear's approach).
- Use colorblind-safe pairings and verify every pair with a contrast checker (WebAIM).

### 10. Navigation across input modalities (one UI, three inputs)
- **Mouse:** hover affordances are fine as *enhancements* (reveal row actions, show peek popovers), plus right-click context menus for power actions. Never make hover the *only* path.
- **Keyboard:** logical focus order, visible focus ring (≥3:1 contrast), arrow-key list/grid navigation, shortcuts, `?` cheat sheet.
- **Touch:** minimum **44×44px** (Apple HIG) / 48dp (Material) targets; the WCAG 2.2 AA floor is 24×24px with spacing, but design to 44px. Keep ~8px between targets and ≥16px from screen edges (system-gesture zones). No hover — replace with tap, long-press (context menu/preview), and swipe (act). Provide visible gesture affordances and always a non-gesture fallback.
- Serve all three with one UI: dense rows with generous *hit areas* (padding expands the target without expanding the visual), actions reachable by click, key, and tap.

### 11. Component selection
- **Table vs. list vs. cards:** table when users compare many attributes across rows and take bulk actions; list for single-line scannable items; cards for visual/heterogeneous content or as the mobile collapse of a table.
- **Tabs** for a few peer views of one object; **trees/treegrids** for hierarchy you edit.
- **Accordions:** weak on desktop (often just add clicks — with screen space available, prefer showing sections), but *strong on mobile*, where they compress long pages into a scannable table of contents and beat both endless scrolling and screen-pushing for sectioned content. Rules for using them well:
  - Show summary data in the collapsed header (counts, status badges, key values) so closed ≠ invisible — information scent applies to disclosure controls too.
  - Allow multi-expand; auto-closing siblings destroys user state and causes scroll jumps.
  - Persist expand/collapse state across navigation and refresh.
  - Full-width tap target on the header, chevron on a consistent side, ≥44px tall.
  - Never hide validation errors inside a collapsed section — badge the header or auto-expand on error.
  - One level only. Nested accordions are the modal-in-modal of disclosure.
  - Do NOT use accordions for content users must *compare* across sections — comparison wants everything visible or a table, not sequential peeking.
- **Combobox/typeahead** for selecting from many options; **multi-select + tag input** for applying several values; **segmented control** for 2-5 mutually exclusive options.
- **Toolbars** (roving tabindex) group actions; **status bars** show persistent context/state; **badges** show counts/status; **split buttons** pair a default action with a menu of variants.
- **Toasts vs. inline validation:** inline field-level validation for form errors (at the field, icon + text); toasts for transient confirmations and undo. Don't put critical must-act errors only in a disappearing toast.
- **Density toggle** in settings (comfortable/compact).

### 12. Starter layouts (and their mobile collapse)
- **Triage queue (review/approval):** left = keyboard-navigable list of items with key fields + status; right = full detail of the focused item; top = filter/saved-view bar; single-key actions with auto-advance. **Mobile:** list becomes full-screen; tapping an item pushes the detail as a stacked screen (back returns to list); primary actions become swipe actions + a bottom action bar; bulk-select via a persistent "select" mode.
- **Filter + results (faceted search):** left = facet sidebar (top facets inline, rest under Advanced); center = virtualized results table with sticky header, column management, active-filter chips; optional right = detail/peek panel. **Mobile:** facets move into a bottom sheet triggered by a "Filters" button (with an active-count badge); table becomes a card list showing 3-4 priority fields.
- **Nested-object editor (CRUD on relational data):** left = navigation tree or record list; center = the record's own fields; right/inline = child collections and cross-references (side panel to edit a child without leaving the parent); breadcrumbs for depth. **Mobile:** stacked navigation; the side panel becomes a bottom sheet; child collections become pushed screens.
- **Master-detail generally → stacked navigation on mobile;** side panel → bottom sheet; wide table → card list (priority columns) or horizontal scroll with a pinned first column.

### 13. Interaction and feedback
- **Affordances & state visibility:** make interactive things look interactive (cursor changes, hover states on mouse) and always show system state (selected, loading, saved, error). Visibility of system status is Nielsen heuristic #1.
- **Selection models:** support click-to-select, Shift-click range, Cmd/Ctrl-click toggle, select-all, and keyboard equivalents. Show selection count and bulk actions.
- **Inline editing:** click/Enter to edit, Enter/blur to commit, Escape to cancel; validate inline; confirm save state.
- **Undo vs. confirm:** default to undo for reversible actions; confirm only for irreversible ones (and state what will happen).
- **Empty states:** tell the user what the view is and the next action (create, import, adjust filters) — never a blank pane.
- **Error handling:** inline, specific, near the cause, with how to fix; never color-only.
- **Form design for dense editors:** group related fields (Miller's ~7±2 chunking, with the caveat that chunk size is task-/expertise-dependent), label clearly, use appropriate inputs, and support tabbing and keyboard submit (Cmd-Enter).

### 14. Motion and space
- **Purposeful animation only:** orientation (where a panel came from), causality (this action produced that result), continuity (item moved here). Not decoration.
- **Duration ~100-300ms;** animate GPU-composited properties (transform, opacity) to stay smooth; avoid paint-heavy properties. Respect `prefers-reduced-motion` and drop non-essential motion.
- **Spacing systems:** use a 4px or 8px base grid religiously; consistent spacing is what makes dense layouts read as intentional rather than cramped.
- **Typography for density:** 12-14px data/body text with tight-but-readable line-height (~18-20px); tabular numerals for numeric columns; limit weights; use hairline separators. Linear runs a low 400-510 weight band with hairline (~0.5px) borders and 6-12px radii/paddings — density plus calm.

---

## REPORT 2 — Literature Survey / Annotated Bibliography

### A. Academic & scientific foundations
- **Miller, G. A. (1956), "The Magical Number Seven, Plus or Minus Two," *Psychological Review* 63(2):81-97.** Working memory holds ~7±2 chunks. *Use:* basis for chunking/grouping. *Caveat:* modern work suggests ~4 chunks and chunk size is task/expertise-dependent — do not use "7" as a hard cap on nav items.
- **Fitts, P. M. (1954), *J. Experimental Psychology* 47(6):381-391.** Time-to-target = f(distance, size). *Use:* sizing/placement of buttons and touch targets; edges/corners are effectively large targets.
- **Hick, W. E. (1952) & Hyman (1953), the Hick-Hyman Law.** Decision time rises logarithmically with number/complexity of choices. *Use:* argues for progressive disclosure and curated defaults. *Caveat:* doesn't apply to expert scanning of familiar dense sets (Photoshop, Bloomberg), where more options are expected.
- **Pirolli, P. & Card, S. (1999), "Information Foraging," *Psychological Review* 106(4):643-675;** Pirolli, *Information Foraging Theory* (Oxford, 2007). Information scent, patches, diet, and the marginal-value decision to leave a patch. The core theory behind label quality, nav cues, and search. Free PDF via ACT-R/CMU; summary at nngroup.com/articles/information-foraging.
- **Doherty, W. J. & Thadani, A. J. (1982), "The Economic Value of Rapid Response Time," *IBM Systems Journal*.** Productivity soars below ~400ms response. The "speed is a feature" evidence base; consult for latency budgets.
- **Nielsen, J., "Response Times: The 3 Important Limits,"** nngroup.com/articles/response-times-3-important-limits/ (excerpt of *Usability Engineering*, 1993; from Miller 1968 and Card et al. 1991). The 0.1s / 1s / 10s limits verbatim — the single most useful performance citation. Companions: "Website Response Times" (2010), "Powers of 10: Time Scales in UX" (2009).
- **Nielsen, J. (1994), "10 Usability Heuristics for UI Design,"** nngroup.com. Visibility of system status, user control/freedom, error prevention, recognition over recall, etc. Baseline heuristic-evaluation checklist.
- **Tufte, E., *The Visual Display of Quantitative Information* (1983), *Envisioning Information* (1990).** Data-ink ratio, chartjunk, small multiples, "above all else show the data." Applied to UI chrome (data-pixel ratio) it justifies erasing borders/backgrounds and maximizing content. *Caveat:* strict minimalism can hurt engagement — apply "within reason," as Tufte says.
- **Sweller, J. (1988+), Cognitive Load Theory.** Intrinsic/germane/extraneous load; progressive disclosure and clean layout reduce extraneous load. Consult for complex forms and dense screens.
- **Gestalt principles (proximity, similarity, common region, closure).** Grouping, visual hierarchy, card/section boundaries.
- **Preattentive processing / visual search & change blindness.** What the eye catches instantly (color, position, motion) and why silent live updates get missed — hence gentle animation of changes.

### B. Books
- **Krug, S., *Don't Make Me Think* (Revisited, 2014).** Self-evident design, scannability. Reducing cognitive friction.
- **Norman, D., *The Design of Everyday Things* (rev. 2013).** Affordances, signifiers, mapping, feedback, error — the mental-model foundation for §13.
- **Cooper, A. et al., *About Face* (4th ed., 2014).** Goal-directed design, interaction patterns, "excise" (unnecessary work) — directly relevant to "don't make me click."
- **Tidwell, J., *Designing Interfaces* (3rd ed., 2020).** Pattern library: tables, master-detail, panels, forms. The closest pattern encyclopedia for this scope.
- **Wathan, A. & Schoger, S., *Refactoring UI* (2018).** Practical hierarchy, spacing, color, semantic-color and contrast tactics. Concrete visual craft.
- **Few, S., *Information Dashboard Design* (2nd ed., 2013).** Dense display, decluttering, non-data-ink for dashboards.
- **Yablonski, J., *Laws of UX* (2nd ed., 2024).** Compact reference tying the psychology laws to design; quick lookup.
- **Hoober, S., *Touch Design for Mobile Interfaces* (2021).** Empirical touch-target and thumb-zone research; consult for §10.

### C. Practitioner sources — design systems (density-relevant)
- **IBM Carbon** (carbondesignsystem.com) — data-table usage (expandable rows, batch expansion, toolbar), loading pattern (skeletons ~1-3s; spinner for whole-page processing). Strong enterprise/data guidance.
- **Salesforce Lightning (SLDS 1 & 2)** (lightningdesignsystem.com) — enterprise data tables (sort, inline edit, row selection), ARIA baked in. For CRM-style dense record UIs.
- **GitHub Primer** (primer.style) — loading pattern (spinner vs. skeleton), command-palette docs, skeleton loaders (avoid on interactive elements).
- **Atlassian Design System** — enterprise patterns, inline editing, drawers.
- **Material Design 3** (m3.material.io) — density scale (default/comfortable/compact; each step −4px), 48dp targets, adaptive layouts/window size classes, bottom sheets/nav. Density mechanics and responsive/mobile.
- **AWS Cloudscape** (cloudscape.design) — explicit comfortable/compact content-density modes off a 4px unit; strong dense-app rationale.
- **PatternFly (Red Hat)** (patternfly.org) — inline edit (row/field/full-page), skeleton decision logic.
- **Apple HIG** — 44×44pt targets, gestures, platform conventions for touch.
- **Shopify Polaris** — spinner scope rules (not for full-page load; skeletons instead).
- **GitLab Pajamas** — 100ms spinner delay to avoid flashing; skeleton-vs-spinner rules.
- **eBay Playbook** — skeletons for loads ≥500ms; shimmer motion specs; omit large shimmer on wide web screens.

### D. Practitioner sources — essays, teardowns, talks
- **Linear** — "How we redesigned the Linear UI," "A calmer interface for a product in motion" (linear.app/now); First Round Review "Linear's Path to PMF." Density + speed + keyboard-first; optimistic UI via local sync. Third-party teardowns: performance.dev "How is Linear so fast," techplanet "How Linear Achieves Blazing-Fast Performance" (MobX + IndexedDB local-first, GPU-only animation); Identity Forge "The Linear design system, read as constraints" (density → hairlines, small radii).
- **Superhuman** — "Why Superhuman is built for speed: the 100ms rule" (blog.superhuman.com). Keyboard-first triage, a command palette that teaches shortcuts, minimal animation. Blake Crosley, "Superhuman: Speed as the Product" (internal 50-60ms target; palette as teaching tool).
- **Bloomberg UX** (bloomberg.com/ux) — "How Bloomberg Terminal UX designers conceal complexity," contextual-inquiry method; the canonical dense finance terminal. UX Magazine, "The Impossible Bloomberg Makeover" (why the dense/"ugly" UI persists as a status/lock-in artifact — a caution about redesigning expert tools).
- **Pencil & Paper, "Data Table Design UX Patterns & Best Practices"** (pencilandpaper.io) — the most thorough enterprise data-table catalog (alignment, density, inline edit, quick-view sidebar, bulk actions). Highly recommended.
- **NN/g, "Data Tables: Four Major User Tasks"** (nngroup.com/articles/data-tables) — find/compare/edit/act framework; responsive table strategies.
- **Setproduct, "Data table UI design reference"** — density modes mapped to audiences; table anti-patterns (tiny font for density, hover-only actions, excessive borders).
- **Smashing Magazine** — "UX Strategies for Real-Time Dashboards" (data-freshness indicators, sub-300ms reorder animation, don't-rely-on-color); Steven Hoober's tap-target research; Smart Interface Design Patterns loading-UX threshold ladder.
- **Andrew Coyle, "Design Better Data Tables"** — GIF-driven pattern catalog. **Stéphanie Walter, "Enterprise UX: essential resources to design complex data tables."**
- **Viget, "A Bone to Pick with Skeleton Screens" (2017)** — 136-participant study finding skeletons performed *worst* on perceived speed vs. spinner/blank; the essential counter-evidence. Balance with Mejtoft et al. (2018, peer-reviewed, skeletons scored higher on perceived speed) and Bill Chung's "Everything you need to know about skeleton screens" (uxdesign.cc; slow left-to-right shimmer perceived shorter; small samples).
- **Simon Hearne, "Optimistic UI Patterns" (2021)** and **Remix docs, "Pending and Optimistic UI"** — decision framework: busy indicator (unpredictable) vs. optimistic (predictable) vs. skeleton fallback (non-critical data).
- **Addy Osmani** — "Infinite Scroll without Layout Shifts"; virtualization write-ups; web.dev "Virtualize large lists with react-window."

### E. Accessibility standards
- **WCAG 2.1 / 2.2 (W3C)** — key criteria here: **1.4.1 Use of Color** (never color alone), **1.4.3 Contrast (Minimum)** (4.5:1 text / 3:1 large & UI), **1.4.11 Non-text Contrast**, **2.1.1 Keyboard**, **2.2.2 Pause/Stop/Hide** (auto-updating content — for status data, pause-and-jump-to-current is the recommended model), **2.5.5/2.5.8 Target Size** (AAA 44px; AA 24px min with spacing).
- **WAI-ARIA Authoring Practices Guide (APG)** (w3.org/WAI/ARIA/apg) — patterns for **grid/treegrid, listbox, combobox, menu/menubar, toolbar, tabs**, plus "Developing a Keyboard Interface" (roving tabindex vs. aria-activedescendant). The implementation reference for §5.
- **Adrian Roselli, "ARIA Grid As an Anti-Pattern"** (adrianroselli.com) — prefer native `<table>`; only use `role=grid` when you truly need cell navigation, and budget for the extra keyboard complexity.
- **WebAIM** — Contrast Checker and "Contrast and Color Accessibility"; the WebAIM Million (low-contrast text is the most common failure, on 83.9% of home pages in the 2026 report). Practical testing.
- Accessibility caveat for virtualization/infinite scroll: windowed content isn't in the DOM, breaking native find and some AT — provide in-app search and test with a screen reader.

### F. Quick "which source when" index
- *Latency/perceived speed:* Nielsen response-time limits; Doherty & Thadani; Simon Hearne; GitLab/eBay/Carbon loading docs; Viget (skeleton skepticism).
- *Tables:* Pencil & Paper; NN/g Data Tables; Carbon/SLDS/PatternFly; Setproduct.
- *Keyboard/focus/ARIA:* WAI-ARIA APG; Roselli; WCAG 2.1.1.
- *Density mechanics:* Material density; Cloudscape; EightShapes "Space in Design Systems"; Tufte.
- *Foraging/navigation/scent:* Pirolli & Card; NN/g information-foraging.
- *Mobile/touch:* Apple HIG; Material; Hoober; Smashing/NN/g tap-target research.
- *Philosophy/craft:* Linear essays; Superhuman speed blog; Bloomberg UX; Refactoring UI; Krug; Norman; Cooper; Tidwell.

---

### Notes on evidence quality
- The Doherty "400ms," Nielsen "0.1/1/10s," Fitts, Hick, and Miller figures are from named primary sources and are reliable, though Miller's "7±2" is widely over-applied (modern estimate ≈4 chunks; treat as a soft guideline).
- Skeleton-screen benefits are **contested** — the Viget, Mejtoft, and Chung studies disagree and effect sizes are small; do not present skeletons as an automatic perceived-speed win. Widely-circulated "skeletons feel 20-30% faster / cut bounce 9-20%" figures appear only in SEO/marketing content without traceable studies — do not rely on them.
- Touch-target numbers converge (Apple 44pt, Material 48dp, WCAG 2.2 AA 24px-with-spacing, AAA 44px) but derive from the same MIT Touch Lab fingertip data (~16-20mm); 44px is the safe practical default.
- Bloomberg's persistence of a dense, dated-looking UI is partly status/lock-in, not pure usability — a reminder that expert-tool redesigns must preserve familiarity (Bloomberg's own "hide complexity, keep familiarity" framing).