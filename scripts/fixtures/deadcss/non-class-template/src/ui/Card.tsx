import { draftId } from "../tools/x/ids";

export function Card(props: { n: number }) {
  return <div className="card" id={draftId(props.n)} />;
}
