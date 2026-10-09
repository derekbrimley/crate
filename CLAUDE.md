# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is s?

Crates is an intentional album picker web app. Users authenticate via Spotify OAuth (through Supabase), curate a library of albums and playlists (favorites + recommendations), and pick what to play from **crates** (user-defined sets: library filters plus records added or left out by hand), **search**, or **Discover** (recommendations, least-heard first). Crate and Discover pages list everything, ordered by a weighted-random algorithm that favors what hasn't been played lately, and can show Claude's suggestions for new albums (a per-crate toggle, and one on Discover). The redesign plan and its remaining steps are in `docs/superpowers/specs/2026-10-08-redesign-design.md`.

## Development Commands

```bash
npm run dev     # vercel dev — runs client + API functions together (requires Vercel CLI)
npm run build   # vite build — builds client only
```

`npm test` runs the Vitest suite (`lib/*.test.ts`, `src/lib/*.test.ts`). The project uses TypeScript throughout but has no linter set up.

## Architecture

Single Vercel project: React client (static) + serverless API functions in `api/`.

### Client (`src/`)
- **React 18 + TypeScript + Vite + Tailwind CSS**
- React Router v6 for routing
- Supabase client in `src/lib/supabase.ts` (uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- `useAuth` hook manages Supabase session state, calls `POST /api/auth/sync` after Spotify OAuth
- `services/api.ts` attaches `Authorization: Bearer <token>` to every request (token from Supabase session)
- Pages: Home (`/`: Crates / Search / Discover tiles), CratesIndex (`/crates`), CratePage (`/crates/:id`), Discover (`/discover`), AddAlbums (`/add`), Lists (`/library`), History, Login
- Crate and Discover pages show the **whole** pool, ranked on the client (`lib/ranking.ts` → `useRankedPool`): playable items in weighted-random order, then items still in cooldown ("Recently played"). The order is frozen per page in `DataCache` for the session, until reshuffled.

### API (`api/`)
- Vercel serverless functions — each file exports a default `handler(req, res)`
- **Hobby plan limit: 12 serverless functions per deployment.** When adding new endpoints, consolidate related routes into a single catch-all file (e.g. `[[...path]].ts`) instead of creating separate files.
- Auth: `lib/auth.ts` — verifies Bearer JWT via Supabase admin client, returns `public.users` row. Also accepts **household tokens** (`crate_hh_…`, `lib/householdTokens.ts`, table `household_tokens`): long-lived read+play tokens for shared devices such as the kitchen dashboard. `getAuthenticatedUser(header, scope)` takes the scope a route needs (`"read"`, `"play"`, or the default `"edit"`); a household token never satisfies `"edit"`, so any route that doesn't pass a scope rejects it. Tokens are created/revoked from the profile menu (Household Tokens) via `POST/DELETE /api/config?household_tokens=1`.
- Routes:
  - `api/auth/sync.ts` — POST: called after OAuth, upserts Spotify tokens into `public.users`
  - `api/albums/index.ts` — GET/POST library items (albums, or playlists with `media_type: "playlist"`)
  - `api/albums/search.ts` — GET Spotify album search. Playlist search covers only the user's own playlists, filtered client-side (`src/lib/playlistSearch.ts`) from `GET /api/spotify/playlists`.
  - `api/albums/bulk.ts` — POST bulk-add albums
  - `api/albums/[id].ts` — DELETE item, POST promote to favorite, GET details (album: tracks + artist albums; `?type=playlist`: tracks + owner/description)
  - `api/spotify/[[...path]].ts` — Catch-all for Spotify routes:
    - `GET /api/spotify/library` — albums from user's Spotify library
    - `GET /api/spotify/playlists` — user's Spotify playlists
    - `GET /api/spotify/playlists/:id/albums` — albums from a specific playlist
    - `GET /api/spotify/devices` — available Spotify Connect devices
    - `GET /api/spotify/state` — current playback state (track + device)
    - `PUT /api/spotify/play` — start an album or playlist on a device, and record the pick (see below)
    - `PUT /api/spotify/control` — transport commands (resume/pause/next/previous/seek/volume)
  - `api/picks/dashboard.ts` — GET crate definitions + per-item play stats (what the client ranks from). Seeds crates on first load and converts older crate shapes (`normalizeCrates`), saving the result. `?suggest=<crateId>|discover` returns Claude's new-album suggestions instead (`lib/suggestions.ts`). `?shelves=<n>` returns every crate as a shelf of up to n ranked picks (`lib/shelves.ts`), for the kitchen dashboard.
  - `api/picks/index.ts` — GET pick history
  - `api/config/index.ts` — GET/PATCH user config

### Shared library (`lib/`)
- `supabaseAdmin.ts` — Supabase service-role client (bypasses RLS; server-only)
- `auth.ts` — JWT verification helper used by all API routes
- `queries.ts` — All async Supabase DB queries
- `spotify.ts` — Spotify API wrapper with automatic token refresh
- `claude.ts` — Claude (Haiku 5.5, structured output) suggesting new albums for a taste + theme; `suggestions.ts` matches them to Spotify albums and drops ones already owned (`albumKey.ts`)
- `crates.ts` — The crate model, shared with the client: `CrateDefinition`, `cratePool` (what's in a crate), membership toggling, seeding, and `normalizeCrates` for older shapes. Every crate ranks with `DEFAULT_WEIGHTING`.
- `selection.ts` — Weighted random album selection; receives config as a parameter
- `ranking.ts` — Orders a whole pool for browsing (playable, then resting); `DISCOVER_WEIGHTING`
- `types.ts` — Shared DB row types

### Database (Supabase Postgres)
- `public.users` — Links `auth.users` (via `supabase_uid`) to Spotify tokens
- `public.items` — Albums and playlists (`media_type`) with `list_type` of `favorite` or `recommendation`. Playlists have no genres or release date, so year/genre filters never match them.
- `public.picks` — History of album selections with mode and optional context
- `public.user_config` — Per-user key/value settings (JSONB values)
- `get_pick_history` — Postgres function for the picks+items JOIN query

Row Level Security is enabled on all tables. API routes use the service role key (bypasses RLS).

### Key design notes
- **Playback is remote-only (Spotify Connect).** Crate never renders audio itself. This is deliberate: the Web Playback SDK caps at 256 kbps, so playing through a real Spotify client (phone/tablet/desktop app) is what allows the device's own quality setting — including lossless — to apply. Browser "Web Player" devices are filtered out everywhere, and there are no `open.spotify.com` fallbacks. Once something is playing, `usePlayer` acts as a remote control — polling `GET /api/spotify/state` and issuing `PUT /api/spotify/control` commands.
- **Starting an album has two paths, and never prompts the user.** If a Spotify app is already active, the album is handed straight to it. Otherwise `playAlbum` navigates to the `spotify:album:…` URI — which opens the Spotify app on whatever device the user is holding — and simultaneously fires `PUT /api/spotify/play` with `wait_for_device`. That request is `keepalive` (it must survive the browser being backgrounded) and the server polls devices for up to 8s, playing on the device that *appears* during the wait, since that's the app just woken. It falls back to an idle device only when exactly one exists; guessing among several risks playing in the wrong room.
- **Picks are recorded server-side, on play.** `PUT /api/spotify/play` records a pick whenever playback starts on a library item, whatever page started it; the client sends a `source` (a crate id, `search`, `library`, `history`, `now_playing`) that becomes the pick's `mode`. Replays of the same item within an hour aren't recorded again (`lib/plays.ts`), so starting several tracks of one album counts once.
- **Spotify tokens** are stored in `public.users` and refreshed server-side by `lib/spotify.ts`. Supabase only provides the provider token at initial sign-in; after that, the server manages refresh independently.
- **No in-memory caches** — serverless functions are stateless; config and Claude suggestion caches from the old Express server were removed.
- **`selectAlbums`** in `lib/selection.ts` takes a `SelectionConfig` parameter instead of fetching config internally.
- **Crates live in `user_config` under the `crates` key** as a JSON array. A crate is `(filter matches, favorites only unless include_recommendations) + include_ids − exclude_ids`. Filters let nothing in until they have a rule, so a crate with no rules is hand-picked only; the "Everything" rule (`field: "all"`) takes the whole library. "Add to crate" in the details pane toggles an item via `toggleMembership`. `ai_suggestions` shows Claude's picks on the crate page; Discover's switch is the `discover_ai_suggestions` config key. Suggestions are cached client-side for the session (each fetch is a paid Claude call).

## Environment

Copy `.env.example` to `.env.local`. Required variables:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — public, exposed to client build
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` — for server-side token refresh
- `ANTHROPIC_API_KEY` — Claude album suggestions

## Supabase setup

In Supabase dashboard:
1. Authentication → Providers → Enable Spotify (add client_id, client_secret — scopes are passed from the client, not configured here)
2. Authentication → Settings → **disable "Enable email confirmations"** (required — otherwise new OAuth sign-ups hit an email rate limit error)
3. Copy the Callback URL shown on the Spotify provider page and register it in Spotify Developer Dashboard → your app → Redirect URIs
4. Authentication → URL Configuration → set Site URL to `http://localhost:3000`, add `http://localhost:3000/**` to Redirect URLs
5. Run the SQL schema (tables + RLS policies + `get_pick_history` function) from `supabase/schema.sql`

**Important:** `VITE_SUPABASE_URL` and `SUPABASE_URL` must be the bare project URL with no path — e.g. `https://yourproject.supabase.co`. Do not include `/auth/v1/callback` or any other path segment.
