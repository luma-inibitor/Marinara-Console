import { Missing } from "./icons";
import { navigate } from "../shell/router";
import { EmptyState } from "./EmptyState";
import { t } from "../copy";

/** A link that points at something that isn't there — a real state, not a blank.
 *
 *  A named composition of `EmptyState`, on the same reasoning as `ErrorState`:
 *  a missing record is one situation, so it gets one appearance rather than
 *  whatever each screen invents. Unlike `ErrorState` it does carry a default
 *  destination, because "the thing you asked for is gone" has exactly one
 *  sensible next move — go back to the list it came from — and `backTo` names
 *  which list, so it is never wrong about where that is. */
export function NotFound(props: { what: string; id?: string; backTo?: string; backLabel?: string }) {
  return (
    <EmptyState
      icon={<Missing size={22} stroke={1.75} aria-hidden />}
      title={t("ui.notfound.title", { what: props.what })}
      body={
        <>
          {t("ui.notfound.body")}
          {props.id && <> {t("ui.notfound.id", { id: props.id })}</>}
        </>
      }
      actions={
        <button className="dbtn is-primary" onClick={() => navigate(props.backTo ?? "lorebooks")}>
          {props.backLabel ?? t("ui.notfound.back")}
        </button>
      }
    />
  );
}
