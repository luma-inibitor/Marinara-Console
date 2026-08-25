// Fullscreen text editor — pattern kit (DESIGN.md §5). Live char/token counts
// with delta, wrap toggle, markdown symbol row. Generic: callers supply the
// title/subtitle and receive the final value on Done.
//
// It owns its own Escape, offers Cancel, guards a dirty discard, and registers
// with the overlay stack, so neither Escape nor the Android back gesture can
// reach the list behind it and silently discard the edit.
import { useEffect, useMemo, useRef, useState } from "react";
import { tokensOf } from "../shell/api";
import { openOverlay } from "../shell/overlays";
import { Chip } from "./Chip";
import { FocusTrap } from "./FocusTrap";
import { t } from "../copy";

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

  // Own Escape at the capture phase so it never reaches the list behind us. It
  // must stay on window: one node ahead of the trap's document listener is what
  // leaves the dirty guard below as the only thing Escape can reach.
  useEffect(() => {
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
    return () => { window.removeEventListener("keydown", onKey, true); };
    // Mount-only: one listener for the editor's lifetime. Editor state is read
    // through `live.current` for exactly this reason, but onCancel/onDone are
    // captured here as they were at mount — safe only while callers pass
    // callbacks that do not change identity-with-behaviour mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One overlay entry, owned by the stack, so the phone's back gesture closes
  // the editor rather than unwinding to the list behind it with the edit
  // dropped. This effect must stay AFTER the one above: the focus the stack
  // captures for restore is whatever is focused at registration time, and by
  // then that is our own textarea — which is gone by the time a real close
  // restores, so the stack's restore goes inert and the `restoreTo` above
  // wins. After a back the editor stays open, the textarea is still there,
  // and the stack puts focus back into it, which is what we want anyway.
  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | null = null;
    const register = () => {
      dispose = openOverlay(() => {
        dispose = null; // the stack already removed this entry before closing us
        if (!live.current.dirty) { props.onCancel(); return; }
        setConfirming(true);
        // Staying open spends the entry, so the editor needs a fresh one or the
        // next back escapes to the list. Re-register off a microtask: the
        // stack's hashchange teardown drains synchronously, and pushing back
        // into that drain would loop forever.
        queueMicrotask(() => { if (alive && !dispose) register(); });
      });
    };
    register();
    return () => { alive = false; dispose?.(); dispose = null; };
    // Mount-only: re-running would spend and re-push overlay entries mid-edit.
    // Dirtiness is read through `live.current`; props.onCancel is not, so it is
    // the one captured at mount — safe only while the parent passes a stable
    // callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <FocusTrap>
      <div className="fseditor" role="dialog" aria-modal="true" aria-label={props.title}>
        <div className="fs-head">
          <div className="fs-title-wrap">
            <div className="t-label">{props.title}</div>
            <div className="meta">
              <span>{props.subtitle}</span>
              {dirty && <span className="is-dirty-dot">{t("ui.editor.unsaved")}</span>}
            </div>
          </div>
          <Chip pressed={wrap} onClick={() => setWrap(!wrap)}>{t("ui.editor.wrap")}</Chip>
          <button className="dbtn" onClick={cancel}>{t("ui.editor.cancel")}</button>
          <button className="dbtn is-primary" onClick={() => props.onDone(value)}>{t("ui.editor.done")}</button>
        </div>
        <div className="fs-counts meta">
          <span><b className="t-num">{ch.toLocaleString()}</b> {t("ui.editor.charUnit")}</span>
          <span><b className="t-num">{tk.toLocaleString()}</b> {t("ui.editor.tokensEst")}</span>
          {props.budget !== undefined && props.budget > 0 && (
            <span>{t("ui.editor.ofBudget", { pct: ((tk / props.budget) * 100).toFixed(1) })}</span>
          )}
          {(dTk !== 0 || dCh !== 0) && (
            <span className={`delta ${dTk > 0 ? "is-up" : dTk < 0 ? "is-down" : ""}`}>
              {sign(dCh)} {t("ui.editor.charUnit")} · {sign(dTk)} {t("ui.editor.tokenUnit")}
            </span>
          )}
        </div>
        <div className="fs-body">
          <textarea id="fs-ta" className={wrap ? "" : "is-nowrap"} spellCheck={false} value={value}
            onInput={(ev) => setValue(ev.currentTarget.value)} />
        </div>
        <div className="fs-foot">
          {MD_TOKENS.map((t) => (
            <button key={t} className="mdb t-data" onClick={() => insert(t)}>{t.trim() || "↵"}</button>
          ))}
        </div>

        {confirming && (
          // Verb buttons naming the outcome — never Yes/No (forms doc §4).
          <div className="fs-confirm" role="alertdialog" aria-label={t("ui.editor.discardTitle")}>
            <div className="fs-confirm-box">
              <p className="t-label">{t("ui.editor.discardTitle")}</p>
              <p className="prose-note">
                {t("ui.editor.discardBody", { delta: sign(dCh) })}
              </p>
              <div className="fs-confirm-acts">
                <button className="dbtn" onClick={() => setConfirming(false)}>{t("ui.editor.keepEditing")}</button>
                <button className="dbtn is-danger" onClick={props.onCancel}>{t("ui.editor.discard")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FocusTrap>
  );
}
