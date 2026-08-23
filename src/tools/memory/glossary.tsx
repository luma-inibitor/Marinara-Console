/* @copy-strict */ // every string literal in this file is user-visible copy
// The education pattern (owner-approved 2026-08-21): every enum value and
// icon the UI renders can answer "what does this word mean" in place. One
// definition source; each definition leads with the field the value belongs
// to ("claim kind · static — …") so a bare word is never floating free.
//
// Desktop: hover or focus shows the definition. Touch: tap toggles it (a
// tooltip is never hover-only). The decision toggle carries NO tooltip — a
// help affordance on an interactive control is a contradiction (owner
// feedback); its teaching lives in a first-use hint instead.

import type { ComponentChildren } from "preact";
import type { Mutation } from "./data";

export const GLOSSARY: Record<string, string> = {
  // claim kind — extractor's classification (long-term-memory 1.2.9 prompt)
  static: "claim kind · an enduring fact or defined state — true about someone or the world, not established by a narrated event",
  change: "claim kind · an outcome caused by a specific event — traces back to a timeline event",
  // disposition — how the proposal lands in the vault
  new: "disposition · creates a memory that does not exist yet",
  merge: "disposition · folds new material into a memory that already exists",
  rewrite: "disposition · replaces the stored section text instead of adding to it",
  // risk — the extractor's own blast-radius estimate
  "low risk": "risk · the blast radius if this claim is wrong — low: additive and easy to undo",
  "medium risk": "risk · the blast radius if this claim is wrong — medium: worth a look before it lands",
  "high risk": "risk · the blast radius if this claim is wrong — high: review this one",
};

export const OP_TIP: Record<Mutation["kind"], string> = {
  create_note: "operation · create — makes a new memory (a script is the whole memory; a file is one section)",
  append_section: "operation · append — adds lines to the end of one section",
  update_section: "operation · update — replaces one section's stored text",
  add_link: "operation · link — connects this memory to another memory",
  set_keywords: "operation · keywords — replaces the memory's keyword list",
  set_status: "operation · status — changes the memory's lifecycle status",
  set_subjects: "operation · subjects — changes who the memory is about",
};

export const TYPE_TIP: Record<string, string> = {
  character: "memory type · character — one person",
  relationship: "memory type · relationship — the state between two people",
  timeline_event: "memory type · timeline event — something that happened, anchored in time",
  thread: "memory type · thread — an open question the story should resolve",
  world: "memory type · world — setting, places, rules",
  tone: "memory type · tone — how scenes should feel",
  source: "memory type · source — an imported record that claims were extracted from",
  scene: "memory type · scene — one scene's record",
};

// Term itself now lives in src/ui — it is a tooltip, not a glossary.
export { Term } from "../../ui";
