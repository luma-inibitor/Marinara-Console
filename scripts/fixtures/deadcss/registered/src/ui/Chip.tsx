// A prefix DOMAINS names, composed where a class goes.
export function Chip(props: { type: string }) {
  return <span className={`chip type-${props.type}`} />;
}
