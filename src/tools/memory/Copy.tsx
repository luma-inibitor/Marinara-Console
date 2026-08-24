// A catalog string rendered as nodes, so a sentence with something clickable
// inside it stays ONE string.
//
// Splitting such a sentence into JSX fragments around the embedded components
// would move English word order into the markup, which is the exact defect the
// copy catalog exists to prevent. `<Copy>` resolves the string first and then
// substitutes `{{slot}}` with a node, so the string keeps its word order and
// the components keep their behaviour.
//
// `params` are filled as TEXT (and select the plural, via `count`); `slots`
// are filled as NODES. A name must not appear in both, or the text fill wins
// and the node never renders.

import { Fragment, type ReactNode } from "react";
import { tAny, type Params } from "../../copy";

const SLOT = /\{\{\s*(\w+)\s*\}\}/g;

export function Copy(props: {
  k: string;
  params?: Params;
  slots?: Record<string, ReactNode>;
}) {
  const text = tAny(props.k, props.params);
  const out: ReactNode[] = [];
  let last = 0;
  SLOT.lastIndex = 0;
  for (let m = SLOT.exec(text); m; m = SLOT.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    // An unfilled slot renders its own placeholder rather than vanishing: a
    // missing name is a bug, and a silent hole hides it.
    out.push(props.slots?.[m[1]] ?? m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;
}
