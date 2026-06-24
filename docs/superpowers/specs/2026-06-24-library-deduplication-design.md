# Library De-duplication Tool — Design

**Date:** 2026-06-24
**Status:** Approved (design), pending implementation plan

## Overview

A "Find duplicates" tool that scans the user's library for duplicate albums and
lets the user manually review and delete extra copies. Duplicates are a real
problem because the same album can be added more than once — as both a favorite
and a recommendation, bulk-imported from two different playlists, or as
different Spotify editions (deluxe vs. standard, remasters) that carry distinct
Spotify IDs.

The existing advanced filters (`src/lib/filters.ts`) narrow the library by
attribute and evaluate each item independently. They cannot find duplicates,
which is inherently a cross-item comparison. This is therefore a distinct
feature, not a new filter field.

## Placement

A **"Find duplicates"** button in the Lists page header, near the existing
SORT / LIST / GROUP controls. Clicking it scans the loaded library and opens an
**inline panel** below the controls, replacing the shelf view while active. A
"Done" / close control returns to the normal shelf.

Scanning is **100% client-side** — the full library is already in memory via
`DataCache` (`favorites` + `recommendations`), exactly like the existing
filters. No new scan endpoint is required.

## Detection — `src/lib/duplicates.ts` (new, pure module)

Mirrors the style of `filters.ts` (pure functions, unit-testable).

### Normalization

- `normalizeArtist(s)` — lowercase, trim, collapse whitespace, strip punctuation.
- `normalizeTitle(s)` — same as above, **plus** strip common edition suffixes via
  regex. Examples to handle:
  - `(Deluxe Edition)`, `(Deluxe)`
  - `(Remastered)`, `(Remaster)`, `- 2011 Remaster`, `- Remastered 2009`
  - `(Expanded Edition)`, `(Expanded)`
  - `(Anniversary Edition)`, `(... Anniversary Edition)`
  - `(Bonus Track Version)`

### Grouping — `findDuplicateGroups(items: Item[]): DuplicateGroup[]`

Two tiers:

1. **Exact** — items sharing the same `external_id` (Spotify ID). Certain
   duplicate.
2. **Fuzzy** — items with matching normalized `title` **and** normalized
   `artist` but **different** `external_id`. Flagged as a *possible* duplicate.

Rules:

- Items already grouped as exact are **not** re-flagged as fuzzy.
- Only groups with 2+ items are returned.

```ts
interface DuplicateGroup {
  matchType: "exact" | "fuzzy";
  items: Item[];
}
```

## Review UI — `src/components/library/DuplicatesPanel.tsx` (new)

- Each duplicate group rendered as a card.
  - Exact groups labeled **"Exact duplicate"**.
  - Fuzzy groups labeled **"Possible duplicate"**, visually distinct (e.g. amber
    accent) so the user treats them with more caution.
- Each item in a group shows: cover, title, artist, list type (★ FAV / ◈ REC),
  year, and play count — enough context to decide which copy to keep.
- Each item has a **Delete toggle** (marked state). **Nothing is pre-selected** —
  the user decides per group, fully manually.
- Running tally at the bottom: a **"Delete N items"** button, disabled until at
  least one item is marked.

## Delete flow — batch at end

- Marking items only stages them in local component state. No server calls happen
  until the user clicks **"Delete N items"**.
- That button shows a confirmation ("Delete N albums? This can't be undone.").
- On confirm, loop the **existing** client helper `deleteAlbum(id)` →
  `DELETE /api/albums/[id]` for each marked item, using `Promise.allSettled` so a
  single failure does not abort the rest. **No new endpoint** — respects the
  12-serverless-function Hobby plan limit.
- On success, update `DataCache` (`setFavorites` / `setRecommendations`,
  filtering out deleted ids — same approach as the existing `handleRemove` in
  `Lists.tsx`), re-run detection against the updated list, and show the remaining
  groups (or an empty / "no duplicates" state).

## Error handling

- Delete errors are surfaced per item. On partial failure, items that failed to
  delete remain visible with an error note; successfully deleted items are
  removed from the cache and the group.

## Testing — `src/lib/duplicates.test.ts` (new)

Unit tests for `duplicates.ts`:

- Normalization edge cases: edition-suffix stripping, punctuation, whitespace.
- Exact grouping by `external_id`.
- Fuzzy grouping by normalized title + artist, excluding items already matched
  exactly.
- Self-titled / coincidental-name cases behave sensibly.
- Singletons (no duplicate) are excluded.

## Scope guardrails (YAGNI)

Explicitly **out of scope**:

- Auto-resolve / automatic deletion.
- "Keep this one" suggestions or default selections.
- Any new server endpoint or bulk-delete API.
- Persisting dedupe state across sessions.

The feature is strictly: **scan → review → batch delete**.
