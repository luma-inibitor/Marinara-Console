# Memory note schema — reference

The shape of a long-term-memory note, as the engine defines it. Source of
truth: `ltmNoteSchema` in
`packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts`
(Pasta-Devs/Marinara-Agents).

Base path `/api/long-term-memory`. `GET /notes` returns a bare array;
`GET /notes/:id` returns one note. There is no DTO mapping — the on-disk file
and the API response are the same object.

Corpus counts throughout are from the local seeded corpus, measured
2026-08-23: 31 notes, 38 sections.

---

## The eight types

| Type | ID prefix | Vault folder | In corpus |
|---|---|---|---:|
| `source` | `source_` | `sources` | 8 |
| `timeline_event` | `timeline_` | `timeline` | 8 |
| `character` | `char_` | `characters` | 3 |
| `relationship` | `rel_` | `relationships` | 1 |
| `scene` | `scene_` | `scenes` | 0 |
| `thread` | `thread_` | `threads` | 5 |
| `world` | `world_`, `faction_`, `location_`, `rule_`, `rules` | `world` | 3 |
| `tone` | `tone_` | `tone` | 3 |

The ID prefix is enforced against the type. `world` is the only type with more
than one allowed prefix.

Any mutation touching a `scene_*` note is excluded from auto-apply, as target,
`noteId`, or link target.

---

## Fields required on every type

`id` · `type` · `status` · `modes` · `scope` · `tags` · `keywords` ·
`createdAt` · `updatedAt` · `links` · `sections` · `version`

| Field | Type | Constraints |
|---|---|---|
| `id` | string | `^[a-z][a-z0-9]*(_[a-z0-9]+)*$`, 1–120. Prefix must match type. |
| `type` | enum | the eight above |
| `status` | enum | `active` · `resolved` · `archived` |
| `modes` | string[] | 1–8 of `roleplay` · `conversation` · `game`. Legacy `visual_novel` folds to `roleplay` at parse time. |
| `scope` | object | defaults `{}`, which means global |
| `tags` | string[] | snake_case, ≤100, defaults `[]` |
| `keywords` | string[] | each 1–80 chars, ≤30, defaults `[]` |
| `createdAt` | string | ISO-8601 with offset |
| `updatedAt` | string | ISO-8601, must be ≥ `createdAt` |
| `links` | Link[] | ≤250, defaults `[]` |
| `sections` | Record&lt;string, Section&gt; | the memory content |
| `version` | number | integer ≥ 1, bumped on each write |

`tags`, `keywords` and `links` default to empty, so "required" means always
present, not always populated.

The note object is `.strict()`: an unknown top-level key is a parse error.

## Fields optional on any type

| Field | Type | Constraints |
|---|---|---|
| `title` | string | trimmed 1–240. Genuinely optional — fall back to `id`. |
| `manualKeywords` | string[] | ≤30. User-added overlay. |
| `suppressedKeywords` | string[] | ≤30. Suppression overlay. |
| `conflicts` | Conflict[] | ≤250 |
| `extracted` | boolean | legacy v1 metadata; freshness derives from `extractionFingerprint` |

## Fields restricted by type

| Field | Rule |
|---|---|
| `provenance` | Required on `source`, forbidden on every other type |
| `subjects` | Exactly 1 on `character`, exactly 2 on `relationship`, forbidden on the other six |
| `extractionFingerprint` | `source` only |

---

## `sections[key]` — Section

`sections` is `Record<string, Section>`: any snake_case key up to 80
characters is valid on any type. Section keys are convention, not constraint.

The Section schema is `.strip()` — unknown keys are dropped, not rejected.

| Field | Type | Req | Constraints | Populated |
|---|---|---|---|---:|
| `text` | string | yes | 1–24,000. User-editable prose. | 38/38 |
| `updatedAt` | string | yes | ISO-8601 with offset | 38/38 |
| `confidence` | number | no | 0–1 | 38/38 |
| `evidence` | string[] | no | each 1–240, ≤100 entries. Source quotes. | 38/38 |
| `salience` | number | no | 0–1 | 30/38 |
| `contributions` | Contribution[] | no | ≤100. Per-contributor provenance. | 30/38 |
| `importance` | enum | no | `critical` · `major` · `moderate` · `minor` | 24/38 |
| `dimensions` | Dimensions | no | absolute scores | 1/38 |
| `dimensionChanges` | DimensionChanges | no | deltas | 0/38 |

`importance` and the dimensions are structured fields by design. They are not
to be parsed out of `text`.

### `contributions[]`

A discriminated union on `owner`. Both variants are `.strict()`. Shared fields
are the Section's own minus `contributions`: `text`, `updatedAt`, `salience?`,
`confidence?`, `importance?`, `dimensions?`, `dimensionChanges?`, `evidence?`.

| `owner` | Extra fields |
|---|---|
| `source` | `sourceNoteId` (note id), `sourceHash` (64 lowercase hex) |
| `manual` | — |

### `dimensions` / `dimensionChanges`

Both `.strict()`, all keys optional, all integers. Same ten keys in each:

`trust` · `respect` · `loyalty` · `intimacy` · `tension` · `hostility` ·
`dependency` · `affection` · `lust` · `protectiveness`

