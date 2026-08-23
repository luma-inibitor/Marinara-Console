import { Missing } from "./icons";
import { navigate } from "../shell/router";
import { EmptyState } from "./EmptyState";

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
      title={`${props.what} not found`}
      body={
        <>
          It may have been deleted, or the link may be out of date.
          {props.id && <> The id was <span className="t-data">{props.id}</span>.</>}
        </>
      }
      actions={
        <button className="dbtn is-primary" onClick={() => navigate(props.backTo ?? "lorebooks")}>
          {props.backLabel ?? "Back to lorebooks"}
        </button>
      }
    />
  );
}
