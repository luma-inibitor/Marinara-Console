import { useEffect, useId, useMemo, useRef, useState } from "react";
import { tokensOf } from "../shell/api";
import { closeTopOverlay, openOverlay } from "../shell/overlays";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { cn } from "./cn";
import { t, type Key } from "../copy";

/** A markdown symbol the footer row inserts at the caret, named for a screen reader. */
const MD: ReadonlyArray<{ tok: string; key: Key }> = [
  { tok: "# ", key: "ui.editor.md.heading1" },
  { tok: "## ", key: "ui.editor.md.heading2" },
  { tok: "**", key: "ui.editor.md.bold" },
  { tok: "_", key: "ui.editor.md.italic" },
  { tok: "- ", key: "ui.editor.md.bullet" },
  { tok: "> ", key: "ui.editor.md.quote" },
  { tok: "`", key: "ui.editor.md.code" },
  { tok: "[]", key: "ui.editor.md.link" },
  { tok: "\n", key: "ui.editor.md.newline" },
];

// A mono meta line with · separators, under the title and above the textarea.
const META =
  "font-data text-data-s text-dim [font-variant-ligatures:none] " +
  "[&>*+*]:before:mx-[6px] [&>*+*]:before:text-edge-strong [&>*+*]:before:content-['·']";

