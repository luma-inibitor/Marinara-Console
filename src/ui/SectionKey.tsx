import "./SectionKey.css";

/** The `§key` that addresses one section of a memory.
 *
 *  The `§` belongs to the renderer, not the caller — a caller that concatenated
 *  its own would drift. Keys are arbitrary, so none is privileged. */
export function SectionKey(props: { k: string; className?: string }) {
  return <span className={`skey${props.className ? ` ${props.className}` : ""}`}>§{props.k}</span>;
}
