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
// `Preview` is aliased: this file already has a local <Preview/> zone component.
import { ChevronRight, Preview as PreviewIcon, Flag, Edit, EditedMark, Forward, Remove, Add } from "../../ui/icons";
import { toast } from "../../shell/toast";
import { type Mutation, type Row, KEYWORD_CAP, SECTION_CAP } from "./data";
import { t, OURS } from "./strings";
import { decisions, edited, rows, notesById, pressure, setDecision, setEdited } from "./store";
import { NoteRef } from "./NotePeek";
import { OpIcon, TypeIcon, DecisionIcon } from "./icons";
import { Term, GLOSSARY, OP_TIP, TYPE_TIP } from "./glossary";
import { flagsOf } from "./flags";
import { lineDiff, splitLines, wordEmphasis } from "./diff";
import { Edu } from "../../ui";

// ── small pieces ────────────────────────────────────────────────────

/** A memory reference: type icon + tappable title. */
function Ref(props: { id?: string; title: string; type?: string }) {
  return (
    <span className="nref">
      {props.type && <Term tip={TYPE_TIP[props.type] ?? props.type}><TypeIcon type={props.type} size={14} /></Term>}
      {props.id ? <NoteRef id={props.id} label={props.title} /> : <b className="nref-plain">{props.title}</b>}
    </span>
  );
}

function Skey(props: { k: string }) {
  return <span className="skey">§{props.k}</span>;
}

function Fold(props: { label: string; children: ComponentChildren }) {
  return (
    <details className="fold">
      <summary className="t-data"><ChevronRight className="fold-c" size={12} stroke={1.75} aria-hidden /><span>{props.label}</span></summary>
      {props.children}
    </details>
  );
}

function Line(props: { mode?: "add" | "del"; children: ComponentChildren }) {
  const g = props.mode === "add" ? "+" : props.mode === "del" ? "−" : "";
  return (
    <div className={`ln ln-${props.mode ?? "ctx"}`}>
      <span className="lg" data-contrast-exempt>{g}</span>
      <span className="lt">{props.children}</span>
    </div>
  );
}

function Zone(props: { eyebrow: ComponentChildren; foot?: ComponentChildren; cls?: string; children: ComponentChildren }) {
  return (
    <div className={`zone ${props.cls ?? ""}`}>
      <div className="z-eye t-label t-label-s">{props.eyebrow}</div>
      {props.children}
      {props.foot && <div className="z-foot t-data">{props.foot}</div>}
    </div>
  );
}

