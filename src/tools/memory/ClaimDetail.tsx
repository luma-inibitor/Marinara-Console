// One claim, structured as three zones so mutation properties never blur into
// memory properties (owner feedback, 2026-08-21):
//   1. What this proposal does — per touched section: the memory's ALREADY
//      STORED text (pre-existing, dim) above the PROPOSED text (editable).
//   2. Derived context — the stored line it restates, the incoming duplicate.
//   3. About this proposal — the mutation's own metadata (disposition, risk,
//      claim, change kind, source, evidence).
// Edited text flows through preflight and accept as editedMutations.

import { useState } from "preact/hooks";
import { toast } from "../../shell/toast";
import { type Row, type Mutation } from "./data";
import { t, OURS } from "./strings";
import { decisions, edited, rows, notesById, setDecision, setEdited } from "./store";
import { NoteRef } from "./NotePeek";

/** Human sentence for kind × disposition — the verb line. */
function verbLine(r: Row, m: Mutation): string {
  const type = r.targetType.replaceAll("_", " ");
  switch (m.kind) {
    case "create_note": return `Creates a new ${type} memory`;
    case "append_section": return `Adds to the existing ${type} memory`;
    case "update_section": return `Replaces text on the existing ${type} memory`;
    case "add_link": return `Adds a link on the existing ${type} memory`;
    case "set_keywords": return `Replaces the keywords on the existing ${type} memory`;
    case "set_status": return `Changes the status of the existing ${type} memory`;
    case "set_subjects": return `Rebinds the subjects of the existing ${type} memory`;
  }
}