`dimensions` is absolute, 0–100; an omitted key means neutral baseline rather
than zero. `dimensionChanges` is deltas, −100 to 100.

---

## Section merge behaviour by type

Whether an `append_section` merges into the existing text or rewrites it is
decided by `isAdditiveLtmSection(note, sectionKey)`. When additive, new text is
line-merged and duplicate normalized lines are dropped; otherwise the section
is replaced.

| Type | Additive sections |
|---|---|
| `timeline_event` | all |
| `world` | all |
| `character` | all except `items` and `progression` |
| `relationship` | `history` |
| `tone` | `observations` |
| any | any section named `anchors`, or any section on a note tagged `anchor` |

## Section keys observed

| Type | Keys | Section text (min / med / max chars) |
|---|---|---|
| `character` | `core` always; `voice`, `backstory`, `habits`, `appearance` | 82 / 100 / 434 |
| `relationship` | `state` | 78 / 78 / 78 |
| `thread` | `state`, `summary` | 109 / 122 / 133 |
| `timeline_event` | `event` | 75 / 83 / 96 |
| `tone` | `observations` and `profile`, both | 83 / 96 / 96 |
| `world` | `canon` | 169 / 174 / 252 |
| `source` | `source` | 66 / 781 / 2,818 |

The merge rules reference keys not present in this corpus: `items` and
`progression` on `character`, `history` on `relationship`, and `anchors` on any
type.

---

## `links[]` — Link

| Field | Type | Req | Constraints |
|---|---|---|---|
| `target` | string | yes | a note id |
| `relation` | enum | yes | see below |
| `aspect` | string | no | ≤50 |

Relations: `occurred_in` · `triggered_by` · `resolved_in` · `evidenced_by` ·
`affects_relationship` · `affects_character` · `caused_by` · `involves` ·
`blocks` · `planted_in` · `paid_off_in` · `extracted_from`

`extracted_from` carries lineage: derived memories link back to their `source_*`
note with it, and `GET /notes/:id/derived` walks that relation transitively.

Observed in corpus: `extracted_from` ×23, `caused_by` ×7. No link carries an
`aspect`.

---

## `scope`

All keys optional, `.strict()`. `{}` means global.

`chatId` · `chatIds` · `groupId` · `groupIds` · `characterIds` · `personaId` ·
`personaIds`

Scalars are 1–120 chars; arrays are ≤100 entries. The scalar/array pairs are
redundant aliases and must agree on write — a scalar absent from its array is a
validation error. Normalization emits both, with the scalar set to the first
array element.

---

## `subjects[]` — Subject

1–2 entries, distinct by `key`, sorted ascending by `key`.

| Field | Type | Req | Constraints |
|---|---|---|---|
| `key` | string | yes | trimmed 1–240, no control characters. Stable identity key. |
| `ref` | object | no | `{ kind: "character" \| "persona", id: string }` |

Cardinality is enforced per type: exactly 1 on `character`, exactly 2 on
`relationship`, forbidden elsewhere.

---

## `provenance`

Source notes only — required there, forbidden elsewhere. `.strict()`.

| Field | Type | Req | Constraints |
|---|---|---|---|
| `kind` | enum | yes | `character` · `lorebook` · `chat_summary` |
| `sourceId` | string | yes | 1–120 |
| `entryId` | string | no | 1–120 — the lorebook entry or summary entry |

---

## `extractionFingerprint`

Source notes only. Records the context a source was last successfully extracted
against, so a stale draft can distinguish content changing from context
changing.

| Field | Type | Req | Constraints |
|---|---|---|---|
| `version` | 2 \| 3 | yes | literal |
| `sourceHash` | string | yes | 64 lowercase hex |
| `provenance` | Provenance \| null | yes | nullable |
| `scope` | Scope | yes | |
| `modes` | string[] | yes | 1–8 |
| `extractionMode` | enum | yes | a single mode |

Present on 4 of the 8 source notes in the corpus.

---

## `conflicts[]` — Conflict

| Field | Type | Req | Constraints |
|---|---|---|---|
| `field` | string | yes | 1–200 |
| `existing` | string | yes | ≤20,000 |
| `proposed` | string | yes | ≤20,000 |
| `sourceTurn` | number | no | integer ≥ 0 |
| `resolution` | enum | yes | `pending` · `accepted` · `rejected` · `user_decided` |
| `policy` | string | yes | 1–120 |

None present in the corpus.

---

## Related shapes

These are not notes and should not be rendered as one.

### `GET /notes/:id/derived` → `memories[]` item

A trimmed projection: `id` · `title?` · `type` · `status` · `scope` ·
`previewText` (≤600, whitespace-collapsed first section) · `incomingLinkCount` ·
`outgoingLinkCount`.

Envelope: `{ sourceNoteId, sourceIncomingLinkCount, sourceOutgoingLinkCount, memories[] }`.

### `LtmMemoryChunk`

What retrieval and injection actually rank. One record **per section**, not per
note, built by `chunkNotes()` and held in the metadata index rather than the
vault.

`id` (chunk id) · `noteId` · `title?` · `sectionKey` · `text` (1–20,000) ·
`noteType` · `status` · `modes` · `scope` · `tags` · `keywords` · `salience?` ·
`confidence?` · `importance?` · `dimensions?` · `dimensionChanges?` ·
`updatedAt` · `sourceHash`
