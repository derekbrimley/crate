# Customizable Crates — Design

**Date:** 2026-06-29
**Status:** Approved, ready for implementation planning

## Problem

Recommendation lists ("crates") are hardcoded. The dashboard endpoint
(`api/picks/dashboard.ts`) implements a fixed set of modes — `favorites`,
`discover`, `for_right_now`, `surprise`, `from_friends` — via a `switch`
statement. Selection tuning (cooldown, variety, discovery bias) is **global**
in `user_config` and applies identically to every crate. Filtering logic lives
**client-side only** in `src/lib/filters.ts` and is used solely by the Library
tab.

We want crates to be **fully user-definable**: each crate carries its own
filters (the same filters available in the Library tab), its own selection
tuning, and its own "final recommendation logic" for narrowing a filtered pool
down to N picks. Users can create unlimited crates, edit them, delete them, and
create one directly from the filters currently applied in the Library tab.

## Goals

- A crate is a self-contained definition: filters + count + selection strategy.
- Four final-pick strategies: weighted random, pure random, AI-picks-from-pool,
  AI-suggests-new-albums.
- Per-crate weighting knobs: listen recency (+ cooldown), never-played bonus,
  recently-added freshness, randomness amount.
- Filters reuse the existing Library filter engine — one source of truth.
- Create a crate from the Library tab's current filters.
- Edit/delete crates from the Crates page via a modal.
- Seed new/existing users with starter crates that reproduce today's behavior
  (lossless migration).

## Non-goals

- No new database table or schema migration (crates live in existing
  `user_config` JSONB).
- No new serverless function (stays under the Hobby 12-function limit).
- No change to how albums are added, played, or to friend recommendations
  beyond representing "From Friends" as a pinned crate.

## Data model

Crates are stored under a single `user_config` key `crates` (a JSON array),
mirroring how `right_now_contexts` and `dashboard_modes` are already stored.
Persisted through the existing `PATCH /api/config`.

```ts
interface CrateDefinition {
  id: string;            // stable id (e.g. `crate_<timestamp>`)
  name: string;
  position: number;      // ordering on the Crates page
  source: "library" | "friends";  // "friends" = pinned From-Friends crate, ignores filters/strategy
  count: number;         // N final picks (replaces global cards_per_mode, now per-crate)
  filters: {
    rules: FilterRule[];           // reuses lib/filters FilterRule
    matchMode: "AND" | "OR";
  };
  strategy:
    | { type: "weighted"; weighting: Weighting }
    | { type: "random" }
    | { type: "ai_pool"; prompt?: string }  // AI picks N from the filtered pool
    | { type: "ai_new";  prompt?: string };  // AI suggests albums OUTSIDE the library
}

interface Weighting {
  // recency tiers (existing)
  cooldown_days: number;
  weight_recent_days: number;
  weight_medium_days: number;
  weight_low: number;
  weight_medium: number;
  weight_high: number;
  // never-played bonus (existing "discovery bias")
  weight_never_picked_bonus: number;
  // NEW: recently-added freshness
  recently_added_days: number;
  recently_added_bonus: number;
  // randomness amount (existing "variety")
  randomness_factor: number;
}
```

- The favorite/recommendation distinction is expressed as an ordinary filter
  rule (`list = favorite` / `list = recommendation`), which already exists in
  the filter UI. "Favorites" and "Discover" are therefore just crates with that
  single filter rule.
- AI prompt is **optional**; when blank, AI strategies work from the crate's
  filters and the user's taste profile.

## Filter + selection engine (shared)

The central refactor: make filtering usable on **both** client and server.

- Move the filter engine to root `lib/filters.ts` (importable by both `api/`
  and `src/`). `src/lib/filters.ts` becomes a thin re-export so the Library
  page is untouched.
- Filters reference `pickStats` (play counts / last-played). The server already
  has `getLastPicksForUser`; it will build the same `pickStats` map shape the
  client builds, so `evaluate()` behaves identically in both environments.
