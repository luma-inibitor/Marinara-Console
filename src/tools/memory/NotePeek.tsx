// Read-only quick view of any memory, openable from anywhere a reference
// appears. References render as <NoteRef/>; the peek is a stacked panel
// (mobile) / side overlay that never nests — opening a reference from inside
// a peek replaces the peek. v2 (2026-08-22, detail-surfaces wave): the peek
// speaks the list's vocabulary — type icon + categorical hue, resolved link
// targets instead of raw ids, §key section typography, the three-segment
// mode pill (its first home), and the raw id demoted to a quiet footer.

import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { fetchNote, type Note } from "./data";
import { toast } from "../../shell/toast";
import { openOverlay, closeTopOverlay } from "../../shell/overlays";
import { notesById } from "./store";
import { TypeIcon } from "./icons";
import { Term, TYPE_TIP } from "./glossary";
import { CopyableText, DetailSection, ModePill, RawJson, Sheet, SheetHead, Tag } from "../../ui";

export const peeked = signal<Note | null>(null);

export async function peekNote(id: string) {
  try {
    // A chained peek replaces content inside the same <Sheet>, which stays
    // mounted, so it does not push a second history entry — one back closes
    // the peek however deep you followed the links.
    peeked.value = await fetchNote(id);
  } catch (error) {
    toast(`${id}: ${(error as Error).message}`, { kind: "error" });
  }
}

export function NoteRef(props: { id: string; label?: string }) {
  return (
    <button class="notelink t-data" onClick={(e) => { e.stopPropagation(); peekNote(props.id); }}>
      {props.label ?? props.id}
    </button>
  );
}


/** Resolve a link target to a titled, typed reference; raw id as last resort. */
function PeekLinkTarget({ id }: { id: string }) {
  const note = notesById.value.get(id);
  if (note) {
    return (
      <span class="nref">
        <TypeIcon type={note.type} size={14} />
        <NoteRef id={id} label={note.title ?? id} />
      </span>
    );
  }
  return <NoteRef id={id} />;
}

export function NotePeek() {
  const n = peeked.value;
  if (!n) return null;
  return (
    <Sheet label={n.title ?? n.id} onClose={() => { peeked.value = null; }}>
      <SheetHead
        autoFocus
        icon={<Term tip={TYPE_TIP[n.type] ?? n.type}><TypeIcon type={n.type} size={16} /></Term>}
        title={n.title ?? n.id}
      />
        <div class="peek-meta t-data">
          <span class={`stt st-${n.status}`}>{n.status}</span>
          <ModePill modes={n.modes ?? []} />
        </div>
        {(n.keywords ?? []).length > 0 && (
          <div class="peek-kw">
            {n.keywords!.map((k) => <Tag key={k}>{k}</Tag>)}
          </div>
        )}
        {(n.links ?? []).length > 0 && (
          <div class="peek-links t-data">
            {n.links.map((l, i) => (
              <div key={i} class="linkrow">
                <span class="rel">{l.relation.replaceAll("_", " ")} →</span>
                <PeekLinkTarget id={l.target} />
              </div>
            ))}
          </div>
        )}
        {Object.entries(n.sections ?? {}).map(([key, s]) => (
          <DetailSection key={key} sectionKey={key}>
            <div class="t-prose peek-text">{s.text}</div>
          </DetailSection>
        ))}
      <div class="peek-id t-data">
        <CopyableText value={n.id} label="the memory id" />
      </div>
      <RawJson value={n} label="Raw memory" />
    </Sheet>
  );
}
