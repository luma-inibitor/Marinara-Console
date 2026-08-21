// Entry editor surfaces: the drawer (sub-accordions, MULTI-EXPAND per DESIGN.md)
// and the fullscreen text editor with live counts.
import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import { tokensOf } from "../../shell/api";
import {
  type Entry, type EntryStatus,
  STATUS_LABEL, STATUS_HINT, POS_COMPACT, POS_FULL, ADVANCED_FIELDS,
  statusOf, entryTokens,
} from "./data";
import type { SavePill } from "./BookAudit";

export interface FullscreenCtx { id: string; field: "content" | "description"; }

const SUBS = ["keys", "description", "content", "trigger", "advanced", "name"] as const;
type Sub = typeof SUBS[number];

export function EntryDrawer(props: {
  entry: Entry;
  pill?: SavePill;
  kp90: number;
  evHits: string[];
  save: (id: string, patch: Record<string, unknown>, immediate?: boolean) => void;
  onDelete: () => void;
  onExpand: (field: FullscreenCtx["field"]) => void;
}) {
  const { entry: e, save } = props;
  // multi-expand: a Set, siblings never auto-close (survey §11 / Luma-confirmed)
  const [openSubs, setOpenSubs] = useState<Set<Sub>>(new Set(["keys"]));
  const toggle = (s: Sub) => setOpenSubs((prev) => {
    const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n;
  });

  const status = statusOf(e);
  const advChanged = ADVANCED_FIELDS.filter(([f, d]) =>
    e[f] !== undefined && JSON.stringify(e[f]) !== JSON.stringify(d));

  const sub = (id: Sub, label: string, summary: ComponentChildren, body: () => ComponentChildren) => {
    const isOpen = openSubs.has(id);
    return (
      <div class={`sub ${isOpen ? "is-open" : ""}`}>
        <button class="sub-head" aria-expanded={isOpen} onClick={() => toggle(id)}>
          <span class="t-label t-label-s">{label}</span>
          <span class="sub-summary t-data">{summary}</span>
          <span class="caret" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
        </button>
        {isOpen && <div class="sub-body">{body()}</div>}
      </div>
    );
  };

  return (
    <div class="drawer" data-s={status}>
      {sub("keys", "Primary Keys",
        e.keys.length
          ? <><b>{e.keys.length}</b> · {e.keys.slice(0, 3).join(", ")}{e.keys.length > 3 ? "…" : ""}</>
          : <span class="is-warn">none</span>,
        () => (
          <div class="kchips">
            {e.keys.map((k, i) => (
              <span key={`${k}:${i}`} class={`kchip ${props.evHits.includes(k) ? "is-hit" : ""}`}>
                <span class="kt">{k}</span>
                <button class="x" aria-label={`Remove ${k}`}
                  onClick={() => save(e.id, { keys: e.keys.filter((_, j) => j !== i) }, true)}>×</button>
              </span>
            ))}
            <button class="kadd t-data" onClick={() => {
              const k = prompt("Add key");
              if (k?.trim()) save(e.id, { keys: [...e.keys, k.trim()] }, true);
            }}>＋</button>
          </div>
        ))}

      {sub("description", "Description",
        <><b>{(e.description ?? "").length}</b> ch · <b>{tokensOf(e.description)}</b> tokens</>,
        () => (
          <>
            <div class="fieldbar">
              <button class="chip" onClick={() => props.onExpand("description")}>⤢ Edit Description</button>
            </div>
            <textarea class="ta" rows={4} value={e.description}
              placeholder="Brief summary for routing."
              onInput={(ev) => save(e.id, { description: ev.currentTarget.value })}
              onBlur={(ev) => save(e.id, { description: ev.currentTarget.value }, true)} />
          </>
        ))}

      {sub("content", "Content",
        <><b>{(e.content ?? "").length}</b> ch · <b>{entryTokens(e)}</b> tokens</>,
        () => (
          <>
            <div class="fieldbar">
              <button class="chip" onClick={() => props.onExpand("content")}>⤢ Edit Content</button>
            </div>
            <textarea class="ta is-mono" rows={7} value={e.content}
              onInput={(ev) => save(e.id, { content: ev.currentTarget.value })}
              onBlur={(ev) => save(e.id, { content: ev.currentTarget.value }, true)} />
          </>
        ))}

      {sub("trigger", "Trigger & Position",
        <><span class="st">{STATUS_LABEL[status]}</span> · {POS_COMPACT[e.position] ?? ""} · Order <b>{e.order}</b></>,
        () => (
          <>
            <div class="seg4">
              {(["disabled", "normal", "constant", "selective"] as EntryStatus[]).map((v) => (
                <button key={v} class="segbtn" data-v={v} aria-pressed={status === v}
                  onClick={() => {
                    const patch = v === "disabled" ? { enabled: false }
                      : v === "constant" ? { enabled: true, constant: true, selective: false }
                      : v === "selective" ? { enabled: true, constant: false, selective: true }
                      : { enabled: true, constant: false, selective: false };
                    save(e.id, patch, true);
                  }}>
                  <span class="d" aria-hidden="true" />{STATUS_LABEL[v]}
                </button>
              ))}
            </div>
            <p class="hint t-data">{STATUS_HINT[status]}</p>
            <div class="seg4">
              {[0, 1, 2, 7].map((p) => (
                <button key={p} class="segbtn is-pos t-data" aria-pressed={e.position === p}
                  onClick={() => save(e.id, { position: p }, true)}>{POS_COMPACT[p]}</button>
              ))}
            </div>
            <div class="movebar">
              <button aria-label="Lower order" onClick={() => save(e.id, { order: Math.max(0, e.order - 10) }, true)}>−</button>
              <span class="slot">
                <span class="v t-num">{e.order}</span>
                <span class="c t-data">{POS_FULL[e.position] ?? ""}{e.position === 2 ? ` ${e.depth}` : ""}{e.position === 7 ? ` ${e.outletName || "—"}` : ""}</span>
              </span>
              <button aria-label="Raise order" onClick={() => save(e.id, { order: e.order + 10 }, true)}>＋</button>
            </div>
          </>
        ))}

      {sub("advanced", "Advanced",
        advChanged.length ? <><b>{advChanged.length}</b> changed</> : "all default",
        () => (
          <>
            {ADVANCED_FIELDS.map(([f, d]) => {
              const nd = e[f] !== undefined && JSON.stringify(e[f]) !== JSON.stringify(d);
              return (
                <div key={f} class={`advrow ${nd ? "is-nd" : ""}`}>
                  <span class="an t-data">{f}</span>
                  <span class="av t-data">{JSON.stringify(e[f] ?? d)}</span>
                </div>
              );
            })}
            <div class="advrow"><span class="an t-data">vector</span><span class="av t-data">{e.hasEmbedding ? "yes" : "No Vector"}</span></div>
            <div class="advrow"><span class="an t-data">updated</span><span class="av t-data">{String(e.updatedAt ?? "").slice(0, 16).replace("T", " ")}</span></div>
            <button class="dangerbtn" onClick={props.onDelete}>Delete entry</button>
          </>
        ))}

      {sub("name", "Name",
        <span class={`savepill is-${props.pill ?? "saved"}`}>
          {props.pill === "dirty" ? "Autosaving…" : props.pill === "err" ? "Failed to save" : "Saved automatically"}
        </span>,
        () => (
          <input class="tin" value={e.name} placeholder="Untitled entry"
            onInput={(ev) => save(e.id, { name: ev.currentTarget.value })}
            onBlur={(ev) => save(e.id, { name: ev.currentTarget.value }, true)} />
        ))}
    </div>
  );
}

