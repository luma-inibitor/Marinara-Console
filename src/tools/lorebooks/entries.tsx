// Entry editor surfaces: the drawer (sub-accordions, MULTI-EXPAND per DESIGN.md)
// and the fullscreen text editor with live counts.
//
// Explicit save: fields stage into a draft and are written only by Save.
// Nothing here touches the network.
import type { ReactNode } from "react";
import { useState } from "react";
import { tokensOf } from "../../shell/api";
import type { Draft } from "../../shell/draft";
import {
  type Entry, type EntryStatus,
  STATUS_LABEL, STATUS_HINT, POS_COMPACT, POS_FULL, ADVANCED_FIELDS,
  statusOf, entryTokens,
} from "./data";
import { Chip } from "../../ui";
import { joinList, t } from "../../copy";
import { Fullscreen, ICON_SIZE, Remove } from "../../ui/icons";

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
  // multi-expand: a Set, so siblings never auto-close
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

  const sub = (id: Sub, label: string, summary: ReactNode, body: () => ReactNode, flag = false) => {
    const isOpen = openSubs.has(id);
    return (
      <div className={`sub ${isOpen ? "is-open" : ""} ${flag ? "has-error" : ""}`}>
        <button className="sub-head" aria-expanded={isOpen} onClick={() => toggle(id)}>
          <span className="t-label t-label-s">{label}{flag && <span className="err-dot" aria-label={t("lorebooks.entry.hasError")}>●</span>}</span>
          <span className="sub-summary t-data">{summary}</span>
          <span className="caret" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
        </button>
        {isOpen && <div className="sub-body">{body()}</div>}
      </div>
    );
  };

  const fieldErr = (field: string) =>
    err(field) ? <p className="field-err t-data" role="alert">{err(field)}</p> : null;

  return (
    <div className="drawer" data-s={status}>
      {sub("keys", t("lorebooks.entry.subKeys"),
        e.keys.length
          ? <><b>{e.keys.length}</b> · {e.keys.slice(0, 3).join(", ")}{e.keys.length > 3 ? "…" : ""}</>
          : <span className="is-warn">{t("lorebooks.entry.keysNone")}</span>,
        () => (
          <div className="kchips">
            {e.keys.map((k, i) => (
              <span key={`${k}:${i}`} className={`kchip ${props.evHits.includes(k) ? "is-hit" : ""}`}>
                <span className="kt">{k}</span>
                <button className="x" aria-label={t("lorebooks.entry.removeKey", { value1: k })}
                  onClick={() => set("keys", e.keys.filter((_, j) => j !== i))}>
                  <Remove size={ICON_SIZE.xs} stroke={2} aria-hidden />
                </button>
              </span>
            ))}
            <KeyAdd onAdd={(vals) => set("keys", [...e.keys, ...vals])} />
          </div>
        ), !!err("keys"))}

      {sub("description", t("lorebooks.entry.subDescription"),
        <><b>{(e.description ?? "").length}</b> {t("ui.editor.charUnit")} · <b>{tokensOf(e.description)}</b> {t("lorebooks.unitTokens")}</>,
        () => (
          <>
            <div className="fieldbar">
              <Chip onClick={() => props.onExpand("description")}>
                <Fullscreen size={ICON_SIZE.sm} stroke={2} aria-hidden />{t("lorebooks.record.editFullscreen")}
              </Chip>
            </div>
            <textarea className={`ta ${isDirty("description") ? "is-dirty" : ""}`} rows={4} value={e.description}
              placeholder={t("lorebooks.entry.descriptionPlaceholder")}
              aria-invalid={!!err("description")}
              onInput={(ev) => set("description", ev.currentTarget.value)} />
            {fieldErr("description")}
          </>
        ), !!err("description"))}

      {sub("content", t("lorebooks.entry.subContent"),
        <><b>{(e.content ?? "").length}</b> {t("ui.editor.charUnit")} · <b>{entryTokens(e)}</b> {t("lorebooks.unitTokens")}</>,
        () => (
          <>
            <div className="fieldbar">
              <Chip onClick={() => props.onExpand("content")}>
                <Fullscreen size={ICON_SIZE.sm} stroke={2} aria-hidden />{t("lorebooks.record.editFullscreen")}
              </Chip>
            </div>
            <textarea className={`ta is-mono ${isDirty("content") ? "is-dirty" : ""}`} rows={7} value={e.content}
              aria-invalid={!!err("content")}
              onInput={(ev) => set("content", ev.currentTarget.value)} />
            {fieldErr("content")}
          </>
        ), !!err("content"))}

      {sub("trigger", t("lorebooks.entry.subTrigger"),
        <><span className="st">{STATUS_LABEL[status]}</span> · {POS_COMPACT[e.position] ?? ""} · {t("lorebooks.field.order")} <b>{e.order}</b></>,
        () => (
          <>
            <div className="seg4">
              {(["disabled", "normal", "constant", "selective"] as EntryStatus[]).map((v) => (
                <button key={v} className="segbtn" data-v={v} aria-pressed={status === v}
                  onClick={() => merge(
                    v === "disabled" ? { enabled: false }
                      : v === "constant" ? { enabled: true, constant: true, selective: false }
                      : v === "selective" ? { enabled: true, constant: false, selective: true }
                      : { enabled: true, constant: false, selective: false })}>
                  <span className="d" aria-hidden="true" />{STATUS_LABEL[v]}
                </button>
              ))}
            </div>
            <p className="prose-note">{STATUS_HINT[status]}</p>
            <div className="seg4">
              {[0, 1, 2, 7].map((p) => (
                <button key={p} className="segbtn is-pos t-data" aria-pressed={e.position === p}
                  onClick={() => set("position", p)}>{POS_COMPACT[p]}</button>
              ))}
            </div>
            <div className="movebar">
              <button aria-label={t("lorebooks.entry.lowerOrder")} onClick={() => set("order", Math.max(0, e.order - 10))}>−</button>
              <span className="slot">
                <input className="ordin t-num" type="number" value={e.order} aria-label={t("lorebooks.field.order")}
                  onInput={(ev) => set("order", Number(ev.currentTarget.value))} />
                <span className="c">{POS_FULL[e.position] ?? ""}{e.position === 2 ? ` ${e.depth}` : ""}{e.position === 7 ? ` ${e.outletName || "—"}` : ""}</span>
              </span>
              <button aria-label={t("lorebooks.entry.raiseOrder")} onClick={() => set("order", e.order + 10)}>＋</button>
            </div>
          </>
        ))}

      {sub("advanced", t("lorebooks.entry.subAdvanced"),
        advChanged.length
          ? <><b>{advChanged.length}</b> {t("lorebooks.entry.advChanged")}</>
          : t("lorebooks.entry.advAllDefault"),
        () => (
          <>
            {ADVANCED_FIELDS.map(([f, d]) => {
              const nd = e[f] !== undefined && JSON.stringify(e[f]) !== JSON.stringify(d);
              return (
                <div key={f} className={`advrow ${nd ? "is-nd" : ""}`}>
                  <span className="an t-data">{f}</span>
                  <span className="av t-data">{JSON.stringify(e[f] ?? d)}</span>
                </div>
              );
            })}
            <div className="advrow">
              <span className="an t-data">{t("lorebooks.entry.fieldVector")}</span>
              <span className="av t-data">{t(e.hasEmbedding ? "lorebooks.valueYes" : "lorebooks.valueNo")}</span>
            </div>
            <div className="advrow">
              <span className="an t-data">{t("lorebooks.entry.fieldUpdated")}</span>
              <span className="av t-data">
                {t("lorebooks.entry.updatedAtUtc", { timestamp: String(e.updatedAt ?? "").slice(0, 16).replace("T", " ") })}
              </span>
            </div>
            <button className="dangerbtn" onClick={props.onDelete}>{t("lorebooks.entry.delete")}</button>
          </>
        ))}

      {sub("name", t("lorebooks.entry.nameLabel"), <span className="t-data">{e.name || t("lorebooks.entry.untitled")}</span>,
        () => (
          <>
            <input className={`tin ${isDirty("name") ? "is-dirty" : ""}`} value={e.name} placeholder={t("lorebooks.entry.untitled")}
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
      <div className="savebar has-conflict" role="alertdialog">
        <p className="t-label">{t("lorebooks.record.conflictTitle")}</p>
        <p className="prose-note">
          {t("lorebooks.entry.conflictBody", {
            detail: d.conflict.fields.length > 0
              ? t("lorebooks.record.conflictFields", {
                  count: d.conflict.fields.length,
                  list: joinList(d.conflict.fields),
                })
              : "",
          })}
        </p>
        <div className="savebar-acts">
          <button className="dbtn" onClick={d.takeTheirs}>{t("lorebooks.record.takeTheirs")}</button>
          <button className="dbtn is-primary" onClick={d.keepMine}>{t("lorebooks.record.keepMine")}</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`savebar ${d.dirty ? "is-dirty" : ""}`}>
      <span className="savebar-state t-data">
        {d.saving ? t("lorebooks.record.saving")
          : d.error ? <span className="is-err">{d.error}</span>
          : d.dirty ? t("lorebooks.record.unsavedChanges", { count: d.dirtyFields.length })
          : t("lorebooks.record.noChanges")}
      </span>
      <div className="savebar-acts">
        <button className="dbtn" disabled={!d.dirty || d.saving} onClick={d.cancel}>{t("lorebooks.record.cancel")}</button>
        <button className="dbtn is-primary" disabled={!d.dirty || d.saving} onClick={() => void props.onSave()}>
          {d.saving ? t("lorebooks.record.saving") : t("lorebooks.record.saveChanges")}
        </button>
      </div>
    </div>
  );
}

/** Inline key entry; splits pasted lists on commas and newlines. */
function KeyAdd(props: { onAdd: (vals: string[]) => void }) {
  const [v, setV] = useState("");
  const commit = () => {
    const vals = v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    if (vals.length) props.onAdd(vals);
    setV("");
  };
  return (
    <input
      className="kadd-in t-data"
      value={v}
      placeholder={t("lorebooks.entry.addKeyPlaceholder")}
      aria-label={t("lorebooks.entry.addKeyLabel")}
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
