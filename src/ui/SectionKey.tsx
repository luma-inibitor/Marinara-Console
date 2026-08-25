import "./SectionKey.css";

/** The `§key` that addresses one section of a memory.
 *
 *  Section keys are arbitrary suggestions rather than an enum, so this renders
 *  whatever key it is given and privileges none of them. The `§` belongs to the
 *  renderer, not to the caller: it is the mark that says "this is an address
 *  inside a memory", and a caller that concatenated its own could drift.
 *
 *  `className` is for a host that owns the key's BOX — how it wraps, whether it
 *  can shrink. The type is this component's own and is never overridden. */
export function SectionKey(props: { k: string; className?: string }) {
  return <span className={`skey${props.className ? ` ${props.className}` : ""}`}>§{props.k}</span>;
}