export function ClaimDetail({ row }: { row: Row }) {
  const r = row;
  const m = (edited.value.get(r.key) ?? r.mutation) as Mutation;
  const d = decisions.value.get(r.key);
  const target = notesById.value.get(r.targetId);
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
    toast(changed ? "Edit staged — applies with the batch" : "No changes");
  };

  const dirty = editableSections.some((s) => (drafts[s.id] ?? s.text) !== s.text);

  // Non-section deltas (links, keywords, status, subjects) are proposed too.
  const otherChanges = r.changes.filter((c) => c.kind !== "section");

  return (
    <div class="claim-detail">
      <div class="decide" role="group" aria-label="Decision">
        <button class="dbtn is-keep-btn" aria-pressed={d === "keep"} onClick={() => setDecision(r, d === "keep" ? null : "keep")}>✓ {OURS.keep}</button>
        <button class="dbtn is-drop-btn" aria-pressed={d === "drop"} onClick={() => setDecision(r, d === "drop" ? null : "drop")}>✗ {OURS.drop}</button>
      </div>

      {/* ── zone 1: what this proposal does to which memory ── */}
      <div class="target-line">
        <span class={`chip t-data type-${r.targetType}`}>{r.targetType.replaceAll("_", " ")}</span>
        {target
          ? <NoteRef id={r.targetId} label={r.targetTitle} />
          : <span class="t-prose">{r.targetTitle}</span>}
        <span class={`exist-tag t-data ${target ? "" : "is-new-tag"}`}>{target ? "in the vault" : "will be created"}</span>
      </div>
      <p class="verb-line t-prose">{verbLine(r, m)}<span class="t-data dim"> · {m.summary}</span></p>

      {editableSections.map((s) => {
        const stored = target?.sections?.[s.label]?.text;
        const value = drafts[s.id] ?? s.text;
        return (
          <section key={s.id} class="dsec">
            <h4 class="t-label t-label-s dsec-head"><span class="dsec-title">{s.label}</span></h4>
            {stored && (
              <div class="stored-zone">
                <span class="zone-tag t-label t-label-s">already stored · {stored.length.toLocaleString()} ch</span>
                <div class="t-prose dim zone-text">{stored}</div>
              </div>
            )}
            <div class="proposed-zone">
              <span class="zone-tag t-label t-label-s is-proposed">
                {m.kind === "update_section" ? "proposed replacement" : stored ? "proposed addition" : "proposed"} · {value.length.toLocaleString()} ch
              </span>
              <textarea
                class="t-prose edit-area"
                rows={Math.min(10, Math.max(3, Math.ceil(s.text.length / 60)))}
                value={value}
                onInput={(e) => setDrafts((prev) => ({ ...prev, [s.id]: e.currentTarget.value }))}
              />
            </div>
          </section>
        );
      })}
      {editableSections.length > 0 && (
        <div class="group-actions">
          <button class="dock-primary t-label" disabled={!dirty} onClick={save}>{t("memoryvault.save")}</button>
          {edited.value.has(r.key) && (
            <button class="action-sec t-label" onClick={() => { setEdited(r.key, null); setDrafts({}); }}>{t("memorysettings.discardChanges")}</button>
          )}
        </div>
      )}

      {otherChanges.length > 0 && (
        <section class="dsec">
          <h4 class="t-label t-label-s">also proposed</h4>
          {otherChanges.map((c, i) => (
            <div key={i} class="proposed-zone">
              <span class="zone-tag t-label t-label-s is-proposed">{c.kind}</span>
              {c.before && <p class="t-prose diff-before zone-text">{c.before}</p>}
              <p class="t-prose diff-after zone-text">{c.after}</p>
            </div>
          ))}
        </section>
      )}

      {r.conflicts.length > 0 && (
        <section class="dsec">
          <h4 class="t-label t-label-s">conflicts with the stored memory</h4>
          {r.conflicts.map((c, i) => (
            <div key={i} class="stored-zone">
              <span class="zone-tag t-label t-label-s">{c.field ?? "field"} · stored vs proposed</span>
              <p class="t-prose diff-before zone-text">{String(c.existing ?? "")}</p>
              <p class="t-prose diff-after zone-text">{String(c.proposed ?? "")}</p>
            </div>
          ))}
        </section>
      )}

      {/* ── zone 2: derived context ── */}
      {r.restates && (
        <section class="dsec">
          <h4 class="t-label t-label-s">restates the vault · <span class="t-data">{r.restates.score.toFixed(2)}</span></h4>
          <div class="stored-zone">
            <span class="zone-tag t-label t-label-s"><NoteRef id={r.restates.noteId} label={notesById.value.get(r.restates.noteId)?.title ?? r.restates.noteId} /></span>
            <p class="t-prose dim zone-text">{r.restates.line}</p>
          </div>
        </section>
      )}
      {partner && (
        <section class="dsec">
          <h4 class="t-label t-label-s">duplicate incoming · <span class="t-data">{r.duplicateOf!.score.toFixed(2)}</span></h4>
          <div class="stored-zone">
            <span class="zone-tag t-label t-label-s">→ {partner.targetTitle}</span>
            <p class="t-prose dim zone-text">{partner.text}</p>
          </div>
        </section>
      )}

      {/* ── zone 3: the proposal's own metadata ── */}
      <section class="dsec about-card">
        <h4 class="t-label t-label-s">about this proposal</h4>
        <div class="kvs t-data">
          <div><span class="k">disposition</span><span class={`disp disp-${r.disposition}`}>{OURS.disposition[r.disposition]}</span></div>
          <div><span class="k">risk</span>{m.risk}</div>
          <div><span class="k">confidence</span>{Math.round(m.confidence * 100)}%</div>
          <div><span class="k">claim</span>{m.claimKind}</div>
          <div><span class="k">change</span>{m.kind}</div>
          <div><span class="k">{t("reviewqueue.sources")}</span><NoteRef id={r.sourceNoteId} label={r.sourceTitle} /></div>
          <div><span class="k">evidence</span><span>
            {m.evidence.map((e, i) => {
              const src = /^source_note:(.+)$/.exec(e);
              return <span key={i} class="linkline">{src ? <NoteRef id={src[1]} label={e} /> : <span class="dim">{e}</span>}</span>;
            })}
          </span></div>
        </div>
      </section>
    </div>
  );
}
