// Facets over review rows. Grouped by provenance — computed signals apart
// from model/engine values apart from the reviewer's own state — so a
// heuristic and a schema field never silently carry the same authority.
//
// Counts are computed with each facet's own filter excluded, so a count
// answers "what would I get if I toggled this".

import type { Mutation } from "../api/types";
import type { Decision, Row } from "./review";
import { t } from "../../../copy";
import { flagsOf, type FlagContext } from "./flags";

/** The store values the facet rules need. Facets are evaluated during render,
 *  where a store read does not subscribe the caller, so the caller reads them
 *  with `useStore` and passes them down. */
interface FacetContext extends FlagContext {
  decisions: Map<string, Decision>;
  edited: Map<string, Mutation>;
}

interface FacetDef {
  id: string;
  label: string;
  source: "computed" | "model" | "yours";
  get: (r: Row, ctx: FacetContext) => string | string[] | null;
  /** Sibling facets whose filters are also dropped when counting this one.
   *  A facet's count normally excludes only its own filter; two facets that
   *  narrow the same underlying set have to exclude each other too, or the
   *  broader one reports a number already narrowed by the finer one. */
  countsIgnore?: string[];
  /** Values that exist whether or not any row currently has one. Only for
   *  facets with a closed vocabulary the reviewer should see in full — a
   *  decision axis that lists nothing but "undecided" reads as though keep
   *  and drop were not options. Open-ended facets (flags, sources) leave this
   *  unset and take their vocabulary from the rows. */
  domain?: string[];
}

/** The value `anyFlag` takes when a row has flags. The facet is a yes/no, but
 *  it rides the same Map<facetId, Set<value>> as every other filter, so the
 *  "yes" needs a value to be a member of. */
export const ANY_FLAG = "any";

// The facet and the row chip read the same flags, so filtering by a flag
// always matches exactly the rows whose chip counted it.
function qualityFlags(r: Row, ctx: FacetContext): string[] | null {
  const f = flagsOf(r, ctx).map((x) => x.label);
  return f.length ? f : null;
}

export const FACETS: FacetDef[] = [
  { id: "flags", label: "quality flags", source: "computed", get: qualityFlags, countsIgnore: ["anyFlag"] },
  // "Any flag at all" is its own filter rather than every flag selected: the
  // set of flags grows, and a saved "all of them" would silently stop meaning
  // all of them. Selecting named flags and asking for any are mutually
  // exclusive — the sheet enforces that, so both are never live at once.
  {
    id: "anyFlag", label: t("memory.review.anyFlag"), source: "computed",
    countsIgnore: ["flags"],
    get: (r, ctx) => (qualityFlags(r, ctx) ? ANY_FLAG : null),
  },
  { id: "disposition", label: "disposition", source: "model", get: (r) => r.disposition },
  { id: "risk", label: "risk", source: "model", get: (r) => r.mutation.risk, domain: ["high", "medium", "low"] },
  { id: "kind", label: "change", source: "model", get: (r) => r.mutation.kind },
  { id: "claimKind", label: "claim", source: "model", get: (r) => r.mutation.claimKind },
  { id: "targetType", label: "memory type", source: "model", get: (r) => r.targetType },
  { id: "source", label: t("reviewqueue.sources"), source: "model", get: (r) => r.sourceTitle },
  {
    id: "status", label: "decision", source: "yours",
    // Keep and drop are the point of the screen. They must be listed from the
    // start, at zero, or the axis claims the only thing a claim can be is
    // undecided.
    domain: ["keep", "drop", t("memory.undecided")],
    get: (r, ctx) => {
      const s: string[] = [ctx.decisions.get(r.key) ?? t("memory.undecided")];
      if (ctx.edited.has(r.key)) s.push("edited");
      return s;
    },
  },
];

export function applyFilters(list: Row[], active: Map<string, Set<string>>, ctx: FacetContext): Row[] {
  const live = [...active.entries()].filter(([, set]) => set.size);
  if (!live.length) return list;
  const byId = new Map(FACETS.map((f) => [f.id, f]));
  return list.filter((row) =>
    live.every(([id, set]) => {
      let vs = byId.get(id)?.get(row, ctx);
      if (vs == null) return false;
      if (!Array.isArray(vs)) vs = [vs];
      return vs.some((v) => set.has(v));
    }),
  );
}

