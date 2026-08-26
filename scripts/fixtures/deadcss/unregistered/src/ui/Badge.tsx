// `rank-` has no DOMAINS entry, so nothing in the .rank-* namespace is scanned
// and every rule below reads as unused.
export function Badge(props: { rank: string }) {
  return <span className={`badge rank-${props.rank}`} />;
}
