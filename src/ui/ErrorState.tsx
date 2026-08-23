import { IconAlertTriangle } from "@tabler/icons-preact";
import { EmptyState } from "./EmptyState";

/** A view that could not load, and the engine's reason why.
 *
 *  This is a named composition of `EmptyState`, not a `kind="error"` branch
 *  inside it, for two reasons. It has a required part the other states do not
 *  — the `message` — and requiring it in the type is what stops a screen from
 *  shipping a bare "Could not load" with the cause dropped on the floor, which
 *  is what a shared optional `body` prop would have allowed. And its icon and
 *  tone are not the call site's choice: every failure in the console should
 *  look like the same failure, so they are fixed here rather than re-picked on
 *  each screen, which is how five error panes came to have four appearances.
 *
 *  It owns no stylesheet because it adds no rules — the layout is
 *  `EmptyState`'s and the message uses the shared mono face, since it is
 *  engine output the reader may need to quote verbatim. */
export function ErrorState(props: { title: string; message: string }) {
  return (
    <EmptyState
      tone="danger"
      icon={<IconAlertTriangle size={22} stroke={1.75} aria-hidden />}
      title={props.title}
      body={<span class="t-data">{props.message}</span>}
    />
  );
}
