import "./StatusPill.css";

/** A memory's lifecycle status, as the engine spells it.
 *
 *  The value is data, not a label, so it is set in the data face at the case
 *  the engine stores it in. Only the statuses the product gives a meaning to
 *  carry a hue; an unrecognized one still renders, in the neutral pill.
 *
 *  `muted` drops the hue. It exists for a before → after row, where the colour
 *  belongs to the value that will land rather than to the one it replaces. */
export function StatusPill(props: { status: string; className?: string; muted?: boolean }) {
  const hue = props.muted ? "" : ` st-${props.status}`;
  return <span className={`stt t-data${hue}${props.className ? ` ${props.className}` : ""}`}>{props.status}</span>;
}