/** Help text: the info glyph marks it as education, not content. */
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
    <div className="inline-card">
      {head.map((l, i) => <div key={i} className="lt-i t-prose">{l}</div>)}
      {rest.length > 0 && (
        <Fold label={`${rest.length} more line${rest.length === 1 ? "" : "s"} · ${rest.join(" ").length.toLocaleString()} ch`}>
          {rest.map((l, i) => <div key={i} className="lt-i t-prose">{l}</div>)}
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
    <span className={over ? "is-drop" : "fl"}>
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
  // Keywords are how recall finds a memory, so a claim that writes them has to
  // let you fix them before they land (owner, 2026-08-22).
  const storedKeywords = m.kind === "create_note" ? (m.note?.keywords ?? [])
    : m.kind === "set_keywords" ? (m.keywords ?? []) : null;
  const [kwDraft, setKwDraft] = useState<string[] | null>(null);
  const keywords = kwDraft ?? storedKeywords;

  const hasEditable = true;
  const editableSections: Array<{ id: string; label: string; text: string }> =
    m.kind === "create_note"
      ? Object.entries(m.note?.sections ?? {}).map(([key, s]) => ({ id: key, label: key, text: s.text ?? "" }))
      : (m.kind === "append_section" || m.kind === "update_section")
        ? [{ id: "__text", label: m.sectionKey ?? "text", text: m.text ?? m.section?.text ?? "" }]
        : [];

  const save = () => {
    const next = structuredClone(m) as Mutation;
    let changed = false;
    if (kwDraft && storedKeywords) {
      if (kwDraft.length > KEYWORD_CAP) {
        toast(t("memoryvault.manualKeywordLimit"), { kind: "error" });
        return;
      }
      if (next.kind === "create_note" && next.note) next.note.keywords = kwDraft;
      else next.keywords = kwDraft;
      changed ||= kwDraft.join("\u0000") !== storedKeywords.join("\u0000");
    }
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
    setKwDraft(null);
    setEditing(false);
    toast(changed ? "Edit staged — applies with the batch" : "No changes");
  };
  const discard = () => { setDrafts({}); setKwDraft(null); setEditing(false); };

  // Whole-memory toggle (owner feedback 2026-08-22): re-render the preview
  // with every section of the target present and the change marked in place,
  // instead of popping an overlay the reviewer has to bounce back from.
  const [whole, setWhole] = useState(false);
  const wholeBtn = target && (m.kind === "append_section" || m.kind === "update_section") && !editing && (
    <button className="zbtn hit" aria-pressed={whole} onClick={() => setWhole(!whole)}>
      <PreviewIcon size={12} stroke={1.75} aria-hidden /> whole memory
    </button>
  );
  const editBtn = (editableSections.length > 0 || storedKeywords) && hasEditable && !editing && (
    <button className="zbtn hit" onClick={() => setEditing(true)}>
      <Edit size={12} stroke={1.75} aria-hidden /> {t("longtermmemorydetail.reviewEdit").toLowerCase()}
    </button>
  );
  const staged = edited.value.has(r.key);
  const stagedMark = staged && !editing && (
    <span className="zbtn-group">
      <Term tip="edited — this claim's text was changed by you; the edit applies with the batch">
        <EditedMark className="edit-mark" size={13} stroke={1.75} aria-hidden />
      </Term>
      <button className="zbtn hit" onClick={() => { setEdited(r.key, null); setDrafts({}); }}>
        {t("memorysettings.discardChanges").toLowerCase()}
      </button>
    </span>
  );

  return (
    <div className="claim-detail">
      <Headline r={r} m={m} target={Boolean(target)} />
      <Preview r={r} m={m} editing={editing} drafts={drafts} setDrafts={setDrafts}
        editableSections={editableSections} whole={whole} keywords={keywords} setKeywords={setKwDraft}
        controls={<>{wholeBtn}{editBtn}{stagedMark}</>} />
      <Evidence r={r} m={m} />
      <div className="decbar">
        {editing ? (
          <>
            <button className="dbtn2 save-on hit" onClick={save}>{t("memoryvault.save").toLowerCase()}</button>
            <button className="dbtn2 hit" onClick={discard}>{t("memorysettings.discardChanges").toLowerCase()}</button>
            <span className="decbar-note t-data" data-contrast-exempt>applies with the batch</span>
          </>
        ) : (
          <>
            <button className="dbtn2 hit" data-on={d === "keep"} data-dk="keep"
              onClick={() => setDecision(r, d === "keep" ? null : "keep")}>
              <DecisionIcon d="keep" size={15} /> {OURS.keep}
            </button>
            <button className="dbtn2 hit" data-on={d === "drop"} data-dk="drop"
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
  return <div className="hl t-prose">{body}</div>;
}

/** Resolve a link target against the vault, then against this batch. The
 *  pending-in-batch chip renders only where asked — the preview states it;
 *  the headline stays short. */
function LinkTarget({ target, chip }: { target: string; chip?: boolean }) {
  const note = notesById.value.get(target);
  if (note) return <Ref id={target} title={note.title ?? target} type={note.type} />;
  const pending = rows.value.find((x) => x.targetId === target && x.mutation.kind === "create_note");
  if (pending) {
    return <span className="nref"><Ref title={pending.targetTitle} type={pending.targetType} />{chip && <span className="chip-batch t-data">pending in this batch</span>}</span>;
  }
  return <span className="dim t-data">{target}</span>;
}

// ── zone 2: preview ─────────────────────────────────────────────────

function Preview(props: {
  r: Row; m: Mutation; editing: boolean; whole?: boolean;
  keywords: string[] | null; setKeywords: (v: string[]) => void;
  drafts: Record<string, string>; setDrafts: (f: (p: Record<string, string>) => Record<string, string>) => void;
  editableSections: Array<{ id: string; label: string; text: string }>;
  controls: ComponentChildren;
}) {
  const { r, m, editing, whole } = props;
  const target = notesById.value.get(r.targetId);
  // The op icon lives on the preview zone (not the headline — a sentence
  // starting with an icon read wrong), keeping its education tooltip in the pane.
  const opTag = <Term tip={OP_TIP[m.kind]}><span className="z-opi"><OpIcon kind={m.kind} size={13} /></span></Term>;

  const area = (id: string, text: string) => (
    <textarea className="edit-area t-prose" rows={Math.min(10, Math.max(3, Math.ceil(text.length / 60)))}
      value={props.drafts[id] ?? text}
      onInput={(e) => { const v = e.currentTarget.value; props.setDrafts((p) => ({ ...p, [id]: v })); }} />
  );

  // Whole-memory mode: every section of the target, in stored order, with the
  // affected one swapped for its marked rendering. Context lines stay dim.
  const wholeSections = (affectedKey: string, affected: ComponentChildren) => (
    <>
      {Object.entries(target?.sections ?? {}).map(([key, sec]) => (
        <div key={key} className="nc-sec">
          <div className="z-eye t-label t-label-s"><Skey k={key} /></div>
          {key === affectedKey ? affected : splitLines(sec.text).map((l, i) => <Line key={i}>{l}</Line>)}
        </div>
      ))}
    </>
  );

  if (m.kind === "append_section") {
    const key = m.sectionKey ?? "";
    const stored = target?.sections?.[key]?.text ?? "";
    const storedLines = splitLines(stored);
    const adds = splitLines(m.text);
    const head = storedLines.slice(0, Math.max(0, storedLines.length - STORED_CONTEXT));
    const tail = storedLines.slice(Math.max(0, storedLines.length - STORED_CONTEXT));
    const addCh = (m.text ?? "").length;
    const addLines = editing ? area("__text", m.text ?? "") : adds.map((l, i) => <Line key={i} mode="add">{l}</Line>);
    return (
      <Zone cls={editing ? "is-editing" : ""} eyebrow={<><span className="z-lab">{opTag}<Skey k={key} /> · {editing ? "editing proposed content" : OURS.zonePreview}</span>{props.controls}</>}
        foot={<><span className="dim">+{addCh.toLocaleString()} · {(stored.length + addCh).toLocaleString()} ch</span>{capNote(r.targetId, key)}</>}>
        {whole ? (
          wholeSections(key, <>{storedLines.map((l, i) => <Line key={i}>{l}</Line>)}{addLines}</>)
        ) : (
          <>
            {head.length > 0 && (
              <Fold label={`${head.length} earlier line${head.length === 1 ? "" : "s"} · ${head.join(" ").length.toLocaleString()} ch`}>
                {head.map((l, i) => <Line key={i}>{l}</Line>)}
              </Fold>
            )}
            {tail.map((l, i) => <Line key={i}>{l}</Line>)}
            {addLines}
          </>
        )}
      </Zone>
    );
  }

  if (m.kind === "update_section") {
    const key = m.sectionKey ?? "";
    const change = r.changes.find((c) => c.kind === "section");
    const before = change?.before ?? target?.sections?.[key]?.text ?? "";
    const after = change?.after ?? m.section?.text ?? m.text ?? "";
    return (
      <Zone cls={editing ? "is-editing" : ""} eyebrow={<><span className="z-lab">{opTag}<Skey k={key} /> · {editing ? "editing proposed content" : OURS.zoneDiff}</span>{props.controls}</>}
        foot={<><span className="dim">{after.length >= before.length ? "+" : "−"}{Math.abs(after.length - before.length).toLocaleString()} · {after.length.toLocaleString()} ch</span>{capNote(r.targetId, key)}</>}>
        {editing
          ? <>{splitLines(before).map((l, i) => <Line key={i} mode="del">{l}</Line>)}{area("__text", after)}</>
          : whole
            ? wholeSections(key, <DiffLines before={before} after={after} fold={false} />)
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
        eyebrow={<><span className="z-lab">{opTag}{OURS.zoneNewMemory} · {editing ? "editing proposed content" : OURS.zonePreview}</span>{props.controls}</>}
        foot={<span className="dim">+{totalCh.toLocaleString()} ch · {OURS.zoneNewMemory}</span>}>
        {secs.map(([key, s]) => {
          const lines = splitLines(s.text);
          const headLines = lines.slice(0, 3);
          const rest = lines.slice(3);
          return (
            <div key={key} className="nc-sec">
              <div className="z-eye t-label t-label-s"><Skey k={key} /></div>
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
        {(kws.length > 0 || editing) && (
          <KeywordEditor list={props.keywords ?? kws} editing={editing} onChange={props.setKeywords} allNew />
        )}
      </Zone>
    );
  }

  if (m.kind === "add_link") {
    const rel = (m.link?.relation ?? "").replaceAll("_", " ");
    return (
      <Zone eyebrow={<span className="z-lab">{opTag}{OURS.zonePreview}</span>}>
        <div className="linkrow">
          <Ref id={notesById.value.has(r.targetId) ? r.targetId : undefined} title={r.targetTitle} type={r.targetType} />
          <span className="rel t-data">— {rel} →</span>
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
      <Zone eyebrow={<span className="z-lab">{opTag}keywords · {OURS.zonePreview}</span>}
        foot={<span className={next.length >= KEYWORD_CAP ? "fl" : "dim"}>{next.length} of {KEYWORD_CAP} keywords</span>}>
        {editing
          ? <KeywordEditor list={props.keywords ?? next} editing onChange={props.setKeywords} />
          : (
            <div className="kwrap">
              {kept.map((k) => <span key={k} className="kwc t-data">{k}</span>)}
              {added.map((k) => <span key={k} className="kwc kw-add t-data">+ {k}</span>)}
              {removed.map((k) => <span key={k} className="kwc kw-del t-data">− {k}</span>)}
            </div>
          )}
        <Edu>{t("longtermmemorydetail.underTheHoodKeywords")}</Edu>
      </Zone>
    );
  }

  if (m.kind === "set_status") {
    const from = target?.status ?? "?";
    const to = String(m.status ?? "");
    return (
      <Zone eyebrow={<span className="z-lab">{opTag}{OURS.zonePreview}</span>}>
        <div className="linkrow">
          <span className="stt t-data">{from}</span>
          <Forward className="dim-i" size={13} stroke={1.75} aria-hidden />
          <span className={`stt t-data st-${to}`}>{to}</span>
        </div>
        <InlineMemory id={r.targetId} />
        <Edu>{t("memoryvault.statusHelp")}</Edu>
      </Zone>
    );
  }

  // set_subjects and anything the ops above did not claim: honest before/after.
  return (
    <Zone eyebrow={<span className="z-lab">{opTag}{OURS.zonePreview}</span>}>
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
function DiffLines({ before, after, fold = true }: { before: string; after: string; fold?: boolean }) {
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
      if (fold && folded.length > 1) {
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
          <Line key={`d${i}`} mode="del">{w.pre}<mark className="wd">{w.delMid}</mark>{w.post}</Line>,
          <Line key={`a${i}`} mode="add">{w.pre}<mark className="wa">{w.addMid}</mark>{w.post}</Line>,
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
    <Zone cls="z-ev" eyebrow={<span className="z-lab">{OURS.zoneEvidence}</span>}>
      {snippet && <div className="evq-q t-prose">{snippet}{snippet.length === 220 ? "…" : ""}</div>}
      <div className="evq-a t-data">source: <Ref id={r.sourceNoteId} title={r.sourceTitle} type="source" /></div>

      <div className={`sig t-prose ${low ? "" : "sig-ok"}`} data-sev={low ? "warn" : undefined}>
        {/* Only the low branch gets a glyph. A flag marks an exception; the else
            branch marks the *absence* of one, which by this codebase's own
            precedent carries no mark — cf. Sources.tsx StateMark: "New carries
            no mark — it is the majority state, and marking it would put a
            symbol on nearly every row while the exceptions fought for
            attention." (The circle family is reserved for decision states
            anyway; confidence is not a decision.) */}
        {low && <Flag size={13} stroke={1.75} aria-hidden />}
        <span>extraction confidence {conf}%{low && <> — below the 93% threshold</>}</span>
      </div>
      {diags.map((f) => (
        <div key={f.label} className="sig t-prose" data-sev={f.severity}>
          <Flag size={13} stroke={1.75} aria-hidden />
          <span>{f.sentence}</span>
        </div>
      ))}

      {r.conflicts.map((c, i) => (
        <div key={i} className="ev-rel">
          <div className="z-eye t-label t-label-s">{c.field ?? "field"} · existing → proposed</div>
          <Line mode="del">{String(c.existing ?? "")}</Line>
          <Line mode="add">{String(c.proposed ?? "")}</Line>
        </div>
      ))}
      {r.restates && (
        <div className="ev-rel">
          <div className="z-eye t-label t-label-s">restates <NoteRef id={r.restates.noteId} label={notesById.value.get(r.restates.noteId)?.title ?? r.restates.noteId} /> · {r.restates.score.toFixed(2)}</div>
          <div className="evq-q t-prose">{r.restates.line}</div>
        </div>
      )}
      {partner && (
        <div className="ev-rel">
          <div className="z-eye t-label t-label-s">duplicate incoming → {partner.targetTitle} · {r.duplicateOf!.score.toFixed(2)}</div>
          <div className="evq-q t-prose">{partner.text}</div>
        </div>
      )}

      <div className="readline t-data">
        {OURS.zoneExtraction}:{" "}
        <Term tip={GLOSSARY[m.claimKind] ?? m.claimKind}>{m.claimKind}</Term> ·{" "}
        <Term tip={GLOSSARY[r.disposition] ?? r.disposition}>{OURS.disposition[r.disposition]}</Term> ·{" "}
        <Term tip={GLOSSARY[`${m.risk} risk`] ?? m.risk}>{m.risk} risk</Term>
      </div>
    </Zone>
  );
}

/** Keywords are how recall finds a memory, so a claim that writes them has to
 *  be correctable before it lands. Reading shows the list; editing turns each
 *  into a removable chip and adds a field. The cap and the length rule are the
 *  product's own (30 keywords, 80 characters each). */
function KeywordEditor({ list, editing, onChange, allNew }: {
  list: string[]; editing: boolean; onChange: (v: string[]) => void; allNew?: boolean;
}) {
  const [entry, setEntry] = useState("");
  const add = () => {
    const v = entry.trim();
    if (!v) return;
    if (v.length > 80) { toast(t("memoryvault.manualKeywordTooLong"), { kind: "error" }); return; }
    if (list.includes(v)) { setEntry(""); return; }
    if (list.length >= KEYWORD_CAP) { toast(t("memoryvault.manualKeywordLimit"), { kind: "error" }); return; }
    onChange([...list, v]);
    setEntry("");
  };
  if (!editing) {
    return <div className="kwrap">{list.map((k) => <span key={k} className={`kwc t-data ${allNew ? "kw-add" : ""}`}>{allNew ? `+ ${k}` : k}</span>)}</div>;
  }
  return (
    <div className="kwedit">
      <div className="z-eye t-label t-label-s">
        <span className="z-lab">{t("memoryvault.keywords")}</span>
        <span className={`zcount t-data ${list.length >= KEYWORD_CAP ? "fl" : ""}`}>{list.length} / {KEYWORD_CAP}</span>
      </div>
      <div className="kwrap">
        {list.map((k) => (
          <span key={k} className="kwc kw-edit t-data">
            {k}
            <button className="kwx hit" aria-label={`Remove keyword ${k}`}
              onClick={() => onChange(list.filter((x) => x !== k))}>
              <Remove size={11} stroke={2} aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <div className="kwadd">
        <input className="t-data" value={entry} placeholder={t("memoryvault.addKeyword")}
          aria-label={t("memoryvault.addKeyword")}
          onInput={(e) => setEntry(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="zbtn hit" onClick={add} disabled={!entry.trim()}>
          <Add size={12} stroke={2} aria-hidden /> {t("memoryvault.addKeyword").toLowerCase()}
        </button>
      </div>
    </div>
  );
}
