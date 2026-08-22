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
import { openOverlay, closeTopOverlay } from "./overlays";
import { notesById } from "./store";
import { TypeIcon } from "./icons";
import { Term, TYPE_TIP } from "./glossary";

export const peeked = signal<Note | null>(null);

export async function peekNote(id: string) {
  try {
    const note = await fetchNote(id);
    const wasOpen = peeked.value !== null;
    peeked.value = note;
    // A chained peek replaces content inside the same overlay entry; only a
    // fresh open pushes history.
    if (!wasOpen) openOverlay(() => { peeked.value = null; });
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

/** The three chat modes as a fixed-width pill: every segment always renders,
 *  active ones lit — constant width keeps rows skimmable (owner-approved). */
const MODES: Array<{ id: string; label: string; title: string }> = [
  { id: "conversation", label: "DM", title: "conversation mode" },
  { id: "roleplay", label: "RP", title: "roleplay mode" },
  { id: "game", label: "GM", title: "game mode" },
];
export function ModePill(props: { modes: string[] }) {
  return (
    <span class="modepill" role="img" aria-label={`modes: ${props.modes.join(", ") || "none"}`}>
      {MODES.map((m) => (
        <span key={m.id} class={`mseg t-data ${props.modes.includes(m.id) ? "is-on" : ""}`} title={m.title}>
          {m.label}
        </span>
      ))}
    </span>
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
  const closeRef = useRef<HTMLButtonElement>(null);
  // Move focus into the dialog on open (restore is handled by the overlay stack).
  useEffect(() => { if (n) closeRef.current?.focus(); }, [n === null]);
  if (!n) return null;
  return (
    <div class="peek-scrim" onClick={closeTopOverlay}>
      <aside class="peek" role="dialog" aria-modal="true" aria-label={n.title ?? n.id} onClick={(e) => e.stopPropagation()}>
        <header class="peek-head sheet-head">
          <Term tip={TYPE_TIP[n.type] ?? n.type}><TypeIcon type={n.type} size={16} /></Term>
          <span class="peek-title t-prose">{n.title ?? n.id}</span>
          <button ref={closeRef} class="hit peek-x" aria-label="Close" onClick={closeTopOverlay}>×</button>
        </header>
        <div class="peek-meta t-data">
          <span class={`stt st-${n.status}`}>{n.status}</span>
          <ModePill modes={n.modes ?? []} />
        </div>
        {(n.keywords ?? []).length > 0 && (
          <div class="peek-kw">
            {n.keywords!.map((k) => <span key={k} class="chip t-data">{k}</span>)}
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
          <section key={key} class="peek-section">
            <h4 class="t-label t-label-s"><span class="skey">§{key}</span></h4>
            <div class="t-prose peek-text">{s.text}</div>
          </section>
        ))}
        <div class="peek-id t-data" data-contrast-exempt>{n.id}</div>
      </aside>
    </div>
  );
}
