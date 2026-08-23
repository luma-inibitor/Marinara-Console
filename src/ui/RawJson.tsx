import { JsonView } from "./JsonView";
import "./RawJson.css";

/** The underlying record, folded away.
 *
 *  Closed by default and labelled with how much it hides, so the fold never
 *  reads as missing content. This is an escape hatch: when the rendered view
 *  and the engine disagree, this is where you find out which one is lying. It
 *  is not a substitute for rendering the data properly. */
export function RawJson(props: { value: unknown; label?: string }) {
  const lines = JSON.stringify(props.value, null, 2).split("\n").length;
  return (
    <details className="rawjson">
      <summary className="t-label t-label-s">
        {props.label ?? "Raw record"}
        <span className="rawjson-n t-data">{lines} lines</span>
      </summary>
      <JsonView value={props.value} label={props.label ?? "Raw record"} />
    </details>
  );
}
