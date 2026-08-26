// The shape of src/ui/EmptyState.tsx: a template nested inside the class
// template. The prefix that matters is only in the inner one.
export function Tone(props: { tone?: string }) {
  return <span className={`tone ${props.tone ? `rank-${props.tone}` : ""}`} />;
}
