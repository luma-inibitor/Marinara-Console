import type { ReactNode } from "react";
import { Failure } from "./icons";
import { ApiError } from "../shell/api";
import { EmptyState } from "./EmptyState";
import { t } from "../copy";

/** A view that could not load, and the engine's reason why.
 *
 *  A named composition of `EmptyState`: the cause is required rather than an
 *  optional `body`, so no screen can ship a bare "Could not load" with the
 *  reason dropped. Icon and tone are fixed here, not the call site's choice —
 *  every failure should look like the same failure.
 *
 *  Give it `error` and it reads the failure; give it `message` when the caller
 *  has already reduced one to a sentence. The heading is derived from the
 *  status because it has to be true — a 500 or a 403 is the engine answering,
 *  not the engine being unreachable.
 *
 *  Recovery is the call site's to name: there is no default "back" button,
 *  because the right destination differs per tool. */
export function ErrorState(props: {
  title?: string;
  message?: string;
  error?: unknown;
  actions?: ReactNode;
  onRetry?: () => void;
}) {
  const api = props.error instanceof ApiError ? props.error : null;
  const status = api?.status ?? 0;

  // The offline heading reuses the connection banner's string — one key across
  // both surfaces, so they cannot drift.
  const title =
    props.title ??
    (api?.offline
      ? t("shell.conn.engineTitle")
      : status === 403
        ? t("ui.error.notAllowed")
        : status === 404
          ? t("ui.error.notFound")
          : status >= 500
            ? t("ui.error.serverFault")
            : status >= 400
              ? t("ui.error.rejected")
              : t("ui.error.unknown"));

  const cause =
    props.message ??
    (props.error instanceof Error ? props.error.message : props.error != null ? String(props.error) : "");

  // Advice only where the cause genuinely implies a next move.
  const advice = api?.offline
    ? t("ui.error.adviceOffline")
    : status >= 500
      ? t("ui.error.adviceServer")
      : status === 403
        ? t("ui.error.adviceForbidden")
        : null;

  return (
    <EmptyState
      tone="danger"
      icon={<Failure size={22} stroke={1.75} aria-hidden />}
      title={title}
      body={
        <>
          <span className="t-data">{cause}</span>
          {advice && (
            <>
              <br />
              {advice}
            </>
          )}
          {status > 0 && (
            <>
              <br />
              <span className="t-data dim">{t("ui.error.http", { status })}</span>
            </>
          )}
        </>
      }
      actions={
        (props.onRetry || props.actions) && (
          <>
            {props.onRetry && (
              <button className="dbtn is-primary" onClick={props.onRetry}>
                {t("ui.error.tryAgain")}
              </button>
            )}
            {props.actions}
          </>
        )
      }
    />
  );
}
