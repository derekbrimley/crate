# Crate Feature Batch — Design

Date: 2026-07-13

A batch of eight independent UX/feature improvements across the Library, Crates,
player, and album-search surfaces. Each is small and mostly self-contained; they
are grouped into one spec because they were requested together and share a few
touch points (player hook, crate filters).

## Features

### 1. Orphaned albums/genres panel (Library)

Surface albums and genres that fall into **no** library crate's filter pool —
i.e. albums that could never be surfaced by any crate.

- New client helper `src/lib/coverage.ts`:
  - `findUncovered(items, crateDefs, pickStats)` → `{ albums: Item[]; genres: string[] }`.
  - For each crate with `source === "library"` **and** a deterministic pool
    (strategy `weighted` / `random` / `ai_pool`), compute its pool via the
    existing `applyFilters(items, rules, matchMode, pickStats)`. `ai_new` and
    `hybrid` draw from outside/whole library unpredictably and `friends` has no
    pool, so they do **not** count toward coverage. (Rationale: coverage should
    reflect crates whose membership is defined by filters. `ai_new` suggests
    albums outside the library entirely; `hybrid`'s AI half is non-deterministic.
    A crate with empty rules is a catch-all and covers everything.)
  - Union all covered album ids. Uncovered albums = library items not in the union.
  - Uncovered genres = genres for which **every** album carrying that genre is
    uncovered (a genre is "covered" if at least one album with it is covered).
- New component `src/components/library/CoveragePanel.tsx`, mirroring the
  structure/visual language of `DuplicatesPanel.tsx`. Lists uncovered albums
  (rows with art + title + artist) and a chip row of uncovered genres. Read-only
  (no mutations); clicking an album selects it / opens its detail is out of scope
  for v1 — just a static list.
- Toggle from a new **GAPS** button in the Library header controls row, next to
  **DUPLICATES**. Only one of {duplicates, coverage} panel is open at a time.

### 2. Filtered album count (Library)

Show how many albums the current view (search + LIST + advanced filters) matches.

- In `Lists.tsx`, render a small mono label in the controls row: `N ALBUMS`
  where `N = ruleFiltered.length`. Reflects all active filters live. Placed near
  the SORT/LIST/GROUP controls.

### 3. Save-crate loading indicator

- `CrateEditorModal` tracks a `saving` boolean. `handleSave` awaits `onSave`
  (make the prop `Promise<void> | void`), sets `saving` true while in flight, and
  the SAVE button shows `…`/spinner and is disabled. On throw, re-enable.
- Both callers already `await` their save handlers, so no caller change needed
  beyond ensuring the promise is returned.

### 4. Remove-from-recommendations loading indicator

- `DetailPanel`'s remove flow is a two-step confirm. After the confirm click,
  `deleteAlbum` runs before the list updates. Add a `removing` state so the
  button shows a spinner/`…` between confirm-click and completion.

### 5. Fix: quick LIST filter dropped when saving a crate

- **Bug:** "SAVE AS CRATE" in `Lists.tsx` only passes `{ rules, matchMode }`. The
  quick **LIST** filter (`favorite`/`recommendation`) is not carried in, so a
  crate saved while viewing only Favorites includes recommendations too.
- **Fix:** when building the crate's filters on save, if `listFilter !== "all"`,
  append a `{ field: "list", operator: "is", value: listFilter }` rule.
  - If existing advanced rules use `matchMode === "OR"`, wrapping a mandatory
    list constraint via OR would be wrong. Handle by: if there are existing rules
    AND `matchMode === "OR"`, we cannot express "(list is X) AND (rules)" with a
    single flat rule list. For v1, when a quick list filter is active we force the
    combined semantics to AND only when it is unambiguous: if no advanced rules
    exist, matchMode stays as-is; if advanced rules exist with OR, we still append
    the list rule and keep OR (documented limitation) — **but** the common path
    (quick filter + no/AND advanced rules) is correct. Search text is a view-only
    concern and is intentionally NOT baked into the crate.
  - Practical decision: append the list rule to `rules`; keep the current
    `matchMode`. The dominant real-world case (fav/rec view, AND or no rules) is
    fixed. Note the OR edge case in a code comment.

### 6. Player: volume + seek bar + now-playing track

- `usePlayer` (`src/hooks/usePlayer.tsx`) additions:
  - Expose `position` (ms), `duration` (ms), `volume` (0–1).
  - `seek(ms)`, `setVolume(v)` wrapping the SDK's `player.seek` / `player.setVolume`.
  - Track `position`/`duration` from `player_state_changed`; advance `position`
    with a `setInterval` (~500ms–1s) while `!paused`, cleared on pause/unmount.
    Re-sync on each state event. Guard against `Date.now()` being unavailable is
    N/A (this is runtime app code, not a workflow script).
- `PlayerBar` additions:
  - Draggable seek bar (range input styled) with elapsed / total time labels.
    Dragging calls `seek`.
  - Volume slider (range input) calling `setVolume`.
- `DetailPanel` track list:
  - Highlight the row whose track matches the player's current track. Matching is
    by track uri when available; the SDK's `current_track.uri` is exposed via the
    player context (already have `currentTrack.uri`). Track rows currently have no
    uri — `AlbumTrack` will need a `uri` field from `getAlbumDetails` (verify the
    API returns track uris; if not, match by name+disc+number as a fallback).
  - Click a track row to play the album at that track's offset. Extend the play
    call to accept an offset (track position) or track uri.
- **Backend:** extend `PUT /api/spotify/play` and `startPlayback` to accept an
  optional `offset` (`{ position: n }`) or `uris`. Spotify's play endpoint
  supports `offset: { position }` alongside `context_uri`. `services/api.ts`
  `playOnSpotify` gains an optional offset param; `usePlayer.playAlbum` too.
- Deferred (noted, not built this round): shuffle/repeat toggles (state already
  in `player_state_changed`), queue view, device transfer, save-track-to-library.

### 7. Header buttons: search on Library, crate on Crates

- **Library** (`Lists.tsx`): replace the `+` "add albums" button with a
  **search-icon** button that navigates to `/add`. Keep profile button.
- **Crates** (`Crates.tsx`): remove the "add albums" `+` button entirely. Keep the
  "new crate" button but change its icon to a **crate/box** icon (currently `+`).
  Keep profile button.

### 8. Playable album from search results

- In `AddAlbums.tsx` `SearchTab`, add a Spotify **play (▶)** button to each result
  row. Reuse `DetailPanel`'s play logic: try in-app SDK (`player.canPlay` →
  `player.playAlbum(uri)`), else `playOnSpotify(uri)`, else open the web URL.
  Build the uri from `album.spotify_uri` (search results already include it).

## Non-goals

- No changes to how crates resolve picks server-side beyond the play-offset param.
- Coverage panel is read-only in v1 (no click-to-edit-crate).
- Player shuffle/repeat/queue/device features deferred.
- Search text is not persisted into saved crates.

## Testing

- `coverage.ts` gets unit tests (`src/lib/coverage.test.ts`) covering: catch-all
  crate covers all; filtered crates leave orphans; ai_new/friends crates ignored;
  genre coverage logic.
- Filter-merge on save: unit-test the helper that folds `listFilter` into rules.
- Manual/visual verification for player, header icons, search play, and loading
  indicators (no test framework wiring for UI in this repo).
