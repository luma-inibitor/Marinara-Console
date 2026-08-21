// One claim, fully: decision, editable text (edited mutations flow through
// preflight and accept as editedMutations), evidence, diffs, conflicts, and
// the derived-signal context (the stored line it restates, the incoming
// duplicate it collides with).

import { useState } from "preact/hooks";
import { toast } from "../../shell/toast";
import { type Row, type Mutation } from "./data";
import { t, OURS } from "./strings";
import { decisions, edited, rows, setDecision, setEdited } from "./store";
import { NoteRef } from "./NotePeek";

export function ClaimDetail({ row }: { row: Row }) {
  const r = row;
  const m = (edited.value.get(r.key) ?? r.mutation) as Mutation;
  const d = decisions.value.get(r.key);
  const partner = r.duplicateOf ? rows.value.find((x) => x.key === r.duplicateOf!.key) : null;
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const editableSections: Array<{ id: string; label: string; text: string }> =
    m.kind === "create_note"
      ? Object.entries(m.note?.sections ?? {}).map(([key, s]) => ({ id: key, label: key, text: s.text ?? "" }))
      : (m.kind === "append_section" || m.kind === "update_section")
        ? [{ id: "__text", label: m.sectionKey ?? "text", text: m.text ?? m.section?.text ?? "" }]
        : [];

  const save = () => {
    const next = structuredClone(m) as Mutation;
    let changed = false;
    for (const s of editableSections) {
      const v = drafts[s.id] ?? s.text;
      if (!v.trim()) { toast(t("reviewqueue.sectionTextCannotBeEmpty"), { kind: "error" }); return; }
      if (s.id === "__text") {
        if (next.kind === "update_section" && next.section) next.section.text = v;
        else next.text = v;
        changed ||= v !== (r.mutation.text ?? r.mutation.section?.text ?? "");
      } else {
        next.note!.sections[s.id] = { ...next.note!.sections[s.id], text: v };
        changed ||= v !== (r.mutation.note?.sections?.[s.id]?.text ?? "");
      }
    }
    setEdited(r.key, changed ? next : null);
    setDrafts({});
    toast(changed ? t("memoryvault.saved") : "No changes");
  };

  const dirty = editableSections.some((s) => (drafts[s.id] ?? s.text) !== s.text);

  return (
    <div class="claim-detail">
      <div class="decide" role="group" aria-label="Decision">
        <button class="dbtn is-keep-btn" aria-pressed={d === "keep"} onClick={() => setDecision(r, d === "keep" ? null : "keep")}>✓ {OURS.keep}</button>
        <button class="dbtn is-drop-btn" aria-pressed={d === "drop"} onClick={() => setDecision(r, d === "drop" ? null : "drop")}>✗ {OURS.drop}</button>
      </div>

      <div class="kvs t-data">
        <div><span class="k">disposition</span><span class={`disp disp-${r.disposition}`}>{OURS.disposition[r.disposition]}</span></div>
        <div><span class="k">risk</span>{m.risk}</div>
        <div><span class="k">change</span>{m.kind}</div>
        <div><span class="k">claim</span>{m.claimKind}</div>
        <div><span class="k">{t("reviewqueue.sources")}</span><NoteRef id={r.sourceNoteId} label={r.sourceTitle} /></div>
        <div><span class="k">target</span><span class={`chip t-data type-${r.targetType}`}>{r.targetType.replaceAll("_", " ")}</span> <NoteRef id={r.targetId} label={r.targetTitle} /></div>
      </div>

      <section class="dsec">
        <h4 class="t-label t-label-s">summary</h4>
        <p class="t-prose">{m.summary}</p>
      </section>

      {editableSections.map((s) => (
        <section key={s.id} class="dsec">
          <h4 class="t-label t-label-s">{s.label} <span class="t-data dim">{(drafts[s.id] ?? s.text).length.toLocaleString()} ch</span></h4>
          <textarea
            class="t-prose edit-area"
            rows={Math.min(10, Math.max(3, Math.ceil(s.text.length / 60)))}
            value={drafts[s.id] ?? s.text}
            onInput={(e) => setDrafts((prev) => ({ ...prev, [s.id]: e.currentTarget.value }))}
          />
        </section>
      ))}
      {editableSections.length > 0 && (
        <div class="group-actions">
          <button class="dock-primary t-label" disabled={!dirty} onClick={save}>{t("memoryvault.save")}</button>
          {edited.value.has(r.key) && (
            <button class="chip" onClick={() => { setEdited(r.key, null); setDrafts({}); }}>{t("memorysettings.discardChanges")}</button>
          )}
        </div>
      )}

      {r.restates && (
        <section class="dsec">
          <h4 class="t-label t-label-s">restates the vault · <span class="t-data">{r.restates.score.toFixed(2)}</span></h4>
          <div class="diffline"><NoteRef id={r.restates.noteId} /><p class="t-prose dim">{r.restates.line}</p></div>
        </section>
      )}
      {partner && (
        <section class="dsec">
          <h4 class="t-label t-label-s">duplicate incoming · <span class="t-data">{r.duplicateOf!.score.toFixed(2)}</span></h4>
          <div class="diffline"><span class="t-data dim">→ {partner.targetTitle}</span><p class="t-prose dim">{partner.text}</p></div>
        </section>
      )}

      {r.changes.length > 0 && (
        <section class="dsec">
          <h4 class="t-label t-label-s">changes</h4>
          {r.changes.map((c, i) => (
            <div key={i} class="diffline">
              <span class="t-data dim">{c.kind} · {c.key}</span>
              {c.before && <p class="t-prose diff-before">{c.before}</p>}
              <p class="t-prose diff-after">{c.after}</p>
            </div>
          ))}
        </section>
      )}

      {r.conflicts.length > 0 && (
        <section class="dsec">
          <h4 class="t-label t-label-s">conflicts</h4>
          {r.conflicts.map((c, i) => (
            <div key={i} class="diffline">
              <span class="t-data dim">{c.field ?? ""}</span>
              <p class="t-prose diff-before">{String(c.existing ?? "")}</p>
              <p class="t-prose diff-after">{String(c.proposed ?? "")}</p>
            </div>
          ))}
        </section>
      )}

      <section class="dsec">
        <h4 class="t-label t-label-s">evidence</h4>
        {m.evidence.map((e, i) => {
          const src = /^source_note:(.+)$/.exec(e);
          return <div key={i} class="t-data dim">{src ? <NoteRef id={src[1]} label={e} /> : e}</div>;
        })}
      </section>
    </div>
  );
}
