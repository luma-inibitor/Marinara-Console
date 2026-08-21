// Fullscreen text editor — pattern kit (DESIGN.md §5). Live char/token counts
// with delta, wrap toggle, markdown symbol row. Generic: callers supply the
// title/subtitle and receive the final value on Done.
import { useMemo, useState } from "preact/hooks";
import { tokensOf } from "../shell/api";

const MD_TOKENS = ["# ", "## ", "**", "_", "- ", "> ", "`", "[]", "\n"];

export function FullscreenText(props: {
  title: string;
  subtitle: string;
  initial: string;
  /** When set, shows the value's share of this token budget. */
  budget?: number;
  onDone: (value: string) => void;
}) {
  const [value, setValue] = useState(props.initial);
  const [wrap, setWrap] = useState(true);
  const startTokens = useMemo(() => tokensOf(props.initial), [props.initial]);

  const ch = value.length, tk = tokensOf(value);
  const dCh = ch - props.initial.length, dTk = tk - startTokens;
  const sign = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

  const insert = (tok: string) => {
    const ta = document.getElementById("fs-ta") as HTMLTextAreaElement | null;
    if (!ta) return;
    const a = ta.selectionStart, b = ta.selectionEnd;
    const next = value.slice(0, a) + tok + value.slice(b);
    setValue(next);
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = a + tok.length; ta.focus(); });
  };

  return (
    <div class="fseditor" role="dialog" aria-modal="true" aria-label={props.title}>
      <div class="fs-head">
        <div class="fs-title-wrap">
          <div class="t-label">{props.title}</div>
          <div class="meta"><span>{props.subtitle}</span></div>
        </div>
        <button class="chip" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>↵ wrap</button>
        <button class="dbtn is-primary" onClick={() => props.onDone(value)}>Done</button>
      </div>
      <div class="fs-counts meta">
        <span><b class="t-num">{ch.toLocaleString()}</b> ch</span>
        <span><b class="t-num">{tk.toLocaleString()}</b> tokens (est.)</span>
        {props.budget !== undefined && props.budget > 0 && (
          <span>{((tk / props.budget) * 100).toFixed(1)}% of budget</span>
        )}
        {(dTk !== 0 || dCh !== 0) && (
          <span class={`delta ${dTk > 0 ? "is-up" : dTk < 0 ? "is-down" : ""}`}>
            {sign(dCh)} ch · {sign(dTk)} tokens
          </span>
        )}
      </div>
      <div class="fs-body">
        <textarea id="fs-ta" class={wrap ? "" : "is-nowrap"} spellcheck={false} value={value}
          onInput={(ev) => setValue(ev.currentTarget.value)} />
      </div>
      <div class="fs-foot">
        {MD_TOKENS.map((t) => (
          <button key={t} class="mdb t-data" onClick={() => insert(t)}>{t.trim() || "↵"}</button>
        ))}
      </div>
    </div>
  );
}
