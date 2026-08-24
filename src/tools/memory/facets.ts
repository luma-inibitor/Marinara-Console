// Facets over review rows. Grouped by provenance — computed signals apart
// from model/engine values apart from the reviewer's own state — so a
// heuristic and a schema field never silently carry the same authority.
//
// Counts are computed with each facet's own filter excluded, so a count
// answers "what would I get if I toggled this".

import { type Row } from "./data";
import { t } from "../../copy";
import { decisions, edited } from "./store";
import { flagsOf } from "./flags";

interface FacetDef {
  id: string;
  label: string;
  source: "computed" | "model" | "yours";
  get: (r: Row) => string | string[] | null;
}

// The facet and the row chip read the same flags, so filtering by a flag
// always matches exactly the rows whose chip counted it.
function qualityFlags(r: Row): string[] | null {
  const f = flagsOf(r).map((x) => x.label);
  return f.length ? f : null;
}

export const FACETS: FacetDef[] = [
  { id: "flags", label: "quality flags", source: "computed", get: qualityFlags },
  { id: "disposition", label: "disposition", source: "model", get: (r) => r.disposition },
  { id: "risk", label: "risk", source: "model", get: (r) => r.mutation.risk },
  { id: "kind", label: "change", source: "model", get: (r) => r.mutation.kind },
  { id: "claimKind", label: "claim", source: "model", get: (r) => r.mutation.claimKind },
  { id: "targetType", label: "memory type", source: "model", get: (r) => r.targetType },
  { id: "source", label: t("reviewqueue.sources"), source: "model", get: (r) => r.sourceTitle },
  {
    id: "status", label: "decision", source: "yours",
    get: (r) => {
      const s: string[] = [decisions.value.get(r.key) ?? t("memory.undecided")];
      if (edited.value.has(r.key)) s.push("edited");
      return s;
    },
  },
];

export function applyFilters(list: Row[], active: Map<string, Set<string>>): Row[] {
  const live = [...active.entries()].filter(([, set]) => set.size);
  if (!live.length) return list;
  const byId = new Map(FACETS.map((f) => [f.id, f]));
  return list.filter((row) =>
    live.every(([id, set]) => {
      let vs = byId.get(id)?.get(row);
      if (vs == null) return false;
      if (!Array.isArray(vs)) vs = [vs];
      return vs.some((v) => set.has(v));
    }),
  );
}

export function facetCounts(list: Row[], active: Map<string, Set<string>>): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const f of FACETS) {
    const others = new Map([...active.entries()].filter(([id]) => id !== f.id));
    const pool = applyFilters(list, others);
    const m = new Map<string, number>();
    counts.set(f.id, m);
    for (const row of pool) {
      let vs = f.get(row);
      if (vs == null) continue;
      if (!Array.isArray(vs)) vs = [vs];
      for (const v of vs) m.set(v, (m.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

interface Grouper { label: string; key: (r: Row) => { id: string; label: string; meta?: string } }

export const GROUPERS: Record<string, Grouper> = {
  target: { label: "target memory", key: (r) => ({ id: r.targetId, label: r.targetTitle, meta: r.targetType }) },
  source: { label: t("reviewqueue.sources"), key: (r) => ({ id: r.sourceNoteId, label: r.sourceTitle }) },
  disposition: { label: "disposition", key: (r) => ({ id: r.disposition, label: r.disposition }) },
  kind: { label: "change kind", key: (r) => ({ id: r.mutation.kind, label: r.mutation.kind.replaceAll("_", " ") }) },
  none: { label: "nothing", key: () => ({ id: "all", label: "all proposals" }) },
};

const riskRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const SORTERS: Record<string, { label: string; cmp: (a: Row, b: Row) => number }> = {
  risk: { label: "risk", cmp: (a, b) => (riskRank[a.mutation.risk] ?? 9) - (riskRank[b.mutation.risk] ?? 9) },
  confidence: { label: "confidence", cmp: (a, b) => a.mutation.confidence - b.mutation.confidence },
  target: { label: "target memory", cmp: (a, b) => a.targetTitle.localeCompare(b.targetTitle) },
};

export interface Group { id: string; label: string; meta?: string; rows: Row[] }

export function buildGroups(list: Row[], grouperId: string, sorterId: string, dir: 1 | -1 = 1): Group[] {
  const base = SORTERS[sorterId]?.cmp ?? SORTERS.risk.cmp;
  const sorted = [...list].sort((a, b) => dir * base(a, b));
  const grouper = GROUPERS[grouperId] ?? GROUPERS.target;
  const groups = new Map<string, Group>();
  for (const row of sorted) {
    const g = grouper.key(row);
    let bucket = groups.get(g.id);
    if (!bucket) groups.set(g.id, (bucket = { id: g.id, label: g.label, meta: g.meta, rows: [] }));
    bucket.rows.push(row);
  }
  return [...groups.values()];
}
