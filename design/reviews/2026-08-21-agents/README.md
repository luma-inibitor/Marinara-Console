# 2026-08-21 UX review — raw agent reports

> **Status: audited 2026-08-22.** These are the reports as they were written on
> 2026-08-21, and their findings haven't been edited. The codebase has moved
> substantially since — the P0 batch shipped and a shared `src/ui/` component
> layer was extracted — so the line numbers they cite no longer resolve and some
> findings describe surfaces that have since been rebuilt. Every finding at
> **[critical]** or **[high]** severity carries an inline status marker
> (`SHIPPED`, `OPEN`, `SUPERSEDED` or `UNVERIFIED`) naming the evidence, and the
> table below counts them. Findings without a marker weren't audited: check
> them against the current code before acting on them, or you will re-fix
> something that's already fixed.

Five parallel reviewers over the feat/memory-tool build (local mock corpus,
engine 2.4.4 + long-term-memory 1.2.9). The deduplicated, prioritized
consolidation is one directory up at `../2026-08-21-ux-review.md`; these are
the unabridged per-dimension reports.

| file | dimension | findings |
| --- | --- | --- |
| interaction.md | Review Queue interaction deep-dive | 19 (1 critical) |
| linkage.md | navigation / cross-surface linkage | 16 (2 high) |
| visibility.md | visibility of state, feedback, copy | 26 (3 high) |
| mobile-a11y.md | mobile ergonomics, a11y, design compliance | 18 (1 critical) |
| code-scan.md | wired-but-dead / unwired affordances | 20 (2 high) |

## Audit of 2026-08-22 — how much of this is still live

Only **[critical]** and **[high]** findings were audited. Everything else in
these reports is unaudited and says nothing about the current code either way.

| dimension | crit/high | audited | shipped | open | superseded | unverified |
| --- | --- | --- | --- | --- | --- | --- |
| interaction.md | 4 | 4 | 3 | 1 | 0 | 0 |
| mobile-a11y.md | 5 | 5 | 4 | 1 | 0 | 0 |
| visibility.md | 3 | 3 | 3 | 0 | 0 | 0 |
| code-scan.md | 2 | 2 | 2 | 0 | 0 | 0 |
| linkage.md | 2 | 2 | 1 | 1 | 0 | 0 |
| **total (raw)** | **16** | **16** | **13** | **3** | **0** | **0** |
| ../2026-08-21-ux-review.md | 14 | 14 | 11 | 3 | 0 | 0 |

The three open raw findings are the dock's unreconciled apply arithmetic
(interaction.md), the missing roving tabindex in the review list
(mobile-a11y.md), and the absent vault-note → related-claims path
(linkage.md). They're carried into BACKLOG.md under "Still open from the
2026-08-21 UX review". The consolidated review's three
open items are the same three findings under its own numbering (2, 31, 50).

Nothing audited turned out to be superseded or unverifiable: every
critical/high finding still described a surface that exists, and reading the
source settled each one, with tap, Escape, browser-back, row density and tab
stops confirmed live against the dev server at 390x844, 486x1085 and 1280x800.