- Extend `lib/selection.ts`: `SelectionConfig` gains the recently-added knobs
  (`recently_added_days`, `recently_added_bonus`). `selectAlbums` adds a
  recently-added bonus term alongside the existing recency/never-picked terms.
- New `lib/crateEngine.ts` exposing:

  ```ts
  runCrate(crate, allItems, picks, deps): Promise<Item[]>
  ```

  It applies the crate's filters to `allItems`, then branches on
  `strategy.type`:
  - `weighted` → `selectAlbums(pool, count, picks, crate.strategy.weighting)`
  - `random`   → equal-weight sample of `count` from the pool
  - `ai_pool`  → AI selects `count` from the filtered pool (generalizes today's
    `getContextSuggestions`: optional prompt instead of fixed context genres)
  - `ai_new`   → AI suggests albums outside the library (generalizes today's
    `getSurpriseSuggestion`, honoring the optional prompt)
  - `source: "friends"` short-circuits to pending friend recommendations.

This replaces the hardcoded `switch` in `dashboard.ts`.

## API changes

- **`GET /api/picks/dashboard`** rewritten: load `crates` from config, then
  `Promise.all` over crates calling `runCrate(...)`. Returns
  `{ crates: [{ id, items }], _config, _picks }` instead of hardcoded mode keys.
  `?crateId=<id>` refreshes a single crate (replaces today's `?mode=`).
- **Crate CRUD** uses the existing `PATCH /api/config` with key `crates`: the
  client sends the full updated crates array. No new serverless function.
- **Seeding / migration:** on dashboard load, if no `crates` key exists,
  generate starter crates from the user's current config:
  - Favorites — filter `list = favorite`, strategy `weighted`
  - Discover — filter `list = recommendation`, strategy `weighted`
  - Surprise — strategy `ai_new`
  - One crate per Right Now context currently in use — filter = that context's
    genres, strategy `weighted`
  - From Friends — pinned `source: "friends"`

  Each weighted crate inherits today's global tuning values as its `weighting`,
  and `count` inherits today's global `cards_per_mode`. This makes the cutover
  lossless.

## UI

### Crates page (`src/pages/Crates.tsx`)
- Render crates from config in `position` order (drop the hardcoded
  `CRATE_META`).
- Each crate header gains an **edit (pencil)** control plus the existing
  refresh control.
- Context pills are removed (each context is now its own crate).
- A **"+ New Crate"** affordance opens the editor modal empty.

### Crate Editor modal (new `src/components/CrateEditorModal.tsx`)
One modal for both create and edit:
- Name field
- Count picker (1–7, reused from Settings' "suggestions per section")
- **Filters** — reuse the existing `AdvancedFilters` component (rules + AND/OR)
- **Strategy** — segmented control: Weighted / Random / AI from library /
  AI new albums
  - Weighted → reveals tuning sliders (reuse Settings' Cooldown / Variety /
    Discovery sliders + a new "Recently added" slider)
  - AI options → reveal an optional vibe/prompt text field
- Delete button (with confirm), Save / Cancel

### Library page (`src/pages/Lists.tsx`)
- Add a **"Save as crate"** button near the filter controls. Opens the same
  modal pre-filled with the currently-applied `rules` + `matchMode`, defaulting
  to the weighted strategy. This is the "create from Library filters" entry
  point.

### Settings page (`src/pages/Settings.tsx`)
- Remove the global selection-tuning sliders and the Right Now contexts editor
  (both now per-crate).
- Remove the global `cards_per_mode` picker (replaced by per-crate `count`).
- Keep profile/account.

## Risks / notes

- **Client/server filter parity** is the main correctness risk. Mitigation:
  single shared `evaluate()` and identical `pickStats` construction on both
  sides; verify with the same library data.
- AI strategies depend on `ANTHROPIC_API_KEY` and Spotify search (for `ai_new`);
  both already exist and fail gracefully today — preserve that fallback
  (fall back to a weighted/random pick on AI failure).
- Migration runs once per user; guard on absence of the `crates` config key.
```
