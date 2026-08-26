// The lorebook corpus: what GET /lorebooks and GET /lorebooks/:id/entries answer.
//
// `Entry` is the wire shape as well as the console's shape — `fetchEntries`
// hands the response straight to the components with no normalisation — so
// typing the fixture as `Entry[]` is a real drift guard: a field the engine
// gains or the console starts requiring fails `tsc --noEmit` here. There is no
// valibot schema for a lorebook entry, so this is the ONLY guard these rows
// have; see tests/e2e/corpus.spec.ts.
//
// Sizes are chosen for the checks that come after the smoke test, not for
// brevity. The audit list carries twelve entries because a tap-target check
// measures a control's clearance from its neighbours, and a three-row list has
// no crowded neighbours to measure.

import type { Entry, Lorebook } from "../../../src/tools/lorebooks/data";

export const BOOK_ID = "lb-atlas";

export const BOOKS: Lorebook[] = [
  { id: BOOK_ID, name: "Atlas of the Harbour", tokenBudget: 2000, enabled: true },
  { id: "lb-cast", name: "Standing Cast", tokenBudget: 1200, enabled: true },
  { id: "lb-rules", name: "House Rules", tokenBudget: 600, enabled: false },
];

/** Every field the tool reads, at an inert value. A row states only what it is
 *  about; `entry()` carries the other seventeen. */
const entry = (over: Partial<Entry> & Pick<Entry, "id" | "name">): Entry => ({
  content: "",
  description: "",
  keys: [],
  secondaryKeys: [],
  enabled: true,
  constant: false,
  selective: false,
  selectiveLogic: "and",
  useRegex: false,
  matchWholeWords: false,
  caseSensitive: false,
  position: 0,
  outletName: "",
  depth: 4,
  order: 100,
  tag: "",
  updatedAt: "2026-02-11T09:12:00.000Z",
  ...over,
});

const ATLAS: Entry[] = [
  entry({
    id: "e-harbour", name: "The harbour", tag: "places", order: 10,
    keys: ["harbour", "docks"], constant: true,
    description: "Always in context: every scene is within sight of the water.",
    content: "Sea-fog sits in the harbour until midday. The tide boards are chalked at dawn and nobody trusts them after noon.",
  }),
  entry({
    id: "e-fogline", name: "The fog line", tag: "places", order: 20,
    keys: ["fog", "mist"], selective: true, secondaryKeys: ["morning"],
    content: "Past the fog line the lamps are useless and the bell is the only navigation.",
  }),
  entry({
    id: "e-tidebell", name: "Tide bell", tag: "places", order: 30,
    keys: ["bell", "tide bell"],
    content: "Rung twice for a returning boat, three times for a wreck. Nobody has rung it three times in eleven years.",
  }),
  entry({
    id: "e-market", name: "Fishmarket", tag: "places", order: 40, keys: ["market", "fishmarket"],
    content: "Open before light, shut by ten. The stalls nearest the water pay the least rent and flood first.",
  }),
  entry({
    id: "e-mira", name: "Mira Vance", tag: "people", order: 50, keys: ["mira", "vance"],
    description: "Harbourmaster. Keeps the tide boards.",
    content: "Harbourmaster for nine years. Signs the boards herself because the last clerk guessed at them.",
  }),
  entry({
    id: "e-tolley", name: "Tolley", tag: "people", order: 60, keys: ["tolley"],
    content: "Runs the ferry. Will not cross after the bell, for any money.",
  }),
  entry({
    id: "e-ward", name: "Ward Ashe", tag: "people", order: 70, keys: ["ward", "ashe"], enabled: false,
    content: "Left the harbour two winters ago. Kept for continuity; not in play.",
  }),
  entry({
    id: "e-ferry", name: "The ferry", tag: "things", order: 80, keys: ["ferry", "crossing"],
    content: "Twelve minutes across in still water, forty in a swell, never in fog.",
  }),
  entry({
    id: "e-boards", name: "Tide boards", tag: "things", order: 90, keys: ["boards", "tide boards"],
    content: "Chalk on slate, waist-high at the harbour steps. Wrong more often than anyone admits.",
  }),
  entry({
    id: "e-lamps", name: "Harbour lamps", tag: "things", order: 100, keys: ["lamp", "lamps"],
    content: "Oil, not gas. Lit by hand along the west wall, and never past the fog line.",
  }),
  entry({
    id: "e-weather", name: "Weather", tag: "", order: 110, keys: ["weather", "storm"],
    position: 2, depth: 2,
    content: "Storms arrive from the north-west with about an hour of warning.",
  }),
  entry({
    id: "e-tone", name: "Tone", tag: "", order: 120, constant: true, position: 7, outletName: "style",
    content: "Plain, cold, specific. No lyric weather. Nobody explains the harbour to anyone who lives in it.",
  }),
];

const CAST: Entry[] = [
  entry({ id: "c-mira", name: "Mira Vance", tag: "principals", keys: ["mira"], content: "See the Atlas entry; this book carries her voice, not her post." }),
  entry({ id: "c-tolley", name: "Tolley", tag: "principals", keys: ["tolley"], content: "Speaks in half sentences and finishes none of them near the water." }),
  entry({ id: "c-clerk", name: "The clerk", tag: "walk-ons", keys: ["clerk"], content: "Unnamed on purpose. Whoever is holding the ledger that day." }),
  entry({ id: "c-ward", name: "Ward Ashe", tag: "walk-ons", keys: ["ward"], enabled: false, content: "Out of play." }),
  entry({ id: "c-chorus", name: "Dock chorus", tag: "walk-ons", keys: ["dockers"], content: "Six voices, no names, one opinion." }),
  entry({ id: "c-narr", name: "Narration", tag: "", constant: true, content: "Third person, past tense, no interiority for anyone but the player character." }),
];

const RULES: Entry[] = [
  entry({ id: "r-safety", name: "Lines", tag: "", constant: true, content: "No harm to the ferry children. Storms are never a punishment." }),
  entry({ id: "r-length", name: "Length", tag: "", constant: true, content: "Two to four paragraphs. End on something the player can act on." }),
  entry({ id: "r-names", name: "Names", tag: "", keys: ["name", "called"], content: "Coin names from the tide boards: Ashe, Vance, Tolley, Merrow." }),
  entry({ id: "r-dice", name: "Dice", tag: "", keys: ["roll", "check"], useRegex: false, content: "Never roll for weather. The weather is written." }),
];

export const ENTRIES: Record<string, Entry[]> = {
  [BOOK_ID]: ATLAS,
  "lb-cast": CAST,
  "lb-rules": RULES,
};
