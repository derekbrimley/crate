# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Crate?

Crate is an intentional album picker web app. Users authenticate via Spotify OAuth (through Supabase), curate a library of albums (favorites + recommendations), and get weighted random selections across different modes (favorites, discover, for_right_now, surprise). The "for_right_now" mode uses Claude Haiku to suggest context-aware picks (e.g., "cooking dinner").

## Development Commands

```bash
npm run dev     # vercel dev — runs client + API functions together (requires Vercel CLI)
npm run build   # vite build — builds client only
```

No test framework is configured. The project uses TypeScript throughout but has no linter set up.

## Architecture

Single Vercel project: React client (static) + serverless API functions in `api/`.

### Client (`src/`)
- **React 18 + TypeScript + Vite + Tailwind CSS**
- React Router v6 for routing
- Supabase client in `src/lib/supabase.ts` (uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- `useAuth` hook manages Supabase session state, calls `POST /api/auth/sync` after Spotify OAuth
- `services/api.ts` attaches `Authorization: Bearer <token>` to every request (token from Supabase session)
- Pages: Dashboard, AddAlbums, Lists, History, Login

### API (`api/`)
- Vercel serverless functions — each file exports a default `handler(req, res)`
- Auth: `lib/auth.ts` — verifies Bearer JWT via Supabase admin client, returns `public.users` row
- Routes:
  - `api/auth/me.ts` — GET current user
  - `api/auth/sync.ts` — POST: called after OAuth, upserts Spotify tokens into `public.users`
  - `api/albums/index.ts` — GET/POST albums
  - `api/albums/search.ts` — GET Spotify search
  - `api/albums/[id].ts` — DELETE album
  - `api/albums/[id]/promote.ts` — POST promote to favorite
  - `api/picks/dashboard.ts` — GET picks for all modes
  - `api/picks/index.ts` — POST record a pick
  - `api/picks/history.ts` — GET pick history
  - `api/config/index.ts` — GET/PATCH user config

### Shared library (`lib/`)
- `supabaseAdmin.ts` — Supabase service-role client (bypasses RLS; server-only)
- `auth.ts` — JWT verification helper used by all API routes
- `queries.ts` — All async Supabase DB queries
- `spotify.ts` — Spotify API wrapper with automatic token refresh
- `claude.ts` — Claude Haiku integration for context-aware suggestions
- `selection.ts` — Weighted random album selection; receives config as a parameter
- `defaults.ts` — Default user config values
- `types.ts` — Shared DB row types

### Database (Supabase Postgres)
- `public.users` — Links `auth.users` (via `supabase_uid`) to Spotify tokens
- `public.items` — Albums with `list_type` of `favorite` or `recommendation`
- `public.picks` — History of album selections with mode and optional context
- `public.user_config` — Per-user key/value settings (JSONB values)
- `get_pick_history` — Postgres function for the picks+items JOIN query

Row Level Security is enabled on all tables. API routes use the service role key (bypasses RLS).

### Key design notes
- **Spotify tokens** are stored in `public.users` and refreshed server-side by `lib/spotify.ts`. Supabase only provides the provider token at initial sign-in; after that, the server manages refresh independently.
- **No in-memory caches** — serverless functions are stateless; config and Claude suggestion caches from the old Express server were removed.
- **`selectAlbums`** in `lib/selection.ts` takes a `SelectionConfig` parameter instead of fetching config internally; callers fetch config once via `getAllConfig()` and pass values in.

## Environment

Copy `.env.example` to `.env.local`. Required variables:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — public, exposed to client build
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` — for server-side token refresh
- `ANTHROPIC_API_KEY`

## Supabase setup

In Supabase dashboard:
1. Authentication → Providers → Enable Spotify (add client_id, client_secret — scopes are passed from the client, not configured here)
2. Authentication → Settings → **disable "Enable email confirmations"** (required — otherwise new OAuth sign-ups hit an email rate limit error)
3. Copy the Callback URL shown on the Spotify provider page and register it in Spotify Developer Dashboard → your app → Redirect URIs
4. Authentication → URL Configuration → set Site URL to `http://localhost:3000`, add `http://localhost:3000/**` to Redirect URLs
5. Run the SQL schema (tables + RLS policies + `get_pick_history` function) from `supabase/schema.sql`

**Important:** `VITE_SUPABASE_URL` and `SUPABASE_URL` must be the bare project URL with no path — e.g. `https://yourproject.supabase.co`. Do not include `/auth/v1/callback` or any other path segment.
