# Library Advanced Filters (incl. release year) — Design

**Date:** 2026-06-18
**Status:** Approved

## Goal

Let users filter albums in the Library tab (`src/pages/Lists.tsx`) by release year,
delivered via a generic **Advanced Filters** rule builder that can filter on any
album field we have data for.

## Background / Key Constraint

The Library page filters operate entirely on cached `Item` rows
(`favorites` + `recommendations` from `DataCache`). Today an `Item`'s `metadata`
holds only `genres` — **release year is not stored**. Release date is available
from Spotify (`SpotifyAlbum.release_date`, returned by `getAlbumsBatch` and the
single-album fetch) but is never persisted on items.

So the feature is two parts: get year data onto items, then build the filter UI.

Serverless function count: currently 10 of the Hobby-plan max 12. Adding one
backfill endpoint → 11. OK.

## Part A — Release year data

Store Spotify's `release_date` (full `YYYY-MM-DD` string) into `item.metadata`.
Year is derived client-side via `release_date.slice(0, 4)`.

### A1. On add (single) — `api/albums/index.ts`
The handler already fetches `/albums/{id}` via `fetchAlbumGenres`. Extend that
flow to also capture `release_date` and save `metadata.release_date`. No new
Spotify call.

- Change `lib/spotify.ts`: add a helper (or extend `fetchAlbumGenres`) that
  returns both genres and `release_date` from the single album fetch. Cleanest:
  new `fetchAlbumMeta(albumId): Promise<{ genres: string[]; release_date: string | null }>`
  and have `fetchAlbumGenres` delegate to it (keep existing export for other callers).

### A2. On add (bulk) — `api/albums/bulk.ts`
Today this does no Spotify fetch. Add a `getAlbumsBatch` call (chunk external_ids
by 20) to attach `release_date` to each row's metadata before insert. Best-effort:
if the Spotify call fails, albums still get added without a year.

### A3. Backfill existing — `POST /api/albums/backfill` (new file)
- Loads the user's items where `metadata.release_date` is missing.
- Batches their `external_id`s through `getAlbumsBatch` (20/call).
- Updates each item's metadata via a new query helper, preserving existing keys
  (e.g. `genres`).
- Idempotent: items that already have `release_date` are skipped. Returns
  `{ updated: number }`.
- Triggered automatically once from the Library page on load when any loaded item
  lacks a year; no-op thereafter.

### A4. Query helper — `lib/queries.ts`
`updateItemMetadata(userId, itemId, metadata)` — merges/sets the `metadata` JSONB
for one item, scoped to the user.

## Part B — Generic Advanced Filters builder

A collapsible **ADVANCED FILTERS ▾** section under the existing Sort/List/Group
controls in `Lists.tsx`. Collapsed by default; shows a count badge when ≥1 rule is
active. Styling matches existing pill/mono controls (orange accent `#ff5e00`,
border `#3d2815`, `font-mono` 10px).

### Filterable fields

| Field  | Operators                         | Value input              |
|--------|-----------------------------------|--------------------------|
| Year   | is, is between, before, after     | number (one, or two for "between") |
| Genre  | is, is not                        | dropdown of library genres |
| Artist | is, contains                      | text                     |
| List   | is                                | fav / rec                |
| Plays  | ≥, ≤, is                          | number                   |

### Rule model

```ts
interface FilterRule {
  id: string;          // local unique id
  field: FieldKey;     // "year" | "genre" | "artist" | "list" | "plays"
  operator: string;    // valid operator for the field
  value: string;       // primary value
  value2?: string;     // for "is between"
}
```

State in `Lists.tsx`: `rules: FilterRule[]`, `matchMode: "AND" | "OR"`.

Each rule row renders: `[field ▾] [operator ▾] [value input] ×`.
Footer: `+ Add rule` and an `AND / OR` toggle.

### Architecture (isolated, testable, extendable)

- **`src/lib/filters.ts`** — pure, no React:
  - `FIELD_DEFS`: maps each field → its label, allowed operators, value-input type,
    and an `evaluate(item, rule, pickStats)` matcher.
  - `applyFilters(items, rules, matchMode, pickStats): Item[]`.
  - Adding a new filterable field = one entry in `FIELD_DEFS`.
- **`src/components/library/AdvancedFilters.tsx`** — the builder UI, driven entirely
  by `FIELD_DEFS` (field/operator dropdowns derive from the defs). Props: current
  `rules`, `matchMode`, `availableGenres`, and change handlers.
- **`Lists.tsx`** — owns `rules`/`matchMode` state; runs `applyFilters` in the
  existing `useMemo` chain, **after search, before sort/group**.

### Behavior notes

- Year rules: derive year from `metadata.release_date.slice(0,4)`. Items missing a
  release date do not match any year rule (correct once backfill has run).
- Genre rules: read `metadata.genres`. `availableGenres` for the dropdown is the
  union of genres across loaded items.
- The existing top-level LIST buttons (ALL/FAV/REC) remain; the "List" filter field
  is additive for users who want it inside compound rules. (Both paths AND together
  naturally since the LIST buttons pre-narrow `allItems`.)

## Out of scope (YAGNI)

- Nested rule groups / mixed AND-OR within one rule set (single flat `matchMode`).
- Saving named filter presets.
- Server-side filtering — all filtering stays client-side on cached items.
