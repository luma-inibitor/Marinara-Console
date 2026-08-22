// One claim, organized around the decision (owner-approved v5, 2026-08-22;
// specimens: public/mockups/detail-v5.html). Zones, in the order a reviewer
// asks their questions:
//   1. HEADLINE — one sentence: what this claim does and to which memory.
//   2. PREVIEW — op-specific consequence: the vault as it will look after
//      keep. Append = after-state with stored context folded; update = diff
//      (the one destructive op shows what dies); create = the memory as it
//      will exist; link / keywords / status / subjects = the fact, resolved.
//   3. EVIDENCE — source attribution + snippet, extraction confidence as a
//      sentence, diagnostics, and the quiet extraction line (4B).
//   4. DECIDE — keep/drop at the bottom in the list's circle vocabulary.
// Editing is a mode: the edit button swaps proposed content for a textarea
// and the decide bar for save/discard. Edits flow through preflight and
// accept as editedMutations, exactly as before.

import { type ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { IconChevronRight, IconEye, IconFlag, IconInfoCircle, IconPencil, IconWriting, IconArrowRight } from "@tabler/icons-preact";
import { toast } from "../../shell/toast";
import { type Mutation, type Row, KEYWORD_CAP, SECTION_CAP } from "./data";
import { t, OURS } from "./strings";
import { decisions, edited, rows, notesById, pressure, setDecision, setEdited } from "./store";
import { NoteRef, peekNote } from "./NotePeek";
import { OpIcon, TypeIcon, DecisionIcon } from "./icons";
import { Term, GLOSSARY, OP_TIP, TYPE_TIP } from "./glossary";
import { flagsOf } from "./flags";
import { lineDiff, splitLines, wordEmphasis } from "./diff";

// ── small pieces ────────────────────────────────────────────────────

/** A memory reference: type icon + tappable title. */
function Ref(props: { id?: string; title: string; type?: string }) {
  return (
    <span class="nref">
      {props.type && <Term tip={TYPE_TIP[props.type] ?? props.type}><TypeIcon type={props.type} size={14} /></Term>}
      {props.id ? <NoteRef id={props.id} label={props.title} /> : <b class="nref-plain">{props.title}</b>}
    </span>
  );
}

function Skey(props: { k: string }) {
  return <span class="skey">§{props.k}</span>;
}

function Fold(props: { label: string; children: ComponentChildren }) {
  return (
    <details class="fold">
      <summary class="t-data"><IconChevronRight class="fold-c" size={12} stroke={1.75} aria-hidden /><span>{props.label}</span></summary>
      {props.children}
    </details>
  );
}

function Line(props: { mode?: "add" | "del"; children: ComponentChildren }) {
  const g = props.mode === "add" ? "+" : props.mode === "del" ? "−" : "";
  return (
    <div class={`ln ln-${props.mode ?? "ctx"}`}>
      <span class="lg" data-contrast-exempt>{g}</span>
      <span class="lt">{props.children}</span>
    </div>
  );
}

function Zone(props: { eyebrow: ComponentChildren; foot?: ComponentChildren; cls?: string; children: ComponentChildren }) {
  return (
    <div class={`zone ${props.cls ?? ""}`}>
      <div class="z-eye t-label t-label-s">{props.eyebrow}</div>
      {props.children}
      {props.foot && <div class="z-foot t-data">{props.foot}</div>}
    </div>
  );
}

/** Help text: the info glyph marks it as education, not content. */
function Edu({ children }: { children: ComponentChildren }) {
  return (
    <p class="edu t-prose dim">
      <IconInfoCircle size={12} stroke={1.75} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** The object under review, inlined (owner-approved S7): an inset card of the
 *  memory's content — dimmer, no diff gutters, folded past three lines. It is
 *  context, not part of the change. Resolves vault memories first, then
 *  batch-pending creates. */
function InlineMemory({ id }: { id: string }) {
  const note = notesById.value.get(id);
  const secs = note
    ? Object.values(note.sections ?? {}).map((s) => s.text ?? "")
    : Object.values(
        rows.value.find((x) => x.targetId === id && x.mutation.kind === "create_note")?.mutation.note?.sections ?? {},
      ).map((s) => s.text ?? "");
  const lines = secs.flatMap(splitLines);
  if (!lines.length) return null;
  const head = lines.slice(0, 3);
  const rest = lines.slice(3);
  return (
    <div class="inline-card">
      {head.map((l, i) => <div key={i} class="lt-i t-prose">{l}</div>)}
      {rest.length > 0 && (
        <Fold label={`${rest.length} more line${rest.length === 1 ? "" : "s"} · ${rest.join(" ").length.toLocaleString()} ch`}>
          {rest.map((l, i) => <div key={i} class="lt-i t-prose">{l}</div>)}
        </Fold>
      )}
    </div>
  );
}

/** Cap pressure for one section, shown only when it matters (≥80%). */
function capNote(targetId: string, key: string) {
  const p = pressure.value.get(`${targetId} ${key}`);
  if (!p || p.projected < SECTION_CAP * 0.8) return null;
  const over = p.projected > SECTION_CAP;
  return (
    <span class={over ? "is-drop" : "fl"}>
      {(p.projected / 1000).toFixed(1)}k / {(SECTION_CAP / 1000).toFixed(0)}k after batch
    </span>
  );
}

const STORED_CONTEXT = 2; // stored lines kept visible above an append

// ── the pane ────────────────────────────────────────────────────────

export function ClaimDetail({ row }: { row: Row }) {
  const r = row;
  const m = (edited.value.get(r.key) ?? r.mutation) as Mutation;
  const d = decisions.value.get(r.key);
  const target = notesById.value.get(r.targetId);
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
    toast(changed ? "Edit staged — applies with the batch" : "No changes");
  };
  const discard = () => { setDrafts({}); setEditing(false); };

  const openBtn = target && (m.kind === "append_section" || m.kind === "update_section") && !editing && (
    <button class="zbtn hit" onClick={() => void peekNote(r.targetId)}>
      <IconEye size={12} stroke={1.75} aria-hidden /> {t("reviewqueue.openMemory").toLowerCase()}
    </button>
  );
  const editBtn = editableSections.length > 0 && !editing && (
    <button class="zbtn hit" onClick={() => setEditing(true)}>
      <IconPencil size={12} stroke={1.75} aria-hidden /> {t("longtermmemorydetail.reviewEdit").toLowerCase()}
    </button>
  );
  const staged = edited.value.has(r.key);
  const stagedMark = staged && !editing && (
    <span class="zbtn-group">
      <Term tip="edited — this claim's text was changed by you; the edit applies with the batch">
        <IconWriting class="edit-mark" size={13} stroke={1.75} aria-hidden />
      </Term>
      <button class="zbtn hit" onClick={() => { setEdited(r.key, null); setDrafts({}); }}>
        {t("memorysettings.discardChanges").toLowerCase()}
      </button>
    </span>
  );

  return (
    <div class="claim-detail">
      <Headline r={r} m={m} target={Boolean(target)} />
      <Preview r={r} m={m} editing={editing} drafts={drafts} setDrafts={setDrafts}
        editableSections={editableSections} controls={<>{openBtn}{editBtn}{stagedMark}</>} />
      <Evidence r={r} m={m} />
      <div class="decbar">
        {editing ? (
          <>
            <button class="dbtn2 save-on hit" onClick={save}>{t("memoryvault.save").toLowerCase()}</button>
            <button class="dbtn2 hit" onClick={discard}>{t("memorysettings.discardChanges").toLowerCase()}</button>
            <span class="decbar-note t-data" data-contrast-exempt>applies with the batch</span>
          </>
        ) : (
          <>
            <button class="dbtn2 hit" data-on={d === "keep"} data-dk="keep"
              onClick={() => setDecision(r, d === "keep" ? null : "keep")}>
              <DecisionIcon d="keep" size={15} /> {OURS.keep}
            </button>
            <button class="dbtn2 hit" data-on={d === "drop"} data-dk="drop"
              onClick={() => setDecision(r, d === "drop" ? null : "drop")}>
              <DecisionIcon d="drop" size={15} /> {OURS.drop}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── zone 1: headline ────────────────────────────────────────────────

function Headline({ r, m, target }: { r: Row; m: Mutation; target: boolean }) {
  const ref = <Ref id={target ? r.targetId : undefined} title={r.targetTitle} type={r.targetType} />;
  const body = (() => {
    switch (m.kind) {
      case "create_note":
        return <>creates a new {r.targetType.replaceAll("_", " ")} memory — {ref}</>;
      case "append_section":
        return <>adds to <Skey k={m.sectionKey ?? ""} /> of {ref}</>;
      case "update_section":
        return <>rewrites <Skey k={m.sectionKey ?? ""} /> of {ref}</>;
      case "add_link":
        return <>links {ref} to <LinkTarget target={m.link?.target ?? ""} /></>;
      case "set_keywords":
        return <>replaces the keywords of {ref}</>;
      case "set_status":
        return <>changes the status of {ref}</>;
      case "set_subjects":
        return <>changes the subjects of {ref}</>;
    }
  })();
  return <div class="hl t-prose">{body}</div>;
}

/** Resolve a link target against the vault, then against this batch. The
 *  pending-in-batch chip renders only where asked — the preview states it;
 *  the headline stays short. */
function LinkTarget({ target, chip }: { target: string; chip?: boolean }) {
  const note = notesById.value.get(target);
  if (note) return <Ref id={target} title={note.title ?? target} type={note.type} />;
  const pending = rows.value.find((x) => x.targetId === target && x.mutation.kind === "create_note");
  if (pending) {
    return <span class="nref"><Ref title={pending.targetTitle} type={pending.targetType} />{chip && <span class="chip-batch t-data">pending in this batch</span>}</span>;
  }
  return <span class="dim t-data">{target}</span>;
}

// ── zone 2: preview ─────────────────────────────────────────────────

function Preview(props: {
  r: Row; m: Mutation; editing: boolean;
  drafts: Record<string, string>; setDrafts: (f: (p: Record<string, string>) => Record<string, string>) => void;
  editableSections: Array<{ id: string; label: string; text: string }>;
  controls: ComponentChildren;
}) {
  const { r, m, editing } = props;
  const target = notesById.value.get(r.targetId);
  // The op icon lives on the preview zone (not the headline — a sentence
  // starting with an icon read wrong), keeping its education tooltip in the pane.
  const opTag = <Term tip={OP_TIP[m.kind]}><span class="z-opi"><OpIcon kind={m.kind} size={13} /></span></Term>;

  const area = (id: string, text: string) => (
    <textarea class="edit-area t-prose" rows={Math.min(10, Math.max(3, Math.ceil(text.length / 60)))}
      value={props.drafts[id] ?? text}
      onInput={(e) => { const v = e.currentTarget.value; props.setDrafts((p) => ({ ...p, [id]: v })); }} />
  );

  if (m.kind === "append_section") {
    const key = m.sectionKey ?? "";
    const stored = target?.sections?.[key]?.text ?? "";
    const storedLines = splitLines(stored);
    const adds = splitLines(m.text);
    const head = storedLines.slice(0, Math.max(0, storedLines.length - STORED_CONTEXT));
    const tail = storedLines.slice(Math.max(0, storedLines.length - STORED_CONTEXT));
    const addCh = (m.text ?? "").length;
    return (
      <Zone cls={editing ? "is-editing" : ""} eyebrow={<><span class="z-lab">{opTag}<Skey k={key} /> · {editing ? "editing proposed content" : OURS.zonePreview}</span>{props.controls}</>}
        foot={<><span class="dim">+{addCh.toLocaleString()} · {(stored.length + addCh).toLocaleString()} ch</span>{capNote(r.targetId, key)}</>}>
        {head.length > 0 && (
          <Fold label={`${head.length} earlier line${head.length === 1 ? "" : "s"} · ${head.join(" ").length.toLocaleString()} ch`}>
            {head.map((l, i) => <Line key={i}>{l}</Line>)}
          </Fold>
        )}
        {tail.map((l, i) => <Line key={i}>{l}</Line>)}
        {editing ? area("__text", m.text ?? "") : adds.map((l, i) => <Line key={i} mode="add">{l}</Line>)}
      </Zone>
    );
  }

  if (m.kind === "update_section") {
    const key = m.sectionKey ?? "";
    const change = r.changes.find((c) => c.kind === "section");
    const before = change?.before ?? target?.sections?.[key]?.text ?? "";
    const after = change?.after ?? m.section?.text ?? m.text ?? "";
    return (
      <Zone cls={editing ? "is-editing" : ""} eyebrow={<><span class="z-lab">{opTag}<Skey k={key} /> · {editing ? "editing proposed content" : OURS.zoneDiff}</span>{props.controls}</>}
        foot={<><span class="dim">{after.length >= before.length ? "+" : "−"}{Math.abs(after.length - before.length).toLocaleString()} · {after.length.toLocaleString()} ch</span>{capNote(r.targetId, key)}</>}>
        {editing
          ? <>{splitLines(before).map((l, i) => <Line key={i} mode="del">{l}</Line>)}{area("__text", after)}</>
          : <DiffLines before={before} after={after} />}
      </Zone>
    );
  }

  if (m.kind === "create_note") {
    const secs = Object.entries(m.note?.sections ?? {});
    const totalCh = secs.reduce((n, [, s]) => n + (s.text ?? "").length, 0);
    const kws = m.note?.keywords ?? [];
    return (
      <Zone cls={`nc ${editing ? "is-editing" : ""}`}
        eyebrow={<><span class="z-lab">{opTag}{OURS.zoneNewMemory} · {editing ? "editing proposed content" : OURS.zonePreview}</span>{props.controls}</>}
        foot={<span class="dim">+{totalCh.toLocaleString()} ch · {OURS.zoneNewMemory}</span>}>
        {secs.map(([key, s]) => {
          const lines = splitLines(s.text);
          const headLines = lines.slice(0, 3);
          const rest = lines.slice(3);
          return (
            <div key={key} class="nc-sec">
              <div class="z-eye t-label t-label-s"><Skey k={key} /></div>
              {editing ? area(key, s.text ?? "") : (
                <>
                  {headLines.map((l, i) => <Line key={i} mode="add">{l}</Line>)}
                  {rest.length > 0 && (
                    <Fold label={`show the rest · ${rest.join(" ").length.toLocaleString()} of ${(s.text ?? "").length.toLocaleString()} ch`}>
                      {rest.map((l, i) => <Line key={i} mode="add">{l}</Line>)}
                    </Fold>
                  )}
                </>
              )}
            </div>
          );
        })}
        {kws.length > 0 && (
          <div class="kwrap">{kws.map((k) => <span key={k} class="kwc kw-add t-data">+ {k}</span>)}</div>
        )}
      </Zone>
    );
  }

  if (m.kind === "add_link") {
    const rel = (m.link?.relation ?? "").replaceAll("_", " ");
    return (
      <Zone eyebrow={<span class="z-lab">{opTag}{OURS.zonePreview}</span>}>
        <div class="linkrow">
          <Ref id={notesById.value.has(r.targetId) ? r.targetId : undefined} title={r.targetTitle} type={r.targetType} />
          <span class="rel t-data">— {rel} →</span>
          <LinkTarget target={m.link?.target ?? ""} chip />
        </div>
        <InlineMemory id={m.link?.target ?? ""} />
        <Edu>{t("longtermmemorydetail.underTheHoodRelatedMemories")}</Edu>
      </Zone>
    );
  }

  if (m.kind === "set_keywords") {
    const old = target?.keywords ?? [];
    const next = m.keywords ?? [];
    const kept = next.filter((k) => old.includes(k));
    const added = next.filter((k) => !old.includes(k));
    const removed = old.filter((k) => !next.includes(k));
    return (
      <Zone eyebrow={<span class="z-lab">{opTag}keywords · {OURS.zonePreview}</span>}
        foot={<span class={next.length >= KEYWORD_CAP ? "fl" : "dim"}>{next.length} of {KEYWORD_CAP} keywords</span>}>
        <div class="kwrap">
          {kept.map((k) => <span key={k} class="kwc t-data">{k}</span>)}
          {added.map((k) => <span key={k} class="kwc kw-add t-data">+ {k}</span>)}
          {removed.map((k) => <span key={k} class="kwc kw-del t-data">− {k}</span>)}
        </div>
        <Edu>{t("longtermmemorydetail.underTheHoodKeywords")}</Edu>
      </Zone>
    );
  }

  if (m.kind === "set_status") {
    const from = target?.status ?? "?";
    const to = String(m.status ?? "");
    return (
      <Zone eyebrow={<span class="z-lab">{opTag}{OURS.zonePreview}</span>}>
        <div class="linkrow">
          <span class="stt t-data">{from}</span>
          <IconArrowRight class="dim-i" size={13} stroke={1.75} aria-hidden />
          <span class={`stt t-data st-${to}`}>{to}</span>
        </div>
        <InlineMemory id={r.targetId} />
        <Edu>{t("memoryvault.statusHelp")}</Edu>
      </Zone>
    );
  }

  // set_subjects and anything the ops above did not claim: honest before/after.
  return (
    <Zone eyebrow={<span class="z-lab">{opTag}{OURS.zonePreview}</span>}>
      {r.changes.map((c, i) => (
        <div key={i}>
          {c.before && <Line mode="del">{c.before}</Line>}
          <Line mode="add">{c.after}</Line>
        </div>
      ))}
    </Zone>
  );
}

/** Diff rendering with context folding: unchanged runs collapse to a fold,
 *  one context line stays visible on each side of a change. */
function DiffLines({ before, after }: { before: string; after: string }) {
  const ops = lineDiff(splitLines(before), splitLines(after));
  const out: ComponentChildren[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].t === "ctx") {
      let j = i;
      while (j < ops.length && ops[j].t === "ctx") j++;
      const run = ops.slice(i, j);
      const keepStart = i > 0 ? 1 : 0; // context below a change
      const keepEnd = j < ops.length ? 1 : 0; // context above a change
      const folded = run.slice(keepStart, run.length - keepEnd);
      run.slice(0, keepStart).forEach((op, k) => out.push(<Line key={`c${i}-${k}`}>{op.text}</Line>));
      if (folded.length > 1) {
        out.push(
          <Fold key={`f${i}`} label={`${folded.length} unchanged lines`}>
            {folded.map((op, k) => <Line key={k}>{op.text}</Line>)}
          </Fold>,
        );
      } else {
        folded.forEach((op, k) => out.push(<Line key={`m${i}-${k}`}>{op.text}</Line>));
      }
      run.slice(run.length - keepEnd).forEach((op, k) => out.push(<Line key={`e${i}-${k}`}>{op.text}</Line>));
      i = j;
      continue;
    }
    // a del immediately paired with an add gets word-level emphasis
    if (ops[i].t === "del" && ops[i + 1]?.t === "add") {
      const w = wordEmphasis(ops[i].text, ops[i + 1].text);
      if (w) {
        out.push(
          <Line key={`d${i}`} mode="del">{w.pre}<mark class="wd">{w.delMid}</mark>{w.post}</Line>,
          <Line key={`a${i}`} mode="add">{w.pre}<mark class="wa">{w.addMid}</mark>{w.post}</Line>,
        );
        i += 2;
        continue;
      }
    }
    out.push(<Line key={i} mode={ops[i].t as "add" | "del"}>{ops[i].text}</Line>);
    i++;
  }
  return <>{out}</>;
}

// ── zone 3: evidence ────────────────────────────────────────────────

function Evidence({ r, m }: { r: Row; m: Mutation }) {
  const srcNote = notesById.value.get(r.sourceNoteId);
  const snippet = srcNote
    ? Object.values(srcNote.sections ?? {}).map((s) => s.text ?? "").join(" ").trim().slice(0, 220)
    : "";
  const conf = Math.round(m.confidence * 100);
  const low = m.confidence < 0.93;
  const diags = flagsOf(r).filter((f) => f.label !== "low confidence");
  const partner = r.duplicateOf ? rows.value.find((x) => x.key === r.duplicateOf!.key) : null;

  return (
    <Zone cls="z-ev" eyebrow={<span class="z-lab">{OURS.zoneEvidence}</span>}>
      {snippet && <div class="evq-q t-prose">{snippet}{snippet.length === 220 ? "…" : ""}</div>}
      <div class="evq-a t-data">source: <Ref id={r.sourceNoteId} title={r.sourceTitle} type="source" /></div>

      <div class={`sig t-prose ${low ? "" : "sig-ok"}`} data-sev={low ? "warn" : undefined}>
        {low ? <IconFlag size={13} stroke={1.75} aria-hidden /> : <DecisionIcon d="keep" size={13} />}
        <span>extraction confidence {conf}%{low && <> — below the 93% threshold</>}</span>
      </div>
      {diags.map((f) => (
        <div key={f.label} class="sig t-prose" data-sev={f.severity}>
          <IconFlag size={13} stroke={1.75} aria-hidden />
          <span>{f.sentence}</span>
        </div>
      ))}

      {r.conflicts.map((c, i) => (
        <div key={i} class="ev-rel">
          <div class="z-eye t-label t-label-s">{c.field ?? "field"} · existing → proposed</div>
          <Line mode="del">{String(c.existing ?? "")}</Line>
          <Line mode="add">{String(c.proposed ?? "")}</Line>
        </div>
      ))}
      {r.restates && (
        <div class="ev-rel">
          <div class="z-eye t-label t-label-s">restates <NoteRef id={r.restates.noteId} label={notesById.value.get(r.restates.noteId)?.title ?? r.restates.noteId} /> · {r.restates.score.toFixed(2)}</div>
          <p class="t-prose dim ev-line">{r.restates.line}</p>
        </div>
      )}
      {partner && (
        <div class="ev-rel">
          <div class="z-eye t-label t-label-s">duplicate incoming → {partner.targetTitle} · {r.duplicateOf!.score.toFixed(2)}</div>
          <p class="t-prose dim ev-line">{partner.text}</p>
        </div>
      )}

      <div class="readline t-data">
        {OURS.zoneExtraction}:{" "}
        <Term tip={GLOSSARY[m.claimKind] ?? m.claimKind}>{m.claimKind}</Term> ·{" "}
        <Term tip={GLOSSARY[r.disposition] ?? r.disposition}>{OURS.disposition[r.disposition]}</Term> ·{" "}
        <Term tip={GLOSSARY[`${m.risk} risk`] ?? m.risk}>{m.risk} risk</Term>
      </div>
    </Zone>
  );
}
