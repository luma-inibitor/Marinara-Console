import { useEffect, useState } from "preact/hooks";

/** True at and above the split breakpoint — the width where a list and its
 *  detail can sit side by side instead of stacking (design/DESIGN.md §7).
 *
 *  This is a width query, not a touch query. A touch laptop is wide and gets
 *  the split layout; it gets touch-sized targets from the token kit, not from
 *  here. Binding the two together is how tablets end up with a hover-only UI. */
export function useIsDesktop(): boolean {
  const [is, setIs] = useState(() => window.matchMedia(SPLIT).matches);
  useEffect(() => {
    const mq = window.matchMedia(SPLIT);
    const fn = () => setIs(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return is;
}

const SPLIT = "(min-width: 900px)";
