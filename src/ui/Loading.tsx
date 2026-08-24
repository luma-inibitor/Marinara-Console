import { useEffect, useState } from "react";
import { EmptyState } from "./EmptyState";
import { t } from "../copy";
import "./Loading.css";

/** A view that has not arrived yet.
 *
 *  A loading state has one slot and no others: no icon, no explanation, no
 *  action, because there is nothing yet to explain and nothing to act on. It
 *  renders as one dim line of prose rather than a title in the label face —
 *  half a second of latency should not read as a verdict.
 *
 *  Waiting escalates, because an indicator with no timeout is a lie: quiet
 *  line, then an admission that it is slow, then — at twelve seconds — it stops
 *  claiming to be loading and becomes a state you can act on. That last phase
 *  is the one exception to "no actions"; `onRetry` is the way out of it.
 *
 *  Give it `what` ("lorebooks") and it writes the sentence, or `label` for a
 *  caller that already has a fully formed one. */
export function Loading(props: { what?: string; label?: string; onRetry?: () => void }) {
  const [phase, setPhase] = useState<"normal" | "slow" | "stalled">("normal");
  useEffect(() => {
    const slow = setTimeout(() => setPhase("slow"), 3_000);
    const stalled = setTimeout(() => setPhase("stalled"), 12_000);
    return () => { clearTimeout(slow); clearTimeout(stalled); };
  }, []);

  const subject = props.what ?? t("ui.loading.subject");
  const line = props.label ?? t("ui.loading.line", { destination: subject });

  if (phase === "stalled") {
    return (
      <EmptyState
        title={t("ui.loading.stalledTitle", { what: subject })}
        body={t("ui.loading.stalledBody")}
        actions={props.onRetry && <button className="dbtn is-primary" onClick={props.onRetry}>{t("ui.error.tryAgain")}</button>}
      />
    );
  }

  return (
    <p className="loadingstate t-prose">
      {line}
      {phase === "slow" && <span className="loading-slow"> {t("ui.loading.slow")}</span>}
    </p>
  );
}
