import { CopyableText } from "./CopyableText";
import "./RawJson.css";

/** The underlying record, folded away.
 *
 *  Closed by default and labelled with what it hides, so the fold never reads
 *  as missing content. This is an escape hatch: when the rendered view and the
 *  engine disagree, this is where you find out which one is lying. It is not a
 *  substitute for rendering the data properly. */
export function RawJson(props: { value: unknown; label?: string }) {
  const text = JSON.stringify(props.value, null, 2);
  return (
    <details class="rawjson">
      <summary class="t-label t-label-s">
        {props.label ?? "Raw record"}
        <span class="rawjson-n t-data">{text.split("\n").length} lines</span>
      </summary>
      <div class="rawjson-act">
        <CopyableText value={text} label="the raw record" class="rawjson-copy" />
      </div>
      <pre class="rawjson-body t-data">{text}</pre>
    </details>
  );
}
