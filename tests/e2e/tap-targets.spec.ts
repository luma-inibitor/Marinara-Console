// design/DESIGN.md §2 and §7: every control a screen offers, measured against
// the tap floors, with the undersized ones held to a recorded list.
//
// Gotcha: clearance is Infinity when nothing else shares a target's layer and
// <nav> side, and `!(Infinity < TAP_GAP)` grades such a target secondary. Each
// screen asserts a pair under TAP_GAP before it trusts that grading.

import type { Page } from "@playwright/test";
import { SCREENS, openScreen } from "./screens";
import { installPageHelpers } from "./page-helpers";
import { expect, test } from "./harness";

// §2's floors: primary at 44, secondary from 24 while it clears 8 of its
// neighbours, nothing legitimate below 24.
const TAP_PRIMARY = 44, TAP_SECONDARY = 24, TAP_GAP = 8;

interface Undersized {
  /** `tag` plus its classes, so a copy rewording cannot move an entry. */
  sig: string;
  min: number;
  /** Edge-to-edge distance to the nearest other target, or null for Infinity. */
  gap: number | null;
  secondary: boolean;
  label: string;
}

interface Report {
  undersized: Undersized[];
  tightestGap: number | null;
  targets: number;
}

/** Measured defects, `<viewport>/<screen>` to `<count>× <sig> <min>px`. Three
 *  of them are BACKLOG.md's "Known check failures"; a screen with none is absent. */
const RECORDED: Record<string, string[]> = {
  "narrow/preset-editor": ["2× button.row-summary 40px"],
  "phone/preset-editor": ["2× button.row-summary 40px"],
  "tablet/preset-editor": ["2× button.row-summary 40px"],
  "desktop/preset-editor": ["2× button.row-summary 40px"],
  "narrow/memory-review": ["1× button.notelink.t-data 18px", "5× button.mem-mid 35px"],
  "phone/memory-review": ["1× button.notelink.t-data 18px", "9× button.mem-mid 35px"],
  "tablet/memory-review": ["1× button.notelink.t-data 18px", "9× button.mem-mid 35px"],
  "desktop/memory-review": ["1× button.notelink.t-data 18px", "5× button.mem-mid 35px"],
  "narrow/memory-sources": ["1× a.qchip.qblock 30px", "3× button.mseg.hit 42px"],
  "phone/memory-sources": ["1× a.qchip.qblock 30px", "2× button.mseg.hit 42px"],
};

function tally(failing: Undersized[]): string[] {
  const counts = new Map<string, number>();
  for (const t of failing) {
    const key = `${t.sig} ${t.min}px`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, n]) => `${n}× ${key}`).sort();
}

async function grade(page: Page): Promise<Report> {
  return page.evaluate(([primary, secondary, gapFloor]) => {
    const h = window.mcHelpers;
    // Targets on different layers are never reached by the same tap, so the
    // distance between them is not a clearance.
    const layerOf = (el: Element): Element | null => {
      for (let p: Element | null = el; p && p !== document.documentElement; p = p.parentElement) {
        if (getComputedStyle(p).position === "fixed") return p;
      }
      return null;
    };
    interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }
    interface Target { el: Element; r: Rect; group: Element | null; layer: Element | null }

    const targets: Target[] = [];
    for (const el of document.querySelectorAll("button, a, input, select, [role=button]")) {
      if (!h.vis(el) || el.closest("[data-verify-exempt]")) continue;
      // A wrapping <label> forwards its clicks, so the label is the target.
      const host = (el.matches("input, select, textarea") && el.closest("label")) || el;
      const raw = host.getBoundingClientRect();
      const r = h.clipTo(host, (host.classList.contains("hit") && h.padBox(host, raw)) || raw);
      if (!r) continue;
      targets.push({
        el,
        r: { ...r, width: r.right - r.left, height: r.bottom - r.top },
        group: el.closest("[role=group]"),
        layer: layerOf(el),
      });
    }

    // Edge-to-edge distance to the nearest other target. Two members of one
    // [role=group] are segments of one control. A cross-<nav> pair reflects
    // scroll position, not layout.
    const clearance = (a: Target): number => {
      let best = Infinity;
      const aNav = !!a.el.closest("nav");
      for (const b of targets) {
        if (b === a || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (a.group && a.group === b.group) continue;
        if (aNav !== !!b.el.closest("nav")) continue;
        if (a.layer !== b.layer) continue;
        const dx = Math.max(0, a.r.left - b.r.right, b.r.left - a.r.right);
        const dy = Math.max(0, a.r.top - b.r.bottom, b.r.top - a.r.bottom);
        best = Math.min(best, Math.hypot(dx, dy));
      }
      return best;
    };

    const undersized = [];
    let tightestGap = Infinity;
    for (const t of targets) {
      const gap = clearance(t);
      tightestGap = Math.min(tightestGap, gap);
      const min = Math.min(t.r.width, t.r.height);
      if (min >= primary) continue;
      undersized.push({
        sig: t.el.tagName.toLowerCase() + [...t.el.classList].map((c) => `.${c}`).join(""),
        min: Math.round(min),
        gap: Number.isFinite(gap) ? Math.round(gap * 10) / 10 : null,
        secondary: min >= secondary && !(gap < gapFloor),
        label: h.label(t.el),
      });
    }
    return { undersized, tightestGap: Number.isFinite(tightestGap) ? Math.round(tightestGap * 10) / 10 : null, targets: targets.length };
  }, [TAP_PRIMARY, TAP_SECONDARY, TAP_GAP]);
}

for (const screen of SCREENS) {
  test(screen.name, async ({ page }, info) => {
    await installPageHelpers(page);
    await openScreen(page, screen);
    const report = await grade(page);
    const key = `${info.project.name}/${screen.name}`;

    expect(report.targets, `${key} found no tap targets at all`).toBeGreaterThan(0);
    expect(report.tightestGap, `${key} has no adjacent pair under ${TAP_GAP}px, so every small target grades secondary for free`)
      .toBeLessThan(TAP_GAP);

    const failing = report.undersized.filter((t) => !t.secondary);
    expect(tally(failing), `${key}\n${failing.map((t) => `  ${t.min}px gap ${t.gap} ${t.sig} "${t.label}"`).join("\n")}`)
      .toEqual(RECORDED[key] ?? []);
  });
}
