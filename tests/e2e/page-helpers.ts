// The in-page geometry the browser specs share: visibility, what an ancestor's
// overflow leaves of a rect, and what a `.hit` pad adds to one.
//
// Gotcha: `define` is serialized to source and re-parsed inside the page. Its
// body may not name anything outside itself.

import type { Page } from "@playwright/test";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PageHelpers {
  vis(el: Element): boolean;
  clipTo(el: Element, r: Box): Box | null;
  onScreen(el: Element): boolean;
  padBox(el: Element, r: Box): Box | null;
  label(el: Element): string;
}

declare global {
  interface Window {
    mcHelpers: PageHelpers;
  }
}

function define(): void {
  const vis = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    // Opacity does not inherit into a computed style, so ancestors are walked.
    if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (getComputedStyle(p).opacity === "0") return false;
    }
    return true;
  };

  // The rect an element really occupies, or null if an ancestor's overflow
  // leaves nothing of it. auto and scroll hide by scroll position, so only an
  // element scrolled entirely away is dropped; hidden and clip shrink the rect.
  const clipTo = (el: Element, r: Box): Box | null => {
    const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let l = r.left,
      t = r.top,
      rt = r.right,
      b = r.bottom;
    // A positioned box escapes ancestors outside its containing block chain:
    // fixed escapes all of them, absolute until the first positioned ancestor.
    let escaping = getComputedStyle(el).position;
    if (escaping === "fixed") return box;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      const clipsX = s.overflowX !== "visible",
        clipsY = s.overflowY !== "visible";
      if ((clipsX || clipsY) && escaping !== "absolute") {
        // overflow clips to the padding box, so the borders come off the rect.
        const c = p.getBoundingClientRect();
        const edge = {
          left: c.left + parseFloat(s.borderLeftWidth),
          top: c.top + parseFloat(s.borderTopWidth),
          right: c.right - parseFloat(s.borderRightWidth),
          bottom: c.bottom - parseFloat(s.borderBottomWidth),
        };
        if (clipsX) {
          l = Math.max(l, edge.left);
          rt = Math.min(rt, edge.right);
          if (s.overflowX === "hidden" || s.overflowX === "clip") {
            box.left = Math.max(box.left, edge.left);
            box.right = Math.min(box.right, edge.right);
          }
        }
        if (clipsY) {
          t = Math.max(t, edge.top);
          b = Math.min(b, edge.bottom);
          if (s.overflowY === "hidden" || s.overflowY === "clip") {
            box.top = Math.max(box.top, edge.top);
            box.bottom = Math.min(box.bottom, edge.bottom);
          }
        }
        if (rt <= l || b <= t) return null;
      }
      if (s.position !== "static") escaping = "static";
      if (s.position === "fixed") break;
    }
    return box;
  };

  const onScreen = (el: Element): boolean => vis(el) && !!clipTo(el, el.getBoundingClientRect());

  // .hit (base.css) pads a control's hit area with a positioned ::after. The pad
  // is read off the pseudo's own box, and clipTo can still take it back off.
  const padBox = (el: Element, r: Box): Box | null => {
    const s = getComputedStyle(el, "::after");
    if (s.position !== "absolute" || s.content === "none") return null;
    const cs = getComputedStyle(el);
    const x = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(s.left);
    const y = r.top + parseFloat(cs.borderTopWidth) + parseFloat(s.top);
    const w = parseFloat(s.width),
      h = parseFloat(s.height);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return {
      left: Math.min(r.left, x),
      top: Math.min(r.top, y),
      right: Math.max(r.right, x + w),
      bottom: Math.max(r.bottom, y + h),
    };
  };

  const label = (el: Element): string =>
    (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);

  window.mcHelpers = { vis, clipTo, onScreen, padBox, label };
}

/** Put `window.mcHelpers` on every document this page loads. Call before navigating. */
export async function installPageHelpers(page: Page): Promise<void> {
  await page.addInitScript(define);
}
