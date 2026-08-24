// The education pattern (owner-approved 2026-08-21): every enum value and
// icon the UI renders can answer "what does this word mean" in place. One
// definition source; each definition leads with the field the value belongs
// to ("claim kind · static — …") so a bare word is never floating free.
//
// Desktop: hover or focus shows the definition. Touch: tap toggles it (a
// tooltip is never hover-only). The decision toggle carries NO tooltip — a
// help affordance on an interactive control is a contradiction (owner
// feedback); its teaching lives in a first-use hint instead.
//
// The definitions themselves live in src/copy/memory.json, keyed by the schema
// value they define. This file is the mapping from value to key — the table
// shape the call sites index by a runtime value, with the prose lifted out.
// The `@copy-strict` marker is gone with the prose: there are no literals left
// here for it to catch.

import { tAny } from "../../copy";
import type { Mutation } from "./data";

/** Resolve a whole value→key table into value→text, once at module load. */
const table = <K extends string>(prefix: string, ids: readonly K[]): Record<K, string> =>
  Object.fromEntries(ids.map((id) => [id, tAny(`${prefix}${id}`)])) as Record<K, string>;

/** Risk is `${value} risk` at every call site, so the glossary is keyed that
 *  way too; the entry keys drop the space. */
const RISK = { "low risk": "lowRisk", "medium risk": "mediumRisk", "high risk": "highRisk" };

export const GLOSSARY: Record<string, string> = {
  // claim kind — extractor's classification (long-term-memory 1.2.9 prompt)
  ...table("memory.gloss.", ["static", "change"] as const),
  // disposition — how the proposal lands in the vault
  ...table("memory.gloss.", ["new", "merge", "rewrite"] as const),
  // risk — the extractor's own blast-radius estimate
  ...Object.fromEntries(Object.entries(RISK).map(([value, id]) => [value, tAny(`memory.gloss.${id}`)])),
};

export const OP_TIP: Record<Mutation["kind"], string> = table("memory.optip.", [
  "create_note", "append_section", "update_section",
  "add_link", "set_keywords", "set_status", "set_subjects",
] as const);

export const TYPE_TIP: Record<string, string> = table("memory.typetip.", [
  "character", "relationship", "timeline_event", "thread",
  "world", "tone", "source", "scene",
] as const);

// Term itself now lives in src/ui — it is a tooltip, not a glossary.
export { Term } from "../../ui";
