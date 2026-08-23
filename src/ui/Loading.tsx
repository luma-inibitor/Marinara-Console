import "./Loading.css";

/** A view that has not arrived yet.
 *
 *  Separate from `EmptyState` rather than a `kind="loading"` prop on it,
 *  because the roles differ in exactly the way DESIGN.md §8 says to split on.
 *  A loading state has one slot and no others: it cannot carry an icon, an
 *  explanation, or an action, because there is nothing yet to explain and
 *  nothing to act on. A `kind` prop would leave every one of those props
 *  reachable from a call site where they mean nothing.
 *
 *  It is also typographically the opposite of the other two. `EmptyState` and
 *  `ErrorState` lead with a title in the label face, which is right for a
 *  condition the reader has to take in and decide about. Waiting is neither —
 *  announcing it in a bold uppercase-adjacent face makes a half-second of
 *  network latency look like a verdict. So this is one dim line of prose, the
 *  same weight as the rows it is standing in for. */
export function Loading(props: { label: string }) {
  return <p class="loadingstate t-prose">{props.label}</p>;
}
