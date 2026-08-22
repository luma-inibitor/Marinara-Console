// One claim, structured as zones (owner-approved detail card v4, 2026-08-21):
//   1. THE PROPOSAL — facts that belong to the mutation. Identity line (type
//      icon · title · existence · confidence), op line (op icon · op word ·
//      §section · contribution chars · refs), the proposed text (editable,
//      with the target's ALREADY STORED text above it), and the enum chips
//      (claim kind · disposition · risk) with field-prefixed definitions.
//   2. COMPUTED SIGNALS — numbers the console computed about it, visually
//      marked as signals, not properties; each is a sentence. The restated
//      stored line / incoming duplicate render underneath as the evidence.
//   3. PROVENANCE — source and evidence refs.
// Edited text flows through preflight and accept as editedMutations.

import { useState } from "preact/hooks";
import { toast } from "../../shell/toast";
import { type Row, type Mutation } from "./data";
import { t } from "./strings";
import { decisions, edited, rows, notesById, pressure, setDecision, setEdited } from "./store";
import { SECTION_CAP } from "./data";
import { NoteRef } from "./NotePeek";
import { IconFlag } from "@tabler/icons-preact";
import { OpIcon, TypeIcon, OP_WORD } from "./icons";
import { Term, GLOSSARY, OP_TIP, TYPE_TIP } from "./glossary";
import { flagsOf, contributionChars } from "./flags";
import { OURS } from "./strings";

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

      {/* ── zone 1: THE PROPOSAL — the mutation's own facts ── */}
      <div class="dz-line target-line">
        <Term tip={TYPE_TIP[r.targetType] ?? r.targetType}><TypeIcon type={r.targetType} /></Term>
        {!target && <span class="ndot" aria-label="will be created" />}
        {target
          ? <NoteRef id={r.targetId} label={r.targetTitle} />
          : <span class="t-prose dz-title">{r.targetTitle}</span>}
        <span class={`exist-tag t-data ${target ? "" : "is-new-tag"}`}>{target ? "in the vault" : "will be created"}</span>
        <span class="dz-sp" />
        <span class="chs t-data">{Math.round(m.confidence * 100)}%</span>
      </div>
      <div class="dz-line op-line t-data">
        <Term tip={OP_TIP[m.kind]}><OpIcon kind={m.kind} /></Term>
        <span class="enum">{OP_WORD[m.kind]}</span>
        {m.sectionKey && <span class="skey">§{m.sectionKey}</span>}
        <span class="dz-sp" />
        {contributionChars(r) > 0 && <span class="chs">+{contributionChars(r).toLocaleString()} chars</span>}
        <span class="chs">{m.evidence.length} refs</span>
      </div>

      {editableSections.map((s) => {
        const stored = target?.sections?.[s.label]?.text;
        const value = drafts[s.id] ?? s.text;
        return (
          <section key={s.id} class="dsec">
            <h4 class="t-label t-label-s dsec-head"><span class="dsec-title">{s.label}</span></h4>
            {stored && (
              <div class="stored-zone">
                <span class="zone-tag t-label t-label-s">already stored<span class="zone-ch t-data">{stored.length.toLocaleString()} ch</span></span>
                <div class="t-prose dim zone-text">{stored}</div>
              </div>
            )}
            <div class="proposed-zone">
              <span class="zone-tag t-label t-label-s is-proposed">
                {m.kind === "update_section" ? "proposed replacement" : stored ? "proposed addition" : "proposed"}
                <span class="zone-ch t-data">
                  {(() => {
                    const p = pressure.value.get(`${r.targetId} ${s.label}`);
                    if (!p || p.projected < SECTION_CAP * 0.8) return null;
                    const over = p.projected > SECTION_CAP;
                    return <span class={over ? "is-drop" : "fl"}>{(p.projected / 1000).toFixed(1)}k / {(SECTION_CAP / 1000).toFixed(0)}k after batch · </span>;
                  })()}
                  {value.length.toLocaleString()} ch
                </span>
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

      {/* enum chips — the near-constant fields, each teaching its own word */}
      <div class="dz-chips">
        <Term chip tip={GLOSSARY[m.claimKind] ?? m.claimKind}>{m.claimKind}</Term>
        <Term chip tip={GLOSSARY[r.disposition] ?? r.disposition}>{OURS.disposition[r.disposition]}</Term>
        <Term chip tip={GLOSSARY[`${m.risk} risk`] ?? m.risk}>{m.risk} risk</Term>
      </div>

      {/* ── zone 2: COMPUTED SIGNALS — what the console noticed ── */}
      {flagsOf(r).length > 0 && (
        <section class="dsec dz-sig">
          <h4 class="t-label t-label-s">computed signals</h4>
          {flagsOf(r).map((f) => (
            <div key={f.label} class="sig t-prose" data-sev={f.severity}>
              <IconFlag size={13} stroke={1.75} aria-hidden />
              <span>{f.sentence}</span>
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

      {/* ── zone 3: provenance ── */}
      <section class="dsec about-card">
        <h4 class="t-label t-label-s">provenance</h4>
        <div class="kvs t-data">
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
