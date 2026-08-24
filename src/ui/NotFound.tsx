import { Missing } from "./icons";
import { navigate } from "../shell/router";
import { EmptyState } from "./EmptyState";
import { t } from "../copy";

/** A link that points at something that isn't there — a real state, not a blank.
 *
 *  A named composition of `EmptyState`. Unlike `ErrorState` it carries a
 *  default destination: a missing record has one sensible next move, back to
 *  the list it came from, and `backTo` names which list. */
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
