// Entry editor surfaces: the drawer (sub-accordions, MULTI-EXPAND per DESIGN.md)
// and the fullscreen text editor with live counts.
//
// Explicit save (owner decision, 2026-08-21): fields stage into a draft and are
// written only by Save. Nothing here touches the network.
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { tokensOf } from "../../shell/api";
import type { Draft } from "../../shell/draft";
import {
  type Entry, type EntryStatus,
  STATUS_LABEL, STATUS_HINT, POS_COMPACT, POS_FULL, ADVANCED_FIELDS,
  statusOf, entryTokens,
} from "./data";

export interface FullscreenCtx { id: string; field: "content" | "description"; }

const SUBS = ["keys", "description", "content", "trigger", "advanced", "name"] as const;
type Sub = typeof SUBS[number];

export function EntryDrawer(props: {
  entry: Entry;
  /** Non-null when this entry is the active edit target. */
  draft: Draft<Entry> | null;
  kp90: number;
  evHits: string[];
  onBeginEdit: () => void;
  onSave: () => Promise<boolean>;
  onDelete: () => void;
  onExpand: (field: FullscreenCtx["field"]) => void;
}) {
  const { entry: e, draft } = props;
  // multi-expand: a Set, siblings never auto-close (survey §11 / Eli-confirmed)
  const [openSubs, setOpenSubs] = useState<Set<Sub>>(new Set(["keys"]));
  const toggle = (s: Sub) => setOpenSubs((prev) => {
    const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n;
  });

  // Staging an edit adopts this entry as the edit target if it isn't already.
  const set = (field: keyof Entry, v: unknown) => {
    if (!draft) { props.onBeginEdit(); return; }
    draft.set(field, v);
  };
  const merge = (patch: Partial<Entry>) => {
    if (!draft) { props.onBeginEdit(); return; }
    draft.merge(patch);
  };
  const err = (field: string) => draft?.fieldErrors[field];
  const isDirty = (field: string) => draft?.dirtyFields.includes(field) ?? false;

  const status = statusOf(e);
  const advChanged = ADVANCED_FIELDS.filter(([f, d]) =>
    e[f] !== undefined && JSON.stringify(e[f]) !== JSON.stringify(d));

  const sub = (id: Sub, label: string, summary: ComponentChildren, body: () => ComponentChildren, flag = false) => {
    const isOpen = openSubs.has(id);
    return (
      <div class={`sub ${isOpen ? "is-open" : ""} ${flag ? "has-error" : ""}`}>
        <button class="sub-head" aria-expanded={isOpen} onClick={() => toggle(id)}>
          <span class="t-label t-label-s">{label}{flag && <span class="err-dot" aria-label="has an error">●</span>}</span>
          <span class="sub-summary t-data">{summary}</span>
          <span class="caret" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
        </button>
        {isOpen && <div class="sub-body">{body()}</div>}
      </div>
    );
  };

  const fieldErr = (field: string) =>
    err(field) ? <p class="field-err t-data" role="alert">{err(field)}</p> : null;

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
                  onClick={() => set("keys", e.keys.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
            <KeyAdd onAdd={(vals) => set("keys", [...e.keys, ...vals])} />
          </div>
        ), !!err("keys"))}

      {sub("description", "Description",
        <><b>{(e.description ?? "").length}</b> ch · <b>{tokensOf(e.description)}</b> tokens</>,
        () => (
          <>
            <div class="fieldbar">
              <button class="chip" onClick={() => props.onExpand("description")}>⤢ Edit in full screen</button>
            </div>
            <textarea class={`ta ${isDirty("description") ? "is-dirty" : ""}`} rows={4} value={e.description}
              placeholder="Brief summary for routing."
              aria-invalid={!!err("description")}
              onInput={(ev) => set("description", ev.currentTarget.value)} />
            {fieldErr("description")}
          </>
        ), !!err("description"))}

      {sub("content", "Content",
        <><b>{(e.content ?? "").length}</b> ch · <b>{entryTokens(e)}</b> tokens</>,
        () => (
          <>
            <div class="fieldbar">
              <button class="chip" onClick={() => props.onExpand("content")}>⤢ Edit in full screen</button>
            </div>
            <textarea class={`ta is-mono ${isDirty("content") ? "is-dirty" : ""}`} rows={7} value={e.content}
              aria-invalid={!!err("content")}
              onInput={(ev) => set("content", ev.currentTarget.value)} />
            {fieldErr("content")}
          </>
        ), !!err("content"))}

      {sub("trigger", "Trigger & Position",
        <><span class="st">{STATUS_LABEL[status]}</span> · {POS_COMPACT[e.position] ?? ""} · Order <b>{e.order}</b></>,
        () => (
          <>
            <div class="seg4">
              {(["disabled", "normal", "constant", "selective"] as EntryStatus[]).map((v) => (
                <button key={v} class="segbtn" data-v={v} aria-pressed={status === v}
                  onClick={() => merge(
                    v === "disabled" ? { enabled: false }
                      : v === "constant" ? { enabled: true, constant: true, selective: false }
                      : v === "selective" ? { enabled: true, constant: false, selective: true }
                      : { enabled: true, constant: false, selective: false })}>
                  <span class="d" aria-hidden="true" />{STATUS_LABEL[v]}
                </button>
              ))}
            </div>
            <p class="prose-note">{STATUS_HINT[status]}</p>
            <div class="seg4">
              {[0, 1, 2, 7].map((p) => (
                <button key={p} class="segbtn is-pos t-data" aria-pressed={e.position === p}
                  onClick={() => set("position", p)}>{POS_COMPACT[p]}</button>
              ))}
            </div>
            <div class="movebar">
              <button aria-label="Lower order" onClick={() => set("order", Math.max(0, e.order - 10))}>−</button>
              <span class="slot">
                <input class="ordin t-num" type="number" value={e.order} aria-label="Order"
                  onInput={(ev) => set("order", Number(ev.currentTarget.value))} />
                <span class="c">{POS_FULL[e.position] ?? ""}{e.position === 2 ? ` ${e.depth}` : ""}{e.position === 7 ? ` ${e.outletName || "—"}` : ""}</span>
              </span>
              <button aria-label="Raise order" onClick={() => set("order", e.order + 10)}>＋</button>
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
            <div class="advrow"><span class="an t-data">vector</span><span class="av t-data">{e.hasEmbedding ? "yes" : "none"}</span></div>
            <div class="advrow"><span class="an t-data">updated</span><span class="av t-data">{String(e.updatedAt ?? "").slice(0, 16).replace("T", " ")} UTC</span></div>
            <button class="dangerbtn" onClick={props.onDelete}>Delete entry</button>
          </>
        ))}

      {sub("name", "Name", <span class="t-data">{e.name || "Untitled entry"}</span>,
        () => (
          <>
            <input class={`tin ${isDirty("name") ? "is-dirty" : ""}`} value={e.name} placeholder="Untitled entry"
              aria-invalid={!!err("name")}
              onInput={(ev) => set("name", ev.currentTarget.value)} />
            {fieldErr("name")}
          </>
        ), !!err("name"))}

      {draft && <SaveBar draft={draft} onSave={props.onSave} />}
    </div>
  );
}

