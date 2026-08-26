- refactor & standardize on tailwind css
    - icon usage
    - color codes
    - product copy/text/localization strings
    - keyboard shortcuts
- standard components
    - chip
    - text with help tooltip/hover
    - help icon tooltip/hover
    - filter/group/sort picker
    - facet drawer
    - search bar with fuzzy search 
    - search disclosure
    - chat mode pills & icons
    - list group
    - list item
    - memory detail view
        - character
        - timeline event
        - thread
        - relationship
        - world
        - tone
    - memory detail section
    - raw json disclosure
    - copyable text element
- url schema
- review queue
    - filter/group/sort
    - facet drawer
    - decision status line


# schema: Memory entry 

```jsonc
{
  "id": "char_mira_solace",          // string, lowercase snake_case, 1–120 chars
  "title": "Mira Solace",            // string 1–240, OPTIONAL
  "type": "character",               // enum
  "status": "active",                // "active" | "resolved" | "archived"
  "modes": ["roleplay"],             // array of "roleplay"|"conversation"|"game", 1–8
  "scope": { "chatId": "c1", "chatIds": ["c1"] },
  "tags": ["arc_two"],               // snake_case identifiers, ≤100
  "keywords": ["mira", "solace"],    // strings ≤80 chars, ≤30 entries
  "manualKeywords": [],              // OPTIONAL, ≤30
  "suppressedKeywords": [],          // OPTIONAL, ≤30
  "createdAt": "2026-08-22T10:00:00.000Z",  // ISO-8601 with offset
  "updatedAt": "2026-08-22T10:05:00.000Z",  // must be >= createdAt
  "links": [ { "target": "scene_dockside", "relation": "occurred_in", "aspect": "trust" } ],
  "sections": { "core": { /* section object, see below */ } },
  "conflicts": [ /* OPTIONAL, ≤250 */ ],
  "provenance": { "kind": "chat_summary", "sourceId": "c1", "entryId": "e7" }, // source notes ONLY
  "subjects": [ { "key": "mira solace", "ref": { "kind": "character", "id": "..." } } ],
  "version": 3,                      // int >= 1
  "extractionFingerprint": { /* source notes only */ },
  "extracted": true                  // legacy v1 flag, OPTIONAL
}
```

# schema: Memory entry section

```jsonc
{
  "text": "…",                        // string 1–24000, user-editable prose
  "updatedAt": "2026-08-22T10:05:00.000Z",
  "salience": 0.8,                    // number 0–1, optional
  "confidence": 0.9,                  // number 0–1, optional
  "importance": "major",              // "critical"|"major"|"moderate"|"minor", optional
  "dimensions": { "trust": 70 },      // int 0–100 per key, optional
  "dimensionChanges": { "trust": -10 },// int -100–100 per key, optional
  "evidence": ["\"quoted line\""],    // strings ≤240, ≤100, optional
  "contributions": [                  // ≤100, optional; provenance per contributor
    { "owner": "source", "sourceNoteId": "source_x", "sourceHash": "<64 hex>", "text": "…", "updatedAt": "…" },
    { "owner": "manual", "text": "…", "updatedAt": "…" }
  ]
}
```


