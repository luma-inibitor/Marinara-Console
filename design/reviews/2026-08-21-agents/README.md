# 2026-08-21 user experience review — raw agent reports

> **Status: audited 2026-08-22.** These reports carry the findings as the
> reviewers wrote them on 2026-08-21, unedited. The codebase moved a long way
> since. The P0 batch shipped and a shared `src/ui/` component layer came out
> of it. The line numbers here no longer resolve, and some findings describe
> surfaces that no longer exist in that form. Every **[critical]** or
> **[high]** finding carries an inline status marker (`SHIPPED`, `OPEN`,
> `SUPERSEDED`, `UNVERIFIED`) naming the evidence, and the table below counts
> them. Findings without a marker went unaudited. Check those in the current
> code first, or you'll re-fix something already fixed.

Five parallel reviewers over the feat/memory-tool build (local mock corpus,
engine 2.4.4 + long-term-memory 1.2.9). These are the unabridged
per-dimension reports. The deduplicated, prioritized consolidation is one
directory up at `../2026-08-21-ux-review.md`.

| file | dimension | findings |
| --- | --- | --- |
| interaction.md | Review Queue interaction deep-dive | 19 (1 critical) |
| linkage.md | navigation / cross-surface linkage | 16 (2 high) |
| visibility.md | visibility of state, feedback, copy | 26 (3 high) |
| mobile-a11y.md | mobile ergonomics, a11y, design compliance | 18 (1 critical) |
| code-scan.md | wired-but-dead / unwired affordances | 20 (2 high) |

## Audit of 2026-08-22 — how much of this is still live

The audit covered only **[critical]** and **[high]** findings. Everything else
here says nothing about the current code either way.

| dimension | crit/high | audited | shipped | open | superseded | unverified |
| --- | --- | --- | --- | --- | --- | --- |
| interaction.md | 4 | 4 | 3 | 1 | 0 | 0 |
| mobile-a11y.md | 5 | 5 | 4 | 1 | 0 | 0 |
| visibility.md | 3 | 3 | 3 | 0 | 0 | 0 |
| code-scan.md | 2 | 2 | 2 | 0 | 0 | 0 |
| linkage.md | 2 | 2 | 1 | 1 | 0 | 0 |
| **total (raw)** | **16** | **16** | **13** | **3** | **0** | **0** |
| ../2026-08-21-ux-review.md | 14 | 14 | 11 | 3 | 0 | 0 |

Three raw findings stay open:

- the dock's unreconciled apply arithmetic (interaction.md)
- the missing roving tabindex in the review list (mobile-a11y.md)
- the absent vault-note → related-claims path (linkage.md)

BACKLOG.md carries them under "Still open from the 2026-08-21
UX review." The consolidated review's three open items are the same three
findings under its own numbering (2, 31, 50).

Nothing audited turned out superseded or unverifiable. Every critical/high
finding still described a surface that exists, and reading the source settled
each one. The dev server confirmed tap, Escape, browser-back, row density and
tab stops live at 390x844, 486x1085, and 1280x800.
