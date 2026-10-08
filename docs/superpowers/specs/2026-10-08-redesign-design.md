# Crates redesign: home, crates, search, discover

Status: in progress. Steps 1–3 shipped; step 4 (universal search) and step 5 (cleanup) remain.

## Goal

Replace the shelf-of-crates dashboard with a simpler app built around three ways to choose what to play:

1. **Crates**: pick one of your crates and see its whole contents, sorted by the weighted-random algorithm.
2. **Search**: one search, reachable from every page, across your library and Spotify.
3. **Discover**: your recommendations, sorted to surface what you've heard least.

The library also holds Spotify **playlists**, not only albums.

## Decisions

### Library
- Playlists are `items` rows with `media_type = 'playlist'`. They have no genres or release date, so year and genre filters never match them.
- Every successful play of a library item counts as a pick, whatever page started it. `PUT /api/spotify/play` records the pick, using the client's `source` (a crate id, `search`, `library`, `discover`, `history` or `now_playing`) as the pick's `mode`. A replay within an hour isn't recorded again.
- Playlist search covers only the user's own Spotify playlists, behind an Albums / My Playlists toggle.

### Crates
- A crate's contents = (items matching its filters) + (items added by hand) − (items excluded by hand). Items added by hand always appear, even recommendations when the toggle is off. A crate with no filters is a hand-picked list.
- The crate page shows the **whole** pool, not N picks. It's ordered by the shared weighting. Items still in cooldown go last, under "Recently played", dimmed, oldest play first.
- The order is fixed for the session (until reshuffled), so going back and forth doesn't reshuffle it. Newly added items appear at the end of the main list.
- Crate definitions lose the algorithm controls: no cooldown, variety, discovery bias or recently-added settings. One built-in weighting applies to every crate. Crates gain an `include_recommendations` toggle, which replaces the "List is…" filter rule.
- The pick strategies (`weighted`, `random`, `ai_pool`, `hybrid`, `ai_new`), the "For right now" contexts and the "From Friends" crate are removed. Claude stays as an optional **Claude suggestions** toggle per crate (new albums that fit the crate, named after it) and on Discover (new albums that fit your favorites). Existing crates are converted on load: filter-based crates keep their filters (rule-less ones get "Everything"); AI new-music and hybrid crates keep Claude suggestions on; From Friends and the recommendations-only Discover crate are dropped.
- There's no separate "fill from library" switch: filters and hand-picked records always work together. No rules means hand-picked only; the "Everything" rule includes the whole library.

### Discover
- Recommendations, sorted with a Discover weighting that strongly favors never-played and least-recently-played items.
- Pending friend recommendations appear in a "From friends" row at the top, with accept / dismiss.

### Navigation
- Bottom nav: **Home · Library**. History lives in the profile menu.
- Home offers the three options. Search (`/search`) is one tap away from every page header and replaces the Add page; the Add page's bulk Spotify imports live on at `/import` (profile menu → Import from Spotify).

## Steps

| Step | Scope | Status |
| --- | --- | --- |
| 1 | Playlists in the data layer, playback, details pane; picks recorded on play | Done (#15) |
| 1b | Search only your own playlists, Albums / My Playlists toggle | Done (#16) |
| 2 | Home page with three tiles, crates index, crate page (full ranked list), Discover page with friends row; retire the shelf dashboard | Done (#17, #18) |
| 3 | Crate editor: drop the weighting and AI options, add `include_recommendations`, items added or excluded by hand ("Add to crate…" sheet), convert existing crates, delete the AI code | Done |
| 4 | Universal search page (`/search?q=`): library and Spotify results, albums / artists / playlists; replaces the Add page | Done |
| 5 | Cleanup: remove the dead dashboard endpoint paths, `NowPlayingModal`, stale config keys | |

## Implementation notes
- Ranking is done on the client (`lib/ranking.ts`), from the cached library and play stats. `GET /api/picks/dashboard` returns crate definitions and play stats.
- Crate shape (`lib/crates.ts`): `{ id, name, position, filters, include_recommendations, include_ids, exclude_ids, ai_suggestions }`. No rules means hand-picked only; the "Everything" rule takes the whole library. The old `source`, `count` and `strategy` fields are converted by `normalizeCrates` the first time the dashboard endpoint reads them.
- Hobby plan: 12 serverless functions max, and 11 are used. New endpoints go into existing catch-alls.
