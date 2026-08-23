import type { ComponentChildren } from "preact";
import { IconAlertTriangle } from "@tabler/icons-preact";
import { ApiError } from "../shell/api";
import { EmptyState } from "./EmptyState";

/** A view that could not load, and the engine's reason why.
 *
 *  This is a named composition of `EmptyState`, not a `kind="error"` branch
 *  inside it, for two reasons. It has a required part the other states do not
 *  — the cause — and requiring it in the type is what stops a screen from
 *  shipping a bare "Could not load" with the reason dropped on the floor,
 *  which is what a shared optional `body` prop would have allowed. And its
 *  icon and tone are not the call site's choice: every failure in the console
 *  should look like the same failure, so they are fixed here rather than
 *  re-picked on each screen, which is how five error panes came to have four
 *  appearances.
 *
 *  Give it `error` and it reads the failure; give it `message` when the caller
 *  has already reduced one to a sentence. The heading is derived rather than
 *  fixed because it has to be true: "Cannot reach engine" was being rendered
 *  over 500s and 403s, where the engine answered perfectly well and said no.
 *
 *  It owns no stylesheet because it adds no rules — the layout is
 *  `EmptyState`'s and the cause uses the shared mono face, since it is engine
 *  output the reader may need to quote verbatim.
 *
 *  Recovery is the call site's to name. This deliberately renders no default
 *  "back" button: the one it used to hard-code sent you to the lorebook list
 *  from anywhere, including the presets tool, where that is simply the wrong
 *  destination. */
export function ErrorState(props: {
  title?: string;
  message?: string;
  error?: unknown;
  actions?: ComponentChildren;
  onRetry?: () => void;
}) {
  const api = props.error instanceof ApiError ? props.error : null;
  const status = api?.status ?? 0;

  const title = props.title ?? (
    api?.offline ? "Cannot reach the engine"
      : status === 403 ? "Not allowed"
      : status === 404 ? "Not found"
      : status >= 500 ? "The engine returned an error"
      : status >= 400 ? "That request was rejected"
      : "Something failed"
  );

  const cause = props.message
    ?? (props.error instanceof Error ? props.error.message : props.error != null ? String(props.error) : "");

  // Advice only where the cause genuinely implies a next move. Guessing past
  // that point is how error panes start telling people to check their wifi
  // when the engine returned a validation error.
  const advice =
    api?.offline ? "Check that the engine is running and that your connection is up."
      : status >= 500 ? "This is a fault on the engine side, not in what you sent."
      : status === 403 ? "Your account doesn’t have access to this."
      : null;

  return (
    <EmptyState
      tone="danger"
      icon={<IconAlertTriangle size={22} stroke={1.75} aria-hidden />}
      title={title}
      body={
        <>
          <span class="t-data">{cause}</span>
          {advice && <><br />{advice}</>}
          {status > 0 && <><br /><span class="t-data dim">HTTP {status}</span></>}
        </>
      }
      actions={
        (props.onRetry || props.actions) && (
          <>
            {props.onRetry && <button class="dbtn is-primary" onClick={props.onRetry}>Try again</button>}
            {props.actions}
          </>
        )
      }
    />
  );
}
