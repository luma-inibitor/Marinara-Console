import type { ComponentChildren } from "preact";
import { Failure } from "./icons";
import { ApiError } from "../shell/api";
import { EmptyState } from "./EmptyState";
import { t } from "../copy";

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

  // The offline heading is the connection banner's sentence, not a second one
  // that says the same thing — one string, one key, across both surfaces.
  const title = props.title ?? (
    api?.offline ? t("shell.conn.engineTitle")
      : status === 403 ? t("ui.error.notAllowed")
      : status === 404 ? t("ui.error.notFound")
      : status >= 500 ? t("ui.error.serverFault")
      : status >= 400 ? t("ui.error.rejected")
      : t("ui.error.unknown")
  );

  const cause = props.message
    ?? (props.error instanceof Error ? props.error.message : props.error != null ? String(props.error) : "");

  // Advice only where the cause genuinely implies a next move. Guessing past
  // that point is how error panes start telling people to check their wifi
  // when the engine returned a validation error.
  const advice =
    api?.offline ? t("ui.error.adviceOffline")
      : status >= 500 ? t("ui.error.adviceServer")
      : status === 403 ? t("ui.error.adviceForbidden")
      : null;

  return (
    <EmptyState
      tone="danger"
      icon={<Failure size={22} stroke={1.75} aria-hidden />}
      title={title}
      body={
        <>
          <span className="t-data">{cause}</span>
          {advice && <><br />{advice}</>}
          {status > 0 && <><br /><span className="t-data dim">{t("ui.error.http", { status })}</span></>}
        </>
      }
      actions={
        (props.onRetry || props.actions) && (
          <>
            {props.onRetry && <button className="dbtn is-primary" onClick={props.onRetry}>{t("ui.error.tryAgain")}</button>}
            {props.actions}
          </>
        )
      }
    />
  );
}
