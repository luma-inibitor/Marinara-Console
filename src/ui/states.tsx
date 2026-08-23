// Non-ideal surface states — pattern kit.
//
// The review found the app implements roughly four of the nine canonical states
// (ideal, loading, error, length===0) and renders the rest as blank space or an
// indefinite spinner. These are the missing ones, in one place so both tools
// say the same thing about the same situation.
//
// Two rules encoded here:
//   - Every loading state ends. An indicator with no timeout is a lie after
//     ~10-15s; it escalates to a diagnosable message with an exit.
//   - Every error names what happened and offers a way out. "Cannot reach
//     engine" was being rendered for 500s and 403s, where it is simply false.
import { useEffect, useState } from "preact/hooks";
import { ApiError } from "../shell/api";
import { navigate } from "../shell/router";

/** Loading that escalates rather than spinning forever. */
export function Loading(props: { what: string; onRetry?: () => void }) {
  const [phase, setPhase] = useState<"normal" | "slow" | "stalled">("normal");
  useEffect(() => {
    const a = setTimeout(() => setPhase("slow"), 3_000);
    const b = setTimeout(() => setPhase("stalled"), 12_000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  if (phase === "stalled") {
    return (
      <div class="empty">
        <p class="t-label">Still waiting for {props.what}</p>
        <p>
          The engine hasn’t responded in 12 seconds. It may be asleep, or the
          connection may have dropped.
        </p>
        {props.onRetry && <button class="dbtn" onClick={props.onRetry}>Try again</button>}
      </div>
    );
  }
  return (
    <div class="empty">
      <span class="load-dots" aria-hidden="true"><i /><i /><i /></span>
      <p>Loading {props.what}…</p>
      {phase === "slow" && <p class="t-data is-dim">Taking longer than usual.</p>}
    </div>
  );
}

/** What actually went wrong, and the way out. */
export function ErrorState(props: { title?: string; error: unknown; onRetry?: () => void }) {
  const e = props.error;
  const api = e instanceof ApiError ? e : null;
  const status = api?.status ?? 0;

  // The heading must be true. A 500 is not "cannot reach engine".
  const title = props.title ?? (
    api?.offline ? "Cannot reach the engine"
      : status === 403 ? "Not allowed"
      : status === 404 ? "Not found"
      : status >= 500 ? "The engine returned an error"
      : status >= 400 ? "That request was rejected"
      : "Something failed"
  );
  const advice =
    api?.offline ? "Check that the engine is running and that your connection is up."
      : status >= 500 ? "This is a fault on the engine side, not in what you sent."
      : status === 403 ? "Your account doesn’t have access to this."
      : null;

  return (
    <div class="empty">
      <p class="t-label">{title}</p>
      <p>{(e as Error)?.message ?? String(e)}</p>
      {advice && <p class="is-dim">{advice}</p>}
      <div class="empty-acts">
        {props.onRetry && <button class="dbtn is-primary" onClick={props.onRetry}>Try again</button>}
        <button class="dbtn" onClick={() => navigate("lorebooks")}>Back to lorebooks</button>
      </div>
      {status > 0 && <p class="t-data is-faint">HTTP {status}</p>}
    </div>
  );
}

/** A link that points at something that isn't there — a real state, not a blank. */
export function NotFound(props: { what: string; id?: string; backTo?: string; backLabel?: string }) {
  return (
    <div class="empty">
      <p class="t-label">{props.what} not found</p>
      <p>
        It may have been deleted, or the link may be out of date.
        {props.id && <> The id was <code class="t-data">{props.id}</code>.</>}
      </p>
      <div class="empty-acts">
        <button class="dbtn is-primary" onClick={() => navigate(props.backTo ?? "lorebooks")}>
          {props.backLabel ?? "Back to lorebooks"}
        </button>
      </div>
    </div>
  );
}

/**
 * Empty has three causes and they need three different renderings — the review
 * found first-run copy being shown for filtered-empty, which tells a user with
 * 47 entries that they have none.
 */
export function EmptyState(props: {
  kind: "first-run" | "filtered" | "cleared";
  what: string;
  /** Active filters, for the diagnostic treatment. */
  filters?: Array<{ label: string; clear: () => void }>;
  onClearAll?: () => void;
  action?: { label: string; run: () => void };
}) {
  if (props.kind === "filtered") {
    return (
      <div class="empty">
        <p class="t-label">No {props.what} match these filters</p>
        {props.filters && props.filters.length > 0 && (
          <>
            <p class="is-dim">Active filters — remove one to widen the search:</p>
            <div class="empty-chips">
              {props.filters.map((f) => (
                <button key={f.label} class="chip" onClick={f.clear}>{f.label} ✕</button>
              ))}
            </div>
          </>
        )}
        {props.onClearAll && (
          <div class="empty-acts"><button class="dbtn" onClick={props.onClearAll}>Clear all filters</button></div>
        )}
      </div>
    );
  }
  if (props.kind === "cleared") {
    return <div class="empty"><p class="t-label">Nothing left</p><p>Every {props.what} has been handled.</p></div>;
  }
  return (
    <div class="empty">
      <p class="t-label">No {props.what} yet</p>
      <p>This is where {props.what} appear once you add them.</p>
      {props.action && (
        <div class="empty-acts">
          <button class="dbtn is-primary" onClick={props.action.run}>{props.action.label}</button>
        </div>
      )}
    </div>
  );
}
