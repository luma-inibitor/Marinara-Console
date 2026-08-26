// Every screen's ink clears the design/DESIGN.md §1 floors, at four viewports.
//
// axe's color-contrast rule measures element text. It does not look at
// `::before`, `::after` or `::placeholder`, so that ink is measured here.

import { AxeBuilder } from "@axe-core/playwright";
import { SCREENS, openScreen } from "./screens";
import { expect, test } from "./harness";
import { installPageHelpers } from "./page-helpers";
import baseline from "../../design/contrast-baseline.json" with { type: "json" };

// `data-contrast-exempt` in the markup only *claims* an exemption. It is
// honored solely for elements matching an entry here, and every entry states
// why the ink may sit below §1's floor; an element carrying the attribute with
// no entry is measured like any other. A selector may name a pseudo-element.
// An aria-hidden element needs no entry; the contrast pass skips it.
const CONTRAST_EXEMPTIONS: [selector: string, reason: string][] = [
  [".sep", "separator glyph between meta fields; punctuation, no information"],
  [".mdc-sep", "separator glyph between meta fields; punctuation, no information"],
  [".meta > * + *::before", "separator glyph between meta fields; punctuation, no information"],
  ["[data-brand]", "logotype; WCAG 1.4.3 exempts brand wordmarks from contrast"],
];

// Enforced per finding, in the deadcss/deadexports shape: a finding outside the
// record fails, a recorded one stands. A count would let a new finding in as
// soon as an old one was fixed.
const BASELINE: Record<string, string[]> = baseline;

interface Exemptions {
  /** Selectors that exempt the element's own text. */
  element: string[];
  /** Selectors that exempt one pseudo-element's ink. */
  pseudo: { sel: string; name: string }[];
}

const EXEMPTIONS: Exemptions = {
  element: CONTRAST_EXEMPTIONS.filter(([spec]) => !spec.includes("::")).map(([spec]) => spec),
  pseudo: CONTRAST_EXEMPTIONS.filter(([spec]) => spec.includes("::")).map(([spec]) => {
    const [sel, name] = spec.split("::");
    return { sel, name: `::${name}` };
  }),
};

for (const screen of SCREENS) {
  test(screen.name, async ({ page }, testInfo) => {
    await installPageHelpers(page);
    await openScreen(page, screen);

    const axe = new AxeBuilder({ page }).withRules(["color-contrast"]).exclude("[data-verify-exempt]");
    // Markup that hides text from assistive readers is calling it decoration.
    axe.exclude('[aria-hidden="true"]');
    for (const selector of EXEMPTIONS.element) axe.exclude(selector);
    const { violations } = await axe.analyze();

    const nodes = violations.flatMap((violation) => violation.nodes);
    const visible = await page.evaluate(keepOnScreen, nodes.map((node) => String(node.target[0])));
    const text = nodes
      .filter((_node, i) => visible[i])
      .map((node) => {
        const data = node.any[0]?.data as ContrastData | undefined;
        return `${leaf(String(node.target[0]))} — ${data?.contrastRatio}:1 (needs ${data?.expectedContrastRatio}) ${data?.fontSize}`;
      });

    const generated = await page.evaluate(measureGeneratedInk, EXEMPTIONS);
    const found = [...new Set([...text, ...generated.findings])];
    if (generated.unlisted.length) {
      testInfo.annotations.push({
        type: "contrast-exempt-unlisted",
        description: `${generated.unlisted.join(", ")} carry data-contrast-exempt with no entry in CONTRAST_EXEMPTIONS; measured as normal`,
      });
    }

    const accepted = new Set(BASELINE[screen.name] ?? []);
    expect(found.filter((f) => !accepted.has(f)), `${screen.name} ink below the §1 floor`)
      .toEqual([]);

  });
}

/** What axe's color-contrast check reports about one node. */
interface ContrastData {
  contrastRatio: number;
  expectedContrastRatio: string;
  fontSize: string;
}

/** The last step of an axe target, minus the position axe adds to disambiguate
 *  siblings: reordering a row must not read as a new finding. */
const leaf = (target: string) => target.split(">").pop()!.trim().replace(/:nth-child\(\d+\)/g, "");

