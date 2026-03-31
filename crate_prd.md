# Crate — Intentional Album Picker

## Overview

Crate is a web app that helps you decide what to listen to — quickly and intentionally. Instead of scrolling through infinite libraries or surrendering to algorithmic recommendations, Crate presents a small number of album options across different modes so you can make a fast, deliberate choice and start listening.

The app balances three listening goals:
1. **Revisiting recent favorites** — albums you've been into lately
2. **Rediscovering deep cuts** — favorites you haven't reached for in a while
3. **Exploring new music** — recommendations you've been meaning to try

It also reduces the paradox of choice by only ever showing 2–3 options per mode, drawn from your own curated lists.

---

## Core Concepts

### Album Lists

Users maintain two lists:

- **Favorites** — Albums you love and want to keep in rotation. These are the core of the app. Sourced from Spotify search, your Spotify library, or extracted from your Spotify playlists.
- **Recommendations** — Albums you've been meaning to listen to. A queue of things to try. When you love one, you can promote it to Favorites.

### Modes

The app's main screen is a **dashboard** that simultaneously displays 2–3 album suggestions for each mode:

| Mode | Source | Selection Logic |
|---|---|---|
| **Favorites** | Favorites list | Weighted random — biased toward albums you haven't picked recently |
| **Discover** | Recommendations list | Weighted random — biased toward oldest-added (things you've been meaning to get to) |
| **For Right Now** | Favorites + Recommendations | AI-suggested albums that match a chosen context/setting (car, gym, work, cooking, winding down, etc.) |
| **Surprise Me** | All lists combined | Pure weighted random across everything — maximum variety |

All modes are visible at once. The user scans, picks an album, and it opens in Spotify.

### Context/Setting Intelligence

For the "For Right Now" mode, the user selects a context (e.g., "gym," "long drive," "deep work," "cooking dinner"). The app uses Claude to suggest the best-fit albums from the user's lists based on:
- Genre and energy level (derived from Spotify metadata: tempo, energy, valence, danceability, etc.)
- Album mood/character (Claude interprets the album's overall vibe using its knowledge + Spotify audio features)
- Context fit (Claude matches albums to the setting)

This means the user never has to manually tag albums. The AI handles the mapping.

### Recency Weighting

Every time a user picks an album, the app logs the pick with a timestamp. The selection algorithm then weights toward albums that haven't been picked recently:

- Albums picked within the cooldown window: **excluded** from random pools
- Albums picked recently: **low weight**
- Albums picked within the medium window: **medium weight**
- Albums not picked beyond the medium window (or never picked): **high weight**

All thresholds (cooldown period, recency windows) and weight values are read from user config with sensible defaults (see Configuration-Driven Behavior). This naturally creates rotation and resurfaces forgotten favorites over time, and users can tune the behavior to their preferences later via a Settings screen.

### Listen History

The app maintains a simple, viewable history of picks:
- Date/time of pick
- Which mode it was picked from
- Album info

This serves as a lightweight listening journal. No analytics needed — just a scrollable list.

---

## User Flows

### 1. First Launch / Onboarding

1. User lands on the app → prompted to connect Spotify via OAuth
2. After auth, the app shows an empty dashboard with a prompt: "Add some albums to get started"
3. User is guided to the **Add Albums** screen

### 2. Adding Albums

The Add Albums screen has three input methods:

**Search Spotify**
- Standard search bar → queries Spotify Search API → returns album results
- User taps an album → chooses to add to Favorites or Recommendations

**From Your Spotify Library**
- App fetches the user's saved albums from Spotify
- Displayed as a scrollable list with album art
- User taps to add to Favorites or Recommendations
- Bulk selection supported (checkboxes)

**From Your Spotify Playlists**
- App fetches user's playlists
- For each playlist, the app extracts unique albums represented by the tracks
- Displays albums grouped by playlist
- User taps to add individual albums to Favorites or Recommendations
- Bulk selection supported

### 3. Main Dashboard (Daily Use)

The main screen is the dashboard. It loads on open and shows:

```
┌─────────────────────────────────┐
│  🎲 FAVORITES                   │
│  [Album A]  [Album B]           │
│                                 │
│  🔮 DISCOVER                    │
│  [Album C]  [Album D]           │
│                                 │
│  📍 FOR RIGHT NOW               │
│  Context: [Gym ▼]               │
│  [Album E]  [Album F]           │
│                                 │
│  ✨ SURPRISE ME                  │
│  [Album G]  [Album H]           │
└─────────────────────────────────┘
```

Each album card shows:
- Album art (prominent — this is the main visual element)
- Album name
- Artist name

**Interactions:**
- **Tap an album** → opens in Spotify (via Spotify deep link / URI)
- **Refresh icon per section** → re-rolls that section's suggestions
- **"For Right Now" context selector** → dropdown or pill selector to pick a setting, then albums update
- **Swipe/dismiss** → if you don't want that option, swipe it away and a new one appears

### 4. Managing Lists

A secondary screen accessible from nav:

**Favorites list**
- Scrollable grid of album art
- Tap to view details (last picked, times picked)
- Swipe or long-press to remove
- Search/filter

**Recommendations list**
- Same layout
- Additional action: "Promote to Favorites" (moves album from Recommendations → Favorites)

### 5. Listen History

Accessible from nav. A reverse-chronological feed:

```
Today
  [Album art] Blonde — Frank Ocean (Favorites)

Yesterday  
  [Album art] ROM — Shygirl (Discover)
  [Album art] Titanic Rising — Weyes Blood (For Right Now: cooking)
```

---

## Context/Setting Options

The available contexts for "For Right Now" mode are stored in user config (key: `contexts`) and can be customized per user. The defaults are:

- 🚗 Driving
- 💪 Gym / Workout
- 🧠 Deep Work / Focus
- 🍳 Cooking
- 🌙 Winding Down
- 🎉 Hosting / Party
- ☀️ Morning
- 🚶 Walking / Errands
- 🧘 Chill / Background

Adding, removing, or reordering contexts is a config change — no code modification needed.

---

## Technical Architecture

### Stack

- **Frontend**: React (Vite) with TypeScript, Tailwind CSS
- **Backend**: Node.js / Express API server
- **Database**: SQLite via better-sqlite3 for development; structured for easy migration to Postgres for multi-user production
- **Auth**: Spotify OAuth 2.0 (PKCE flow for web app) — serves as both Spotify access and user identity
- **AI**: Anthropic API (Claude) for context-based album matching
- **Deployment**: Web app, accessible from any device. Deploy to Railway, Fly, Render, or similar. Mobile-first responsive design (no native app needed).

### Spotify Integration

**OAuth Scopes Needed:**
- `user-library-read` — access saved albums
- `playlist-read-private` — access private playlists
- `playlist-read-collaborative` — access collaborative playlists

**API Endpoints Used:**
- `GET /v1/search` — album search
- `GET /v1/me/albums` — user's saved albums
- `GET /v1/me/playlists` — user's playlists
- `GET /v1/playlists/{id}/tracks` — tracks in a playlist (to extract albums)
- `GET /v1/albums/{id}` — album details
- `GET /v1/audio-features` — audio features for tracks (tempo, energy, valence, etc.)

**Opening Albums in Spotify:**
- Use Spotify URI: `spotify:album:{album_id}` — opens in Spotify desktop/mobile app
- Fallback: `https://open.spotify.com/album/{album_id}` — opens in browser/web player

### Claude Integration (Context Matching)

When the user selects a context in "For Right Now" mode:

1. App gathers the user's full album list (Favorites + Recommendations) with cached Spotify metadata (genres, audio features averages per album)
2. App sends a prompt to Claude:
   - System: "You are a music curator. Given a list of albums with their metadata, suggest the 2-3 best albums for the given listening context. Return only album IDs. Consider genre, energy, tempo, mood, and your general knowledge of these albums."
   - User: `Context: "${context}". Albums: ${JSON.stringify(albumsWithMetadata)}`
3. Claude returns album IDs → app displays those albums in the "For Right Now" section

**Caching**: Cache Claude's response per context + album-list-hash so identical requests don't re-call the API. Invalidate when albums are added/removed.

### Data Model

```
users
  id
  spotify_id
  display_name
  email
  spotify_access_token
  spotify_refresh_token
  token_expires_at
  created_at

items                        — generic; media_type = "album" for v1
  id
  user_id
  media_type               — "album" (future: "book", "movie", etc.)
  list_type                — "favorite" | "recommendation"
  title                    — album name (or book title, movie title, etc.)
  creator                  — artist (or author, director, etc.)
  image_url                — album art (or book cover, poster, etc.)
  external_id              — spotify_album_id (or ISBN, TMDB ID, etc.)
  external_uri             — spotify URI (or other deep link)
  external_url             — fallback web URL
  added_at
  metadata                 — JSON blob for source-specific data:
                              for albums: { genres, avg_energy, avg_tempo,
                              avg_valence, avg_danceability }

picks
  id
  user_id
  item_id
  mode                     — "favorites" | "discover" | "for_right_now" | "surprise"
  context                  — nullable, e.g. "gym" (only for "for_right_now" mode)
  picked_at
```

Note: The `items` table uses generic column names (`title`, `creator`, `image_url`) so it can hold any media type. Spotify-specific fields like audio features live in the `metadata` JSON blob. This keeps the core schema stable when new media types are added later.

### Selection Algorithm (Weighted Random)

All threshold and weight values below are read from user config (see Configuration-Driven Behavior section). No magic numbers in the code.

```
function selectAlbums(pool, count, picks, config):
  for each album in pool:
    daysSinceLastPick = daysAgo(mostRecentPick(album, picks))
    
    if daysSinceLastPick < config.cooldown_days:
      weight = 0                           # cooldown — excluded
    elif daysSinceLastPick < config.weight_recent_days:
      weight = config.weight_low           # low
    elif daysSinceLastPick < config.weight_medium_days:
      weight = config.weight_medium        # medium
    else:
      weight = config.weight_high          # high (or never picked)
    
    if neverPicked(album):
      weight = weight + config.weight_never_picked_bonus

    # Apply randomness factor: higher = more random, lower = more deterministic
    weight = weight * (random() ** (1 / config.randomness_factor))

  return weightedRandomSample(pool, weights, count=config.cards_per_mode)
```

---

## UI/UX Notes

### Design Principles

- **Album art forward** — album covers are the primary visual. They should be large, vivid, and tactile. The app should feel like flipping through a crate of records.
- **Fast to use** — the main screen should load with suggestions ready. Two taps max to start listening (open app → tap album).
- **Low friction adding** — adding albums should be as easy as possible. Search, tap, done.
- **No infinite scroll** — the whole point is constraint. Never show more than 2-3 options per section.
- **Warm and opinionated** — this isn't a neutral utility. The design should have personality. Think record store, not spreadsheet.

### Visual Direction

- Dark background to make album art pop
- Rounded album art cards with subtle shadows
- Minimal text — let the art speak
- Smooth animations on refresh/re-roll (cards flip or slide)
- Context pills for "For Right Now" should feel tactile (toggle-like)

### Mobile-First

- Designed for phone screens first (this is a "what do I put on right now" tool)
- Dashboard sections stack vertically, each taking roughly one viewport section
- Swipe gestures for dismiss/refresh

### Navigation

Simple bottom nav or tab bar:
- **Home** (dashboard)
- **Add** (add albums)
- **Lists** (view/manage Favorites and Recommendations)
- **History** (listen log)
- **Settings** (configure dashboard, weights, contexts — v2, but reserve the nav slot)

---

## Milestones

### M1 — Core Loop (MVP)
- Spotify OAuth login
- Add albums via Spotify search
- Favorites and Recommendations lists (CRUD)
- Dashboard with Favorites and Discover modes
- Weighted random selection with recency tracking
- Tap to open in Spotify
- Pick history log

### M2 — Library Import
- Import from Spotify saved albums
- Import from Spotify playlists (extract albums)
- Bulk add support

### M3 — Context Mode
- "For Right Now" mode with context selector
- Claude integration for context-based suggestions
- Spotify audio features caching per album

### M4 — Polish & Settings
- Animations and transitions
- Swipe to dismiss / re-roll
- Surprise Me mode
- Promote recommendation → favorite flow
- Mobile responsive polish
- **Settings screen** — UI for editing user config values (cooldown, weights, dashboard modes, contexts, cards per mode, randomness factor)

### M5 — Future Ideas (v2+)
- Custom contexts
- **Other media types** — books (Goodreads/Open Library integration), movies (TMDB), podcasts, TV shows. Same core UX: curate a list, get presented options, pick, go.
- **Social sharing** — send a recommendation to a friend in-app. They see an incoming rec and can accept it to their Recommendations list or dismiss. Follow friends to see what they're picking.
- Weekly digest — "you haven't listened to these favorites in a while"
- Spotify playback integration (play directly in app if Spotify Premium)
- "Rate after listen" — quick thumbs up/down after picking, refines future suggestions

---

## Architecture Principles

### Multi-User from Day One

The app is being built for personal use initially but should be deployable as a multi-user web app without a rewrite. This means:

- All data is scoped to a user ID from the start (no global singletons or local-only storage)
- Spotify OAuth handles both authentication and identity
- Database schema already supports multiple users
- Session management via secure cookies or JWTs
- Deploy target: web (accessible from any device — phone, tablet, desktop)

### Extensibility Beyond Music

The v1 is music/albums only, but the architecture should not hardcode "album" assumptions everywhere. Future versions may support books, movies, TV shows, podcasts, etc. Guidance for building v1:

- Use a generic `items` concept in the data layer where practical, with a `media_type` field (set to `"album"` for now)
- Keep Spotify-specific logic isolated in its own service/module — not spread across the codebase
- The core selection algorithm (weighted random, recency tracking, context matching) should operate on generic items, not album-specific fields
- UI components for "cards" should be flexible enough to display different media types later (album art today, book covers or movie posters tomorrow)
- Don't over-engineer for this — just keep the boundaries clean so it's a reasonable refactor later, not a rewrite

### Future: Social Sharing

Not in scope for v1, but the data model should not prevent this:

- A user should be able to send a recommendation to another user (by username, email, or link)
- The recipient sees it as an incoming recommendation they can accept (adds to their Recommendations list) or dismiss
- This implies a future `shared_recommendations` table or similar — no need to build it now, just don't create data model decisions that make it awkward later

### Configuration-Driven Behavior

Many aspects of the app that feel like "product decisions" should actually be stored as per-user configuration values with sensible defaults. This keeps the codebase flexible, avoids magic numbers, and sets up a future Settings screen without refactoring.

**Principle: If a value controls app behavior and a user might reasonably want to change it, store it in config — not as a hardcoded constant.**

For v1, these values live in a `user_config` table with sensible defaults applied at the code level (no settings UI needed yet). The code should always read from config, never from inline constants.

**Configurable values (with v1 defaults):**

| Key | Default | Description |
|---|---|---|
| `dashboard_modes` | `["favorites", "discover", "for_right_now", "surprise"]` | Which modes appear on the dashboard and in what order |
| `cards_per_mode` | `2` | Number of album options shown per dashboard section |
| `cooldown_days` | `3` | Days after a pick before an album re-enters the pool |
| `weight_recent_days` | `14` | Picks within this window get low weight |
| `weight_medium_days` | `30` | Picks within this window get medium weight |
| `weight_low` | `1` | Weight for recently-picked albums (past `weight_recent_days`) |
| `weight_medium` | `3` | Weight for medium-recency albums |
| `weight_high` | `5` | Weight for old or never-picked albums |
| `weight_never_picked_bonus` | `2` | Extra weight added to albums never picked |
| `contexts` | `["driving", "gym", "deep_work", "cooking", "winding_down", "hosting", "morning", "walking", "chill"]` | Available context/setting options for "For Right Now" mode |
| `randomness_factor` | `1.0` | Multiplier on the random component of selection. At 0, selection is purely recency-driven. At 2.0, it's much more random. 1.0 is balanced. |

**Data model addition:**

```
user_config
  id
  user_id
  key                — string, e.g. "cooldown_days"
  value              — JSON string (to support numbers, arrays, objects)
  updated_at
  
  UNIQUE(user_id, key)
```

**Implementation guidance:**

- Create a `getConfig(userId, key)` helper that reads from `user_config` with a fallback to a `DEFAULT_CONFIG` object
- All selection logic, dashboard rendering, and context options should read from this helper — never from inline constants
- v1 does not need a Settings UI — just the table and the helper. Defaults handle everything.
- When a Settings screen is built (v2), it simply writes to this table. No code changes needed in the core logic.
- Config values should be cached in memory per session (not fetched from DB on every dashboard load)

---

## Open Decisions

1. **App name** — "Crate" is a working title. Alternatives: "Spin," "Pick," "Dig," "Stack." Could also be something less literal.
2. **Spotify rate limits** — Audio features endpoint is rate-limited. Need to cache aggressively and batch requests when importing large libraries.
3. **Claude cost management** — Context matching calls Claude per request. Caching helps, but should monitor usage. Could also use a lighter model (Haiku) for this task.
4. **Database choice** — SQLite is fine for single-user / low-traffic. If scaling to many users, migrate to Postgres. Use an ORM or query builder (e.g., Drizzle, Prisma) so the switch is straightforward.