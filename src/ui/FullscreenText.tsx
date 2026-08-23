// Fullscreen text editor — pattern kit (DESIGN.md §5). Live char/token counts
// with delta, wrap toggle, markdown symbol row. Generic: callers supply the
// title/subtitle and receive the final value on Done.
//
// P0.1: this used to have exactly one exit — Done — and no key handler, so
// Escape bubbled to the list behind it and navigated away, and the Android back
// gesture did the same. Either one silently discarded the edit. It now owns its
// own Escape, offers Cancel, guards a dirty discard, and pushes a history entry
// so the back gesture closes the editor instead of leaving the record.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { tokensOf } from "../shell/api";
import { Chip } from "./Chip";

const MD_TOKENS = ["# ", "## ", "**", "_", "- ", "> ", "`", "[]", "\n"];

export function FullscreenText(props: {
  title: string;
  subtitle: string;
  initial: string;
  /** When set, shows the value's share of this token budget. */
  budget?: number;
  onDone: (value: string) => void;
  /** Close without applying. Required — an editor with no exit loses work. */
  onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initial);
  const [wrap, setWrap] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const startTokens = useMemo(() => tokensOf(props.initial), [props.initial]);
  const restoreTo = useRef<HTMLElement | null>(null);

  const ch = value.length, tk = tokensOf(value);
  const dCh = ch - props.initial.length, dTk = tk - startTokens;
  const dirty = value !== props.initial;
  const sign = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

  const cancel = () => { if (dirty && !confirming) setConfirming(true); else props.onCancel(); };

  // The key handler reads live state through a ref, not a render closure.
  // Escape pressed in the same tick as a keystroke would otherwise see the
  // pre-render `dirty` and discard the edit without asking.
  const live = useRef({ value, dirty, confirming });
  live.current = { value, dirty, confirming };

  // Own Escape at the capture phase so it never reaches the list behind us.
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const onKey = (ev: KeyboardEvent) => {
      const st = live.current;
      if (ev.key === "Escape") {
        ev.preventDefault(); ev.stopPropagation();
        if (st.confirming) setConfirming(false);
        else if (st.dirty) setConfirming(true);
        else props.onCancel();
      } else if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault(); ev.stopPropagation();
        props.onDone(st.value);
      }
    };
    window.addEventListener("keydown", onKey, true);
    document.getElementById("fs-ta")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      restoreTo.current?.focus?.();
    };
  }, []);

  // A history entry of our own, so the phone's back gesture closes the editor
  // rather than unwinding to the book list with the edit dropped.
  useEffect(() => {
    history.pushState({ fsEditor: true }, "");
    const onPop = () => { live.current.dirty ? setConfirming(true) : props.onCancel(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
          <div class="meta">
            <span>{props.subtitle}</span>
            {dirty && <span class="is-dirty-dot">unsaved</span>}
          </div>
        </div>
        <Chip pressed={wrap} onClick={() => setWrap(!wrap)}>↵ wrap</Chip>
        <button class="dbtn" onClick={cancel}>Cancel</button>
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

      {confirming && (
        // Verb buttons naming the outcome — never Yes/No (forms doc §4).
        <div class="fs-confirm" role="alertdialog" aria-label="Discard changes?">
          <div class="fs-confirm-box">
            <p class="t-label">Discard changes?</p>
            <p class="prose-note">
              {sign(dCh)} characters since you opened this editor. Discarding cannot be undone.
            </p>
            <div class="fs-confirm-acts">
              <button class="dbtn" onClick={() => setConfirming(false)}>Keep editing</button>
              <button class="dbtn is-danger" onClick={props.onCancel}>Discard changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
