import { useEffect, useState } from "preact/hooks";
import { EmptyState } from "./EmptyState";
import "./Loading.css";

/** A view that has not arrived yet.
 *
 *  Separate from `EmptyState` rather than a `kind="loading"` prop on it,
 *  because the roles differ in exactly the way DESIGN.md §8 says to split on.
 *  A loading state has one slot and no others: it cannot carry an icon, an
 *  explanation, or an action, because there is nothing yet to explain and
 *  nothing to act on.
 *
 *  It is also typographically the opposite of the other two. `EmptyState` and
 *  `ErrorState` lead with a title in the label face, which is right for a
 *  condition the reader has to take in and decide about. Waiting is neither —
 *  announcing it in a bold uppercase-adjacent face makes a half-second of
 *  network latency look like a verdict. So this is one dim line of prose, the
 *  same weight as the rows it is standing in for.
 *
 *  Until it stops being true. An indicator with no timeout is a lie after ten
 *  seconds or so, and the P1 review found screens spinning indefinitely on a
 *  request that had already died. So waiting escalates: quiet line, then an
 *  admission that it is slow, then — at twelve seconds — it stops claiming to
 *  be loading at all and becomes a state you can act on. That last phase is
 *  the one exception to "no actions": by then the wait itself is the
 *  condition, and `onRetry` is the way out of it.
 *
 *  Give it `what` ("lorebooks") and it writes the sentence, or `label` for a
 *  caller that already has one — the memory tool's strings come from the
 *  translation table, fully formed. */
export function Loading(props: { what?: string; label?: string; onRetry?: () => void }) {
  const [phase, setPhase] = useState<"normal" | "slow" | "stalled">("normal");
  useEffect(() => {
    const slow = setTimeout(() => setPhase("slow"), 3_000);
    const stalled = setTimeout(() => setPhase("stalled"), 12_000);
    return () => { clearTimeout(slow); clearTimeout(stalled); };
  }, []);

  const subject = props.what ?? "this view";
  const line = props.label ?? `Loading ${subject}…`;

  if (phase === "stalled") {
    return (
      <EmptyState
        title={`Still waiting for ${subject}`}
        body="The engine hasn’t responded in twelve seconds. It may be asleep, or the connection may have dropped."
        actions={props.onRetry && <button class="dbtn is-primary" onClick={props.onRetry}>Try again</button>}
      />
    );
  }

  return (
    <p class="loadingstate t-prose">
      {line}
      {phase === "slow" && <span class="loading-slow"> Taking longer than usual.</span>}
    </p>
  );
}
