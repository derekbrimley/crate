# In-App Playback via Spotify Web Playback SDK

**Date:** 2026-06-24
**Status:** Approved design

## Problem

Songs currently play by opening Spotify (or by remote-controlling an already-running
Spotify app via the Connect API `/me/player/play`). The user wants audio to play
**straight from the Crate app**, with play / pause / previous / next controls.

## Solution Overview

Use Spotify's **Web Playback SDK**. The SDK loads a script in the browser that
registers the current tab as a Spotify Connect device ("Crate Web Player"). Audio
streams directly through the page. Crate plays albums onto *that* device, and transport
controls call the SDK player object directly.

### Constraints (confirmed)

- **Spotify Premium required** — the SDK will not initialize without it. Non-Premium
  accounts fire an `account_error`; we degrade gracefully (bar never appears, old
  behavior remains).
- **Desktop browsers only** — the SDK does not work on mobile browsers. Mobile keeps
  the existing deep-link / Connect behavior, unchanged.
- Player UI: **persistent bottom bar**, like Spotify's own player.
- Bar contents: **album art + track title/artist + four transport buttons**
  (play/pause, previous, next). No seek bar, no volume control (deferred — the SDK
  exposes both, easy to add later).

## Components

### 1. OAuth scope — `src/hooks/useAuth.ts`

Add `streaming` to the requested scopes. The SDK refuses to initialize without it.

Current scopes:
```
user-library-read playlist-read-private playlist-read-collaborative
user-modify-playback-state user-read-playback-state
```
Add `streaming`. **The user must re-authenticate once** after this change for the new
scope to take effect.

### 2. Client token endpoint — `api/spotify/[[...path]].ts`

Add `GET /api/spotify/token`. Returns a fresh Spotify access token for the
authenticated user, reusing the refresh logic already in `lib/spotify.ts`.

- The SDK needs an access token client-side via its `getOAuthToken` callback. This
  endpoint is the bridge from Crate's server-only token storage.
- Response shape: `{ access_token: string, expires_at: number }`.
- Implementation: export a helper from `lib/spotify.ts` that returns the current valid
  access token (refreshing if needed) — `getValidAccessToken(userId)` — wrapping the
  existing private `getAccessToken`. The route calls it and returns the token.
- Slots into the existing catch-all; no new serverless function (Hobby plan: currently
  11 of 12 functions used).

### 3. Play onto the SDK device — `lib/spotify.ts` + `play` route

`startPlayback(userId, spotifyUri, deviceId?)` gains an optional `deviceId`. When
present, append `?device_id=<id>` to `/me/player/play` so audio is routed to the web
player rather than whatever device happens to be active.

The `play` route in the catch-all accepts an optional `device_id` in the request body
and forwards it.

### 4. Player context + hook — `src/hooks/usePlayer.tsx`

A React context provider (`PlayerProvider`) wrapping the app, exposing a `usePlayer()`
hook.

Responsibilities:
- **Desktop-only guard:** if `/iPhone|iPad|Android/i.test(navigator.userAgent)`, skip
  SDK initialization entirely. `usePlayer()` returns `{ available: false, ... }` and all
  controls are no-ops.
- Inject the SDK script (`https://sdk.scdn.co/spotify-player.js`) once.
- On `window.onSpotifyWebPlaybackSDKReady`, instantiate
  `new Spotify.Player({ name: "Crate Web Player", getOAuthToken })`, where
  `getOAuthToken(cb)` fetches `/api/spotify/token` and calls `cb(access_token)`.
- Subscribe to events:
  - `ready` → capture `device_id`.
  - `not_ready` → clear `device_id`.
  - `player_state_changed` → expose current track `{ name, artist, image_url, uri }`
    and `paused` boolean. A null state means nothing is loaded.
  - `account_error` / `initialization_error` / `authentication_error` → set
    `available: false` and log; never throw.
- Connect the player.

Exposed API:
```ts
interface PlayerContextValue {
  available: boolean;        // SDK active on this device + Premium OK
  deviceId: string | null;
  currentTrack: { name: string; artist: string; image_url: string | null; uri: string } | null;
  paused: boolean;
  playAlbum(uri: string): Promise<void>;  // POST /api/spotify/play with device_id
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
}
```

`playAlbum(uri)` calls the existing play endpoint passing the captured `device_id`.

### 5. Persistent bottom bar — `src/components/PlayerBar.tsx`

Fixed bar pinned to the bottom of the viewport. Rendered near the app root (inside the
provider). Visible only when `available && currentTrack`.

Contents:
- Album art thumbnail (from `currentTrack.image_url`).
- Track title + artist (from `currentTrack`).
- Four transport buttons: previous, play/pause (toggles on `paused`), next.

Styling follows existing crate/mono design tokens (font-mono, crate color palette,
thin borders) consistent with `NowPlayingModal` / `DetailPanel`.

### 6. Wire existing play buttons — `NowPlayingModal.tsx`, `DetailPanel.tsx`

On desktop, when `usePlayer().available`, the "Play" action calls `playAlbum(uri)`
(web player) instead of `playOnSpotify(uri)`.

- The existing `onPlay?.()` pick-recording callback still fires.
- Mobile path (`/iPhone|iPad|Android/`) is unchanged: deep link to the Spotify app.
- If the web player is unavailable (e.g. SDK failed, non-Premium), fall back to the
  current `playOnSpotify` → `window.open` chain exactly as today.

## What stays the same

- Mobile behavior (deep link to Spotify app).
- Server-side token storage and refresh model — the new endpoint just exposes a fresh
  token; storage is unchanged.
- Pick recording / `onPlay` callbacks.
- All existing Spotify routes (library, playlists, search).

## Error handling

- Non-Premium / SDK errors → `available: false`, bar hidden, old behavior intact. No
  user-facing crash.
- Token endpoint failure inside `getOAuthToken` → SDK retries on next action; logged.
- `playAlbum` 404 (no device yet) → surface the existing "no active device" message;
  in practice the web player registers a device on load so this is rare.

## Testing

No test framework is configured in this project. Manual verification:
1. Re-authenticate (new `streaming` scope), confirm sign-in succeeds.
2. On desktop: open an album, press Play → audio plays in the browser tab; bottom bar
   appears with art + title.
3. Play/pause, next, previous all work and the bar reflects state.
4. On mobile: Play still deep-links to the Spotify app (unchanged).

## Deferred (YAGNI)

- Seek/progress bar.
- Volume control.
- Controls inside the modal (bottom bar only for now).
