// Read-only quick view of any note, openable from anywhere a note id appears.
// Note references render as <NoteRef/>; the peek is a stacked panel (mobile)
// / side overlay that never nests — opening a reference from inside a peek
// replaces the peek.

import { signal } from "@preact/signals";
import { fetchNote, type Note } from "./data";
import { toast } from "../../shell/toast";

export const peeked = signal<Note | null>(null);

export async function peekNote(id: string) {
  try {
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

export function NotePeek() {
  const n = peeked.value;
  if (!n) return null;
  return (
    <div class="peek-scrim" onClick={() => { peeked.value = null; }}>
      <aside class="peek" role="dialog" aria-label={n.title ?? n.id} onClick={(e) => e.stopPropagation()}>
        <header class="peek-head">
          <span class={`chip t-data type-${n.type}`}>{n.type.replaceAll("_", " ")}</span>
          <span class="peek-title t-prose">{n.title ?? n.id}</span>
          <button class="hit peek-x" aria-label="Close" onClick={() => { peeked.value = null; }}>×</button>
        </header>
        <div class="peek-meta t-data">
          {n.id} · {n.status}{n.modes?.length ? ` · ${n.modes.join(" · ")}` : ""}
        </div>
        {(n.keywords ?? []).length > 0 && (
          <div class="peek-kw">
            {n.keywords!.map((k) => <span key={k} class="chip t-data">{k}</span>)}
          </div>
        )}
        {(n.links ?? []).length > 0 && (
          <div class="peek-links t-data">
            {n.links.map((l, i) => (
              <div key={i}><span class="dim">{l.relation}</span> → <NoteRef id={l.target} /></div>
            ))}
          </div>
        )}
        {Object.entries(n.sections ?? {}).map(([key, s]) => (
          <section key={key} class="peek-section">
            <h4 class="t-label t-label-s">{key}</h4>
            <div class="t-prose peek-text">{s.text}</div>
          </section>
        ))}
      </aside>
    </div>
  );
}
