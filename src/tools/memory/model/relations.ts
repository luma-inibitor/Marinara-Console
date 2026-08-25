import { t } from "../../../copy";

/** Catalog labels for every link relation the product names, so a link reads
 *  as English instead of as a wire value. An unrecognized relation humanizes
 *  rather than falling through to `snake_case`: the target's title is the
 *  point of the row and the relation is only its preposition.
 *
 *  One canonical form, sentence case. A caller rendering it anywhere but the
 *  start of a row lowercases it in CSS (`.rel-mid`), so the case follows the
 *  position rather than forking the string. */
const RELATION_KEY = {
  extracted_from: "memoryvault.relationExtractedFrom",
  occurred_in: "memoryvault.relationOccurredIn",
  triggered_by: "memoryvault.relationTriggeredBy",
  resolved_in: "memoryvault.relationResolvedIn",
  evidenced_by: "memoryvault.relationEvidencedBy",
  affects_relationship: "memoryvault.relationAffectsRelationship",
  affects_character: "memoryvault.relationAffectsCharacter",
  caused_by: "memoryvault.relationCausedBy",
  involves: "memoryvault.relationInvolves",
  blocks: "memoryvault.relationBlocks",
  planted_in: "memoryvault.relationPlantedIn",
  paid_off_in: "memoryvault.relationPaidOffIn",
  related_to: "memory.detail.relationRelatedTo",
} as const;

export function relationLabel(relation: string): string {
  const key = RELATION_KEY[relation as keyof typeof RELATION_KEY];
  if (key) return t(key);
  const words = relation.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