/** Runs in the page: which of these selectors still have area on screen. */
function keepOnScreen(targets: string[]): boolean[] {
  return targets.map((target) => {
    const el = document.querySelector(target);
    return !!el && window.pageHelpers.onScreen(el);
  });
}

/** Runs in the page: contrast for pseudo-element and placeholder ink. */
function measureGeneratedInk(exemptions: Exemptions): { findings: string[]; unlisted: string[] } {
  const { onScreen } = window.pageHelpers;
  const findings: string[] = [];
  const unlisted: string[] = [];

  const lum = (r: number, g: number, b: number) => {
    const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // A computed color can be rgb(), color(srgb …) or color-mix(). Painting a
  // pixel has the browser resolve any of them. The sentinel catches a value it
  // cannot parse, which leaves the previous fillStyle in place.
  const ink = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const colors = new Map<string, { r: number; g: number; b: number; a: number } | null>();
  const parse = (s: string) => {
    if (!s) return null;
    const cached = colors.get(s);
    if (cached !== undefined) return cached;
    let v = null;
    ink.fillStyle = "#010203";
    ink.fillStyle = s;
    if (ink.fillStyle !== "#010203" || s.trim() === "#010203") {
      ink.clearRect(0, 0, 1, 1);
      ink.fillRect(0, 0, 1, 1);
      const d = ink.getImageData(0, 0, 1, 1).data;
      v = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    }
    colors.set(s, v);
    return v;
  };
  // The node carrying the background comes back with it. Opacity at or above
  // that node dims text and background together, so measure() stops there.
  const bgOf = (el: Element) => {
    let node: Element | null = el, acc = null;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        if (!acc) acc = { ...c };
        else { const a = acc.a; acc.r = acc.r * a + c.r * (1 - a); acc.g = acc.g * a + c.g * (1 - a); acc.b = acc.b * a + c.b * (1 - a); acc.a = a + c.a * (1 - a); }
        if (acc.a >= 0.99) return { ...acc, node };
      }
      node = node.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor);
    return { ...(acc ?? root ?? { r: 11, g: 13, b: 18, a: 1 }), node: document.body as Element };
  };

  const describe = (el: Element) =>
    el.tagName.toLowerCase() + (el.className ? `.${String(el.className).trim().split(/\s+/).join(".")}` : "");

  const seen = new Set<string>();
  const measure = (el: Element, pseudo: string, text: string) => {
    const s = getComputedStyle(el, pseudo);
    const raw = parse(s.color); if (!raw) return;
    const bg = bgOf(el);
    // Ink composites over its background at its own alpha times every opacity
    // between the two.
    let a = raw.a;
    for (let n: Element | null = el; n && n !== bg.node && n !== document.documentElement; n = n.parentElement) a *= parseFloat(getComputedStyle(n).opacity);
    const fg = { r: raw.r * a + bg.r * (1 - a), g: raw.g * a + bg.g * (1 - a), b: raw.b * a + bg.b * (1 - a) };
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const floor = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (ratio >= floor) return;
    const key = s.color + "|" + Math.round(ratio * 10) + "|" + text.slice(0, 20);
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(`${describe(el)}${pseudo} — ${Math.round(ratio * 100) / 100}:1 (needs ${floor}:1) ${px}px`);
  };

  const exempt = (el: Element, pseudo: string) => exemptions.pseudo.some((e) => e.name === pseudo && el.matches(e.sel));
  for (const el of document.querySelectorAll("body *")) {
    if (!onScreen(el) || el.closest("[data-verify-exempt]")) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    if (el.hasAttribute("data-contrast-exempt") && !exemptions.element.some((sel) => el.matches(sel))) {
      unlisted.push(describe(el));
    }
    for (const pseudo of ["::before", "::after"]) {
      const raw = getComputedStyle(el, pseudo).content;
      if (!raw || raw === "none" || raw === "normal" || raw.includes("url(")) continue;
      const glyph = raw.replace(/^"|"$/g, "").trim();
      if (!glyph || exempt(el, pseudo)) continue;
      measure(el, pseudo, glyph);
    }
    const placeholder = (el as HTMLInputElement).placeholder;
    if (placeholder && !exempt(el, "::placeholder")) measure(el, "::placeholder", placeholder);
  }

  return { findings, unlisted: [...new Set(unlisted)] };
}
