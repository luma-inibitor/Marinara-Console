// How a memory is named when it is not the thing on screen: in a claim
// headline, in a link row, in the retrieval block. Three rungs of one concept,
// each built on the one below it:
//
//   NoteRef      the tappable title alone — an id rendered as a way in
//   MemoryRef    that title with the type's own glyph in front of it
//   LinkTarget   a stored link's target id, resolved against the vault
//
// Resolution is the point. A stored link holds an id, and an id is the last
// resort rather than the first: a reader should see the memory's title and its
// type, and reach the id only when nothing else is known.

import type { ReactNode } from "react";
import { useStore } from "../../../lib/store";
import { toast } from "../../../shell/toast";
import { notesById, openPeek } from "../store/notes";
import { TypeIcon } from "../icons";
import { Term, TYPE_TIP } from "../glossary";
import "./NoteRef.css";

/** Open a memory in the peek, reporting a failed load where the reader asked
 *  rather than leaving the reference looking inert. */
export async function peekNote(id: string) {
  try {
    await openPeek(id);
  } catch (error) {
    toast(`${id}: ${(error as Error).message}`, { kind: "error" });
  }
}

/** A memory's title as a way into it. The click is stopped here because these
 *  sit inside rows that are themselves tap targets. */
export function NoteRef(props: { id: string; label?: string }) {
  return (
    <button className="notelink t-data" onClick={(e) => { e.stopPropagation(); peekNote(props.id); }}>
      {props.label ?? props.id}
    </button>
  );
}

/** A memory reference: the type's glyph in the type's hue, then the title.
 *
 *  Without `id` the title is not reachable — a memory that will exist only
 *  after this batch applies — so it renders as text rather than as a link,
 *  because accent means you can act on it.
 *
 *  `educate` gives the glyph its glossary definition; a surface that already
 *  teaches the type elsewhere on screen leaves it off. `className` replaces the
 *  default box for a host that owns the reference's layout — the retrieval
 *  card's row truncates its title, which `.nref` does not. */
export function MemoryRef(props: {
  id?: string;
  title?: string;
  type?: string;
  educate?: boolean;
  className?: string;
}) {
  const icon = props.type && <TypeIcon type={props.type} size={14} />;
  return (
    <span className={props.className ?? "nref"}>
      {icon && (props.educate ? <Term tip={TYPE_TIP[props.type!] ?? props.type!}>{icon}</Term> : icon)}
      {props.id
        ? <NoteRef id={props.id} label={props.title} />
        : <b className="nref-plain">{props.title}</b>}
    </span>
  );
}

/** A stored link's target, resolved against the vault.
 *
 *  `unresolved` is what to draw when the vault has never heard of the id. It
 *  differs per surface because the surfaces know different things: the review
 *  queue can still find the target among the batch's own pending creates, and
 *  the detail card would rather show a hueless glyph than none. Left off, the
 *  target degrades to the bare id, still openable. */
export function LinkTarget(props: {
  id: string;
  educate?: boolean;
  className?: string;
  unresolved?: ReactNode;
}) {
  const note = useStore(notesById).get(props.id);
  if (!note) return <>{props.unresolved ?? <NoteRef id={props.id} />}</>;
  return (
    <MemoryRef
      id={props.id}
      title={note.title ?? props.id}
      type={note.type}
      educate={props.educate}
      className={props.className}
    />
  );
}