export function facetCounts(list: Row[], active: Map<string, Set<string>>, ctx: FacetContext): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const f of FACETS) {
    const skip = new Set([f.id, ...(f.countsIgnore ?? [])]);
    const others = new Map([...active.entries()].filter(([id]) => !skip.has(id)));
    const pool = applyFilters(list, others, ctx);
    const m = new Map<string, number>();
    counts.set(f.id, m);
    // Seed the whole vocabulary at zero before counting. A value the current
    // slice happens not to contain is still one of the choices this facet
    // offers, and dropping it makes the axis look smaller than it is — the
    // risk facet listed no "high" at all on a batch that had none, which
    // reads as "high risk is not a thing here" rather than "none of these".
    // The vocabulary is the declared domain, or every value the UNFILTERED
    // rows produce; never the pool, which is what is being narrowed.
    for (const v of f.domain ?? []) m.set(v, 0);
    for (const row of list) {
      let vs = f.get(row, ctx);
      if (vs == null) continue;
      if (!Array.isArray(vs)) vs = [vs];
      for (const v of vs) if (!m.has(v)) m.set(v, 0);
    }
    for (const row of pool) {
      let vs = f.get(row, ctx);
      if (vs == null) continue;
      if (!Array.isArray(vs)) vs = [vs];
      for (const v of vs) m.set(v, (m.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

/** The glyph a group header shows: a glyph table and a key into it. This layer
 *  names an icon rather than drawing one. */
export interface GroupIconRef { family: "type" | "sourceKind" | "op"; value: string }

interface Grouper { label: string; key: (r: Row) => { id: string; label: string; icon?: GroupIconRef } }

export const GROUPERS: Record<string, Grouper> = {
  target: { label: "target memory", key: (r) => ({ id: r.targetId, label: r.targetTitle, icon: { family: "type", value: r.targetType } }) },
  source: {
    label: t("reviewqueue.sources"),
    key: (r) => ({
      id: r.sourceNoteId, label: r.sourceTitle,
      icon: r.sourceKind ? { family: "sourceKind", value: r.sourceKind } : undefined,
    }),
  },
  // No glyph: the console draws none for new, merge or rewrite anywhere.
  disposition: { label: "disposition", key: (r) => ({ id: r.disposition, label: r.disposition }) },
  kind: { label: "change kind", key: (r) => ({ id: r.mutation.kind, label: r.mutation.kind.replaceAll("_", " "), icon: { family: "op", value: r.mutation.kind } }) },
  none: { label: "nothing", key: () => ({ id: "all", label: "all proposals" }) },
};

const riskRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const SORTERS: Record<string, { label: string; cmp: (a: Row, b: Row) => number }> = {
  risk: { label: "risk", cmp: (a, b) => (riskRank[a.mutation.risk] ?? 9) - (riskRank[b.mutation.risk] ?? 9) },
  confidence: { label: "confidence", cmp: (a, b) => a.mutation.confidence - b.mutation.confidence },
  target: { label: "target memory", cmp: (a, b) => a.targetTitle.localeCompare(b.targetTitle) },
};

export interface Group { id: string; label: string; icon?: GroupIconRef; rows: Row[] }

export function buildGroups(list: Row[], grouperId: string, sorterId: string, dir: 1 | -1 = 1): Group[] {
  const base = SORTERS[sorterId]?.cmp ?? SORTERS.risk.cmp;
  const sorted = [...list].sort((a, b) => dir * base(a, b));
  const grouper = GROUPERS[grouperId] ?? GROUPERS.target;
  const groups = new Map<string, Group>();
  for (const row of sorted) {
    const g = grouper.key(row);
    let bucket = groups.get(g.id);
    if (!bucket) groups.set(g.id, (bucket = { id: g.id, label: g.label, icon: g.icon, rows: [] }));
    bucket.rows.push(row);
  }
  return [...groups.values()];
}