/** Sticky commit bar — the only thing in this tool that writes. */
function SaveBar(props: { draft: Draft<Entry>; onSave: () => Promise<boolean> }) {
  const d = props.draft;
  if (d.conflict) {
    return (
      <div class="savebar has-conflict" role="alertdialog">
        <p class="t-label">Changed by someone else</p>
        <p class="prose-note">
          This entry was updated elsewhere while you were editing
          {d.conflict.fields.length > 0 && <> — the same {d.conflict.fields.length === 1 ? "field" : "fields"} you changed ({d.conflict.fields.join(", ")})</>}
          . Saving now would overwrite that.
        </p>
        <div class="savebar-acts">
          <button class="dbtn" onClick={d.takeTheirs}>Discard mine, load theirs</button>
          <button class="dbtn is-primary" onClick={d.keepMine}>Re-apply mine over theirs</button>
        </div>
      </div>
    );
  }
  return (
    <div class={`savebar ${d.dirty ? "is-dirty" : ""}`}>
      <span class="savebar-state t-data">
        {d.saving ? "Saving…"
          : d.error ? <span class="is-err">{d.error}</span>
          : d.dirty ? <><b>{d.dirtyFields.length}</b> unsaved {d.dirtyFields.length === 1 ? "change" : "changes"}</>
          : "No changes"}
      </span>
      <div class="savebar-acts">
        <button class="dbtn" disabled={!d.dirty || d.saving} onClick={d.cancel}>Cancel</button>
        <button class="dbtn is-primary" disabled={!d.dirty || d.saving} onClick={() => void props.onSave()}>
          {d.saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/** Inline key entry — replaces window.prompt(); splits pasted lists. */
function KeyAdd(props: { onAdd: (vals: string[]) => void }) {
  const [v, setV] = useState("");
  const commit = () => {
    const vals = v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    if (vals.length) props.onAdd(vals);
    setV("");
  };
  return (
    <input
      class="kadd-in t-data"
      value={v}
      placeholder="+ key"
      aria-label="Add key"
      onInput={(ev) => setV(ev.currentTarget.value)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); commit(); }
        else if (ev.key === "Escape") { ev.preventDefault(); setV(""); }
      }}
      onBlur={commit}
    />
  );
}

export { FullscreenText } from "../../ui/FullscreenText";
