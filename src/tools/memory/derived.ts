// Derived signals — computed by the console, not present in any payload.
// (ltm-review design-directions §1: derived signals are what make a thousand
// claims tractable.)
//
// Both use 4-word shingles and Jaccard similarity:
// - restates the vault: a proposal against every stored section line, ≥ 0.45.
// - duplicate incoming: proposals against each other across the batch, ≥ 0.7.
// Stored dedup fires on exact text only; these catch the same claim arriving
// under a different note id or in different words.
//
// A pass of this shape over 1,142 claims × 161 notes measured 133ms in the
// review study, so it runs synchronously after load.

import type { Note, Row } from "./data";

const RESTATES_THRESHOLD = 0.45;
export const DUPLICATE_THRESHOLD = 0.7;

/** One stored line as content: no bullet marker, no surrounding whitespace.
 *
 *  The trim has to come first. The strip is anchored with `^`, so on an
 *  indented sub-bullet the leading whitespace shields the marker from it and
 *  the marker survives into the text — which the detail card then renders
 *  behind a marker of its own.
 *
 *  Only one marker comes off. A line that deliberately begins `* ` after its
 *  bullet keeps that second character, which is a separate question from this
 *  one. */
export function normalizeLine(raw: string): string {
  return raw.trim().replace(/^[-•*]\s*/, "").trim();
}

export function shingles(text: string, size = 4): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  if (words.length < size) {
    if (words.length) out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i <= words.length - size; i++) out.add(words.slice(i, i + size).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const s of small) if (large.has(s)) hit += 1;
  return hit / (a.size + b.size - hit);
}

export interface VaultLine { noteId: string; sectionKey: string; line: string; sh: Set<string> }

/** Every stored section line in the vault, pre-shingled. Source notes are
 *  audit records, not memories, and are excluded. */
export function vaultLines(notes: Note[]): VaultLine[] {
  const lines: VaultLine[] = [];
  for (const note of notes) {
    if (note.type === "source") continue;
    for (const [key, section] of Object.entries(note.sections ?? {})) {
      for (const raw of (section.text ?? "").split(/\n+/)) {
        const line = normalizeLine(raw);
        if (line.length < 12) continue;
        lines.push({ noteId: note.id, sectionKey: key, line, sh: shingles(line) });
      }
    }
  }
  return lines;
}

/** Annotates rows in place: row.restates and row.duplicateOf. */
export function computeDerived(rows: Row[], lines: VaultLine[]): void {
  for (const row of rows) row.sh = shingles(row.text);

  for (const row of rows) {
    let best: Row["restates"] = null;
    for (const stored of lines) {
      const score = jaccard(row.sh!, stored.sh);
      if (score >= RESTATES_THRESHOLD && (!best || score > best.score)) {
        best = { score, line: stored.line, noteId: stored.noteId };
      }
    }
    row.restates = best;
  }

  for (const row of rows) row.duplicateOf = null;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const score = jaccard(rows[i].sh!, rows[j].sh!);
      if (score >= DUPLICATE_THRESHOLD) {
        rows[i].duplicateOf ??= { key: rows[j].key, score };
        rows[j].duplicateOf ??= { key: rows[i].key, score };
      }
    }
  }
}

/** Collapse near-identical lines inside one section's text, keeping the
 *  longest of each cluster — the vault only ever drops byte-identical lines.
 *  Returns null when nothing was collapsed. */
export function dedupeLines(text: string): { text: string; dropped: number } | null {
  const raw = text.split("\n");
  const keep: string[] = [];
  const sh: Array<Set<string> | null> = [];
  let dropped = 0;
  for (const line of raw) {
    const body = normalizeLine(line);
    if (body.length < 25) { keep.push(line); sh.push(null); continue; }
    const g = shingles(body);
    let hit = -1;
    for (let j = 0; j < sh.length; j++) {
      if (sh[j] && jaccard(g, sh[j]!) >= DUPLICATE_THRESHOLD) { hit = j; break; }
    }
    if (hit < 0) { keep.push(line); sh.push(g); continue; }
    dropped += 1;
    const kept = normalizeLine(keep[hit]);
    if (body.length > kept.length) { keep[hit] = line; sh[hit] = g; }
  }
  if (!dropped) return null;
  return { text: keep.join("\n").replace(/\n{3,}/g, "\n\n").trim(), dropped };
}