// ── fullscreen text editor ──
const MD_TOKENS = ["# ", "## ", "**", "_", "- ", "> ", "`", "[]", "\n"];
const FIELD_TITLE: Record<FullscreenCtx["field"], string> = {
  content: "Edit Content", description: "Edit Description",
};

export function FullscreenEditor(props: {
  entry: Entry;
  field: FullscreenCtx["field"];
  budget: number;
  onDone: (value: string) => void;
}) {
  const original = String(props.entry[props.field] ?? "");
  const [value, setValue] = useState(original);
  const [wrap, setWrap] = useState(true);
  const startTokens = useMemo(() => tokensOf(original), [original]);

  const ch = value.length, tk = tokensOf(value);
  const dCh = ch - original.length, dTk = tk - startTokens;
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
    <div class="fseditor" role="dialog" aria-modal="true" aria-label={FIELD_TITLE[props.field]}>
      <div class="fs-head">
        <div class="fs-title-wrap">
          <div class="t-label">{FIELD_TITLE[props.field]}</div>
          <div class="meta"><span>{props.entry.name}</span></div>
        </div>
        <button class="chip" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>↵ wrap</button>
        <button class="dbtn is-primary" onClick={() => props.onDone(value)}>Done</button>
      </div>
      <div class="fs-counts meta">
        <span><b class="t-num">{ch.toLocaleString()}</b> ch</span>
        <span><b class="t-num">{tk.toLocaleString()}</b> tokens (est.)</span>
        {props.budget > 0 && <span>{((tk / props.budget) * 100).toFixed(1)}% of budget</span>}
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