/** A full-screen text editor with live counts, a wrap toggle and a markdown symbol row. */
export function FullscreenText(props: {
  title: string;
  subtitle: string;
  initial: string;
  /** When set, shows the value's share of this token budget. */
  budget?: number;
  onDone: (value: string) => void;
  /** Close without applying. Required, since an editor with no exit loses work. */
  onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initial);
  const [wrap, setWrap] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const startTokens = useMemo(() => tokensOf(props.initial), [props.initial]);
  const root = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  const ch = value.length,
    tk = tokensOf(value);
  const dCh = ch - props.initial.length,
    dTk = tk - startTokens;
  const dirty = value !== props.initial;
  const sign = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

  // Read during render, before the focus effect moves focus into the textarea.
  const opener = useRef<HTMLElement | null>(null);
  if (opener.current === null) opener.current = document.activeElement as HTMLElement | null;

  // The stack's closer reads live state through refs, not a render closure.
  const live = useRef({ value, dirty, confirming, onDone: props.onDone, onCancel: props.onCancel });
  live.current = { value, dirty, confirming, onDone: props.onDone, onCancel: props.onCancel };
  const pending = useRef<(() => void) | null>(null);

  // A close that applies or discards goes through the stack.
  const finish = (action: () => void) => {
    pending.current = action;
    closeTopOverlay();
  };

  // Focus returns to the opener only when the editor leaves.
  const leave = (action: () => void) => {
    action();
    if (opener.current?.isConnected) opener.current.focus();
  };

  useEffect(() => {
    if (!confirming) ta.current?.focus();
  }, [confirming]);

  // One overlay entry, owned by the stack, so Escape, back and Cancel share one path.
  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | null = null;
    const register = () => {
      dispose = openOverlay(
        () => {
          dispose = null;
          const action = pending.current;
          pending.current = null;
          if (action) {
            leave(action);
            return;
          }
          const st = live.current;
          if (!st.confirming && !st.dirty) {
            leave(st.onCancel);
            return;
          }
          setConfirming(!st.confirming);
          // A fresh entry, registered after the stack's synchronous drain has finished.
          queueMicrotask(() => {
            if (alive && !dispose) register();
          });
        },
        { restoreFocus: null, surface: root.current },
      );
    };
    register();
    return () => {
      alive = false;
      dispose?.();
      dispose = null;
    };
  }, []);

  const insert = (tok: string) => {
    const el = ta.current;
    if (!el) return;
    const a = el.selectionStart,
      b = el.selectionEnd;
    setValue(value.slice(0, a) + tok + value.slice(b));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = a + tok.length;
      el.focus();
    });
  };

  return (
    // `fseditor` stays as a bare hook for tests/e2e/overlays.spec.ts and scripts/domsnap.mjs.
    <div
      className="fseditor fixed inset-0 z-60 flex flex-col bg-canvas"
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(ev) => {
        if (ev.key !== "Enter" || !(ev.metaKey || ev.ctrlKey)) return;
        ev.preventDefault();
        finish(() => live.current.onDone(live.current.value));
      }}
    >
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <div className="min-w-0 flex-1">
          <div id={titleId} className="t-label">
            {props.title}
          </div>
          <div className={META}>
            <span>{props.subtitle}</span>
            {dirty && <span className="text-accent">{t("ui.editor.unsaved")}</span>}
          </div>
        </div>
        <Chip pressed={wrap} onClick={() => setWrap(!wrap)}>
          {t("ui.editor.wrap")}
        </Chip>
        <Button variant="ghost" onClick={closeTopOverlay}>
          {t("ui.editor.cancel")}
        </Button>
        <Button variant="primary" onClick={() => finish(() => live.current.onDone(live.current.value))}>
          {t("ui.editor.done")}
        </Button>
      </div>
      <div className={cn(META, "border-b border-edge bg-surface-1 px-3 py-[6px]")}>
        <span>
          <b className="t-num">{ch.toLocaleString()}</b> {t("ui.editor.charUnit")}
        </span>
        <span>
          <b className="t-num">{tk.toLocaleString()}</b> {t("ui.editor.tokensEst")}
        </span>
        {props.budget !== undefined && props.budget > 0 && (
          <span>{t("ui.editor.ofBudget", { pct: ((tk / props.budget) * 100).toFixed(1) })}</span>
        )}
        {(dTk !== 0 || dCh !== 0) && (
          <span className={cn("font-bold", dTk > 0 && "text-flag", dTk < 0 && "text-ok")}>
            {sign(dCh)} {t("ui.editor.charUnit")} · {sign(dTk)} {t("ui.editor.tokenUnit")}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 px-3 py-2">
        <textarea
          ref={ta}
          className={cn(
            "size-full resize-none border-0 bg-transparent font-data text-prose leading-[1.65] text-ink outline-none [font-variant-ligatures:none]",
            !wrap && "overflow-x-auto whitespace-pre",
          )}
          aria-labelledby={titleId}
          spellCheck={false}
          value={value}
          onInput={(ev) => setValue(ev.currentTarget.value)}
        />
      </div>
      <div
        role="group"
        aria-label={t("ui.editor.symbols")}
        className="flex [scrollbar-width:none] gap-[5px] overflow-x-auto border-t border-edge px-3 pt-2 pb-[calc(var(--spacing-2)_+_env(safe-area-inset-bottom))] [&::-webkit-scrollbar]:hidden"
      >
        {MD.map((m) => (
          <Button
            key={m.tok}
            labelCase="sentence"
            label={t(m.key)}
            className="flex-none font-data"
            onClick={() => insert(m.tok)}
          >
            {m.tok.trim() || "↵"}
          </Button>
        ))}
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-label={t("ui.editor.discardTitle")}
          className="absolute inset-0 z-5 grid place-items-center bg-[color-mix(in_srgb,var(--canvas)_78%,transparent)] p-4"
        >
          <div className="max-w-[420px] rounded-lg border border-edge bg-surface-1 p-4">
            <p className="m-0 t-label text-ink">{t("ui.editor.discardTitle")}</p>
            <p className="m-0 font-prose text-prose leading-[1.5] text-dim">
              {t("ui.editor.discardBody", { delta: sign(dCh) })}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button onClick={() => setConfirming(false)}>{t("ui.editor.keepEditing")}</Button>
              <Button tone="danger" autoFocus onClick={() => finish(() => live.current.onCancel())}>
                {t("ui.editor.discard")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
