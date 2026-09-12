interface Claim {
  depth: number;
  undo: () => void;
}

// Refcounted, since a sheet opened over a sheet shares most of the same background.
const inerted = new Map<HTMLElement, Claim>();
const frozen = new Map<HTMLElement, Claim>();

function claim(ledger: Map<HTMLElement, Claim>, el: HTMLElement, apply: () => (() => void) | null): boolean {
  const held = ledger.get(el);
  if (held) {
    held.depth += 1;
    return true;
  }
  const undo = apply();
  if (!undo) return false;
  ledger.set(el, { depth: 1, undo });
  return true;
}

function release(ledger: Map<HTMLElement, Claim>, el: HTMLElement): void {
  const held = ledger.get(el);
  if (!held) return;
  held.depth -= 1;
  if (held.depth > 0) return;
  ledger.delete(el);
  held.undo();
}

function freeze(surface: HTMLElement): HTMLElement[] {
  const held: HTMLElement[] = [];
  for (let node = surface.parentElement; node; node = node.parentElement) {
    const el = node;
    const overflow = getComputedStyle(el).overflowY;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const taken = claim(frozen, el, () => {
      const inline = { overflow: el.style.overflow, paddingRight: el.style.paddingRight };
      const pad = parseFloat(getComputedStyle(el).paddingRight) || 0;
      const before = el.clientWidth;
      el.style.overflow = "hidden";
      // The removed scrollbar's width goes back as padding so the content does not shift.
      const gained = el.clientWidth - before;
      if (gained > 0) el.style.paddingRight = `${pad + gained}px`;
      return () => {
        el.style.overflow = inline.overflow;
        el.style.paddingRight = inline.paddingRight;
      };
    });
    if (taken) held.push(el);
  }
  return held;
}

// Surfaces render in place, so the background is every sibling on the path to <body>.
function hide(surface: HTMLElement): HTMLElement[] {
  const held: HTMLElement[] = [];
  for (let node: HTMLElement = surface; node !== document.body && node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      // A live region behind the overlay still has to announce.
      if (sibling.hasAttribute("aria-live")) continue;
      const taken = claim(inerted, sibling, () => {
        if (sibling.inert) return null;
        sibling.inert = true;
        return () => {
          sibling.inert = false;
        };
      });
      if (taken) held.push(sibling);
    }
  }
  return held;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const DISABLED = ":disabled";
const INERT = "[inert]";
const DIALOG = "[role=dialog]";

/** The surface's tab stops, in document order. */
export function focusable(surface: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const el of surface.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el.matches(DISABLED) || el.closest(INERT) || !el.getClientRects().length) continue;
    found.push(el);
  }
  return found;
}

/** Puts focus on the surface's first tab stop, or on its dialog when it has none. */
export function enterSurface(surface: HTMLElement): void {
  const first = focusable(surface)[0];
  if (first) {
    first.focus();
    return;
  }
  const host = surface.querySelector<HTMLElement>(DIALOG) ?? surface;
  if (!host.hasAttribute("tabindex")) host.tabIndex = -1;
  host.focus();
}

/** Seals the page behind a fixed surface and returns the release. */
export function sealBackground(surface: HTMLElement): () => void {
  const hidden = hide(surface);
  const held = freeze(surface);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const el of hidden) release(inerted, el);
    for (const el of held) release(frozen, el);
  };
}
