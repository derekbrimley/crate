# In-App Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play albums directly inside the Crate app (desktop) via the Spotify Web Playback SDK, with a persistent bottom bar offering play/pause/previous/next.

**Architecture:** The Web Playback SDK registers the browser tab as a Spotify Connect device. A React context (`PlayerProvider`) owns the SDK player instance, exposes transport controls and current-track state, and a fixed `PlayerBar` renders that state. A new `GET /api/spotify/token` endpoint hands the SDK a fresh access token. Existing play buttons route to the web player on desktop and keep the deep-link fallback on mobile.

**Tech Stack:** React 18 + TypeScript + Vite, Vercel serverless functions, Spotify Web Playback SDK (`https://sdk.scdn.co/spotify-player.js`).

## Global Constraints

- **Spotify Premium required** — SDK errors (`account_error`, etc.) must degrade gracefully: `available: false`, bar hidden, existing behavior intact. Never throw to the user.
- **Desktop browsers only** — if `/iPhone|iPad|Android/i.test(navigator.userAgent)`, skip SDK init entirely; mobile keeps deep-link behavior unchanged.
- **Hobby plan: max 12 serverless functions.** Do NOT add new files under `api/`; add the token route inside the existing `api/spotify/[[...path]].ts` catch-all. (Currently 11 functions.)
- **No test framework** is configured. "Verify" steps use `npm run build` (TypeScript type-check + Vite compile) and manual browser checks — there are no unit tests to write.
- Follow existing style: `font-mono`, crate color tokens, thin borders, consistent with `NowPlayingModal.tsx` / `DetailPanel.tsx`.

---

### Task 1: Expose a client-facing Spotify token endpoint

**Files:**
- Modify: `lib/spotify.ts` (add exported `getValidAccessToken`)
- Modify: `api/spotify/[[...path]].ts` (add `GET /api/spotify/token` route)

**Interfaces:**
- Consumes: existing private `getAccessToken(userId: number): Promise<string>` in `lib/spotify.ts`, and `getUserById` for `token_expires_at`.
- Produces:
  - `getValidAccessToken(userId: number): Promise<{ access_token: string; expires_at: number }>` exported from `lib/spotify.ts`.
  - `GET /api/spotify/token` → `200 { access_token: string, expires_at: number }`.

- [ ] **Step 1: Add `getValidAccessToken` to `lib/spotify.ts`**

Add near the other exported functions (e.g. after `startPlayback`):

```ts
export async function getValidAccessToken(
  userId: number
): Promise<{ access_token: string; expires_at: number }> {
  // getAccessToken refreshes if the stored token is within 60s of expiry.
  const access_token = await getAccessToken(userId);
  const user = await getUserById(userId);
  const expires_at = user?.token_expires_at ?? Math.floor(Date.now() / 1000) + 3600;
  return { access_token, expires_at };
}
```

- [ ] **Step 2: Add the `token` route to the catch-all**

In `api/spotify/[[...path]].ts`, import `getValidAccessToken` in the existing import from `../../lib/spotify`, then add this block immediately after the `play` route block (before the `library` route):

```ts
  // GET /api/spotify/token  — fresh access token for the Web Playback SDK
  if (route === "token" && req.method === "GET") {
    try {
      const token = await getValidAccessToken(user.id);
      return res.json(token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ error: "Failed to get Spotify token", detail: message });
    }
  }
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/spotify.ts api/spotify/[[...path]].ts
git commit -m "feat: add /api/spotify/token endpoint for Web Playback SDK"
```

---

### Task 2: Route playback to a specific device

**Files:**
- Modify: `lib/spotify.ts` (`startPlayback` gains optional `deviceId`)
- Modify: `api/spotify/[[...path]].ts` (`play` route forwards `device_id`)

**Interfaces:**
- Consumes: existing `spotifyFetch`.
- Produces:
  - `startPlayback(userId: number, spotifyUri: string, deviceId?: string): Promise<void>`
  - `PUT /api/spotify/play` body now accepts optional `device_id: string`.

- [ ] **Step 1: Update `startPlayback` in `lib/spotify.ts`**

Replace the existing `startPlayback` function with:

```ts
export async function startPlayback(
  userId: number,
  spotifyUri: string,
  deviceId?: string
): Promise<void> {
  const body = JSON.stringify({ context_uri: spotifyUri });
  const endpoint = deviceId
    ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : "/me/player/play";
  const res = await spotifyFetch(userId, endpoint, {
    method: "PUT",
    body,
  });
  if (res.status === 404) {
    throw new Error("No active Spotify device found. Open Spotify on any device first.");
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to start playback: ${res.status}`);
  }
}
```

- [ ] **Step 2: Forward `device_id` in the `play` route**

In `api/spotify/[[...path]].ts`, update the `play` route block:

```ts
  // PUT /api/spotify/play
  if (route === "play" && req.method === "PUT") {
    const { spotify_uri, device_id } = req.body as { spotify_uri?: string; device_id?: string };
    if (!spotify_uri) return res.status(400).json({ error: "spotify_uri is required" });
    try {
      await startPlayback(user.id, spotify_uri, device_id);
      return res.status(204).end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("No active Spotify device") ? 404 : 502;
      return res.status(status).json({ error: message });
    }
  }
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add lib/spotify.ts api/spotify/[[...path]].ts
git commit -m "feat: route startPlayback to optional device_id"
```

---

### Task 3: Add `streaming` OAuth scope and a client API helper

**Files:**
- Modify: `src/hooks/useAuth.ts:81-82` (add `streaming` scope)
- Modify: `src/services/api.ts` (add `getSpotifyToken`, extend `playOnSpotify`)

**Interfaces:**
- Produces:
  - `getSpotifyToken(): Promise<{ access_token: string; expires_at: number }>`
  - `playOnSpotify(spotifyUri: string, deviceId?: string): Promise<void>`

- [ ] **Step 1: Add the `streaming` scope**

In `src/hooks/useAuth.ts`, update the scopes string in `login`:

```ts
        scopes:
          "user-library-read playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state streaming",
```

- [ ] **Step 2: Add `getSpotifyToken` and extend `playOnSpotify` in `src/services/api.ts`**

Replace the existing `playOnSpotify` with:

```ts
export async function getSpotifyToken(): Promise<{ access_token: string; expires_at: number }> {
  return request<{ access_token: string; expires_at: number }>("/spotify/token");
}

export async function playOnSpotify(spotifyUri: string, deviceId?: string): Promise<void> {
  await request("/spotify/play", {
    method: "PUT",
    body: JSON.stringify({ spotify_uri: spotifyUri, ...(deviceId ? { device_id: deviceId } : {}) }),
  });
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAuth.ts src/services/api.ts
git commit -m "feat: request streaming scope and add token/device client helpers"
```

---

### Task 4: Add SDK type declarations

**Files:**
- Create: `src/types/spotify-sdk.d.ts`

**Interfaces:**
- Produces: ambient `window.Spotify`, `window.onSpotifyWebPlaybackSDKReady`, and `Spotify.Player` types used by Task 5.

- [ ] **Step 1: Create the declaration file**

Create `src/types/spotify-sdk.d.ts`:

```ts
// Minimal types for the Spotify Web Playback SDK (https://sdk.scdn.co/spotify-player.js)
export {};

declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
  }

  namespace Spotify {
    interface PlayerInit {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }

    interface Image {
      url: string;
    }

    interface Track {
      uri: string;
      name: string;
      artists: { name: string; uri: string }[];
      album: { name: string; uri: string; images: Image[] };
    }

    interface PlaybackState {
      paused: boolean;
      track_window: { current_track: Track };
    }

    interface WebPlaybackInstance {
      device_id: string;
    }

    interface Error {
      message: string;
    }

    class Player {
      constructor(init: PlayerInit);
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(event: "ready" | "not_ready", cb: (instance: WebPlaybackInstance) => void): boolean;
      addListener(event: "player_state_changed", cb: (state: PlaybackState | null) => void): boolean;
      addListener(
        event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
        cb: (error: Error) => void
      ): boolean;
      togglePlay(): Promise<void>;
      nextTrack(): Promise<void>;
      previousTrack(): Promise<void>;
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/types/spotify-sdk.d.ts
git commit -m "feat: add Spotify Web Playback SDK type declarations"
```

---

### Task 5: Player context + hook

**Files:**
- Create: `src/hooks/usePlayer.tsx`

**Interfaces:**
- Consumes: `getSpotifyToken`, `playOnSpotify` from `src/services/api.ts` (Task 3); `window.Spotify` types (Task 4).
- Produces:
  - `PlayerProvider({ children }): JSX.Element`
  - `usePlayer(): PlayerContextValue` where

```ts
interface CurrentTrack { name: string; artist: string; image_url: string | null; uri: string }
interface PlayerContextValue {
  available: boolean;
  deviceId: string | null;
  currentTrack: CurrentTrack | null;
  paused: boolean;
  playAlbum(uri: string): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
}
```

- [ ] **Step 1: Create `src/hooks/usePlayer.tsx`**

```tsx
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getSpotifyToken, playOnSpotify } from "../services/api";

interface CurrentTrack { name: string; artist: string; image_url: string | null; uri: string }

interface PlayerContextValue {
  available: boolean;
  deviceId: string | null;
  currentTrack: CurrentTrack | null;
  paused: boolean;
  playAlbum(uri: string): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
}

const noop = async () => {};
const PlayerContext = createContext<PlayerContextValue>({
  available: false,
  deviceId: null,
  currentTrack: null,
  paused: true,
  playAlbum: noop,
  togglePlay: noop,
  next: noop,
  previous: noop,
});

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const isMobile = () => /iPhone|iPad|Android/i.test(navigator.userAgent);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    if (isMobile()) return; // desktop only

    const init = () => {
      const player = new window.Spotify.Player({
        name: "Crate Web Player",
        getOAuthToken: (cb) => {
          getSpotifyToken()
            .then(({ access_token }) => cb(access_token))
            .catch((e) => console.error("Spotify token fetch failed", e));
        },
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setAvailable(true);
      });
      player.addListener("not_ready", () => setDeviceId(null));
      player.addListener("player_state_changed", (state) => {
        if (!state) { setCurrentTrack(null); return; }
        const t = state.track_window.current_track;
        setCurrentTrack({
          name: t.name,
          artist: t.artists.map((a) => a.name).join(", "),
          image_url: t.album.images[0]?.url ?? null,
          uri: t.uri,
        });
        setPaused(state.paused);
      });
      const fail = (label: string) => (e: Spotify.Error) => {
        console.warn(`Spotify ${label}:`, e.message);
        setAvailable(false);
      };
      player.addListener("initialization_error", fail("init error"));
      player.addListener("authentication_error", fail("auth error"));
      player.addListener("account_error", fail("account error (Premium required)"));

      player.connect();
    };

    // The SDK calls this global when the script finishes loading.
    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  const playAlbum = useCallback(async (uri: string) => {
    if (!deviceId) throw new Error("Web player not ready");
    await playOnSpotify(uri, deviceId);
  }, [deviceId]);

  const togglePlay = useCallback(async () => { await playerRef.current?.togglePlay(); }, []);
  const next = useCallback(async () => { await playerRef.current?.nextTrack(); }, []);
  const previous = useCallback(async () => { await playerRef.current?.previousTrack(); }, []);

  return (
    <PlayerContext.Provider value={{ available, deviceId, currentTrack, paused, playAlbum, togglePlay, next, previous }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePlayer.tsx
git commit -m "feat: Spotify Web Playback SDK player context + hook"
```

---

### Task 6: Persistent bottom player bar

**Files:**
- Create: `src/components/PlayerBar.tsx`

**Interfaces:**
- Consumes: `usePlayer()` from Task 5.
- Produces: `PlayerBar(): JSX.Element | null` (renders null when `!available || !currentTrack`).

- [ ] **Step 1: Create `src/components/PlayerBar.tsx`**

```tsx
import React from "react";
import { usePlayer } from "../hooks/usePlayer";

export function PlayerBar() {
  const { available, currentTrack, paused, togglePlay, next, previous } = usePlayer();

  if (!available || !currentTrack) return null;

  const btn = "flex items-center justify-center w-9 h-9 text-crate-text/80 hover:text-crate-text transition-colors cursor-pointer";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2 border-t"
      style={{ background: "#1a120b", borderColor: "#3d2815" }}
    >
      {/* Art */}
      {currentTrack.image_url && (
        <img src={currentTrack.image_url} alt="" className="w-11 h-11 object-cover" />
      )}

      {/* Title + artist */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[12px] text-crate-text">{currentTrack.name}</p>
        <p className="truncate font-mono text-[10px] text-crate-muted">{currentTrack.artist}</p>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-1">
        <button aria-label="Previous" className={btn} onClick={() => { void previous(); }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
        </button>
        <button aria-label={paused ? "Play" : "Pause"} className={btn} onClick={() => { void togglePlay(); }}>
          {paused ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
          )}
        </button>
        <button aria-label="Next" className={btn} onClick={() => { void next(); }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zm-2 6L5.5 6v12z" /></svg>
        </button>
      </div>
    </div>
  );
}
```

> If `crate-text` / `crate-muted` are not the exact Tailwind token names in this project, match the names already used in `NowPlayingModal.tsx` (e.g. `crate-muted` is used there). Grep `tailwind.config` if unsure.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerBar.tsx
git commit -m "feat: persistent bottom player bar"
```

---

### Task 7: Mount provider + bar in the app tree

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PlayerProvider` (Task 5), `PlayerBar` (Task 6).

- [ ] **Step 1: Wrap the authenticated app and render the bar**

In `src/App.tsx`, add imports:

```tsx
import { PlayerProvider } from "./hooks/usePlayer";
import { PlayerBar } from "./components/PlayerBar";
```

Wrap the `DataCacheProvider` block (the authenticated return) so it becomes:

```tsx
  return (
    <PlayerProvider>
      <DataCacheProvider>
        <Routes>
          <Route path="/" element={<Crates onLogout={logout} />} />
          <Route path="/library" element={<Lists onLogout={logout} />} />
          <Route path="/add" element={<AddAlbums />} />
          <Route path="/history" element={<History onLogout={logout} />} />
          <Route path="/settings" element={<Settings onLogout={logout} />} />
          <Route path="/callback" element={<Crates onLogout={logout} />} />
        </Routes>
      </DataCacheProvider>
      <PlayerBar />
    </PlayerProvider>
  );
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mount PlayerProvider and PlayerBar in app tree"
```

---

### Task 8: Wire play buttons to the web player on desktop

**Files:**
- Modify: `src/components/NowPlayingModal.tsx` (play button, ~line 353-379)
- Modify: `src/components/library/DetailPanel.tsx` (play button, ~line 340-358)

**Interfaces:**
- Consumes: `usePlayer()` from Task 5.

The desired behavior in both components: on desktop, if the web player is available, play onto it; otherwise keep the existing `playOnSpotify` → `window.open` fallback. Mobile path unchanged.

- [ ] **Step 1: NowPlayingModal — import and use the hook**

At the top of `src/components/NowPlayingModal.tsx`, add:

```tsx
import { usePlayer } from "../hooks/usePlayer";
```

Inside the component body, add near the other hooks:

```tsx
  const player = usePlayer();
```

Replace the play button's `onClick` (the `async () => { ... }` at ~line 355) with:

```tsx
            onClick={async () => {
              onPlay?.();
              const uri = item.external_uri || (item.external_id ? `spotify:album:${item.external_id}` : null);
              const url = item.external_url || uri;
              if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
                if (url) window.location.href = url;
                return;
              }
              if (uri && player.available) {
                try {
                  await player.playAlbum(uri);
                  return;
                } catch { /* fall through */ }
              }
              if (uri) {
                try {
                  await playOnSpotify(uri);
                  return;
                } catch { /* fall through */ }
              }
              if (url) window.open(url, "_blank");
            }}
```

- [ ] **Step 2: DetailPanel — import and use the hook**

At the top of `src/components/library/DetailPanel.tsx`, add:

```tsx
import { usePlayer } from "../../hooks/usePlayer";
```

Inside the component body, add near the other hooks:

```tsx
  const player = usePlayer();
```

Replace the play button's `onClick` (~line 341) with:

```tsx
          onClick={async () => {
            const uri = item.external_uri || (item.external_id ? `spotify:album:${item.external_id}` : null);
            const url = item.external_url || uri;
            if (!url && !uri) return;
            onPlay?.();
            if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
              if (url) window.location.href = url;
              return;
            }
            if (uri && player.available) {
              try {
                await player.playAlbum(uri);
                return;
              } catch { /* fall through */ }
            }
            if (uri) {
              try {
                await playOnSpotify(uri);
                return;
              } catch { /* fall through */ }
            }
            if (url) window.open(url, "_blank");
          }}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/NowPlayingModal.tsx src/components/library/DetailPanel.tsx
git commit -m "feat: play onto web player on desktop, deep-link fallback on mobile"
```

---

### Task 9: Manual end-to-end verification

**Files:** none (manual QA).

- [ ] **Step 1: Re-authenticate for the new scope**

Run the app (`npm run dev`). Log out, then log in with Spotify again. Approve the new consent screen (it now includes streaming). Confirm sign-in completes.

- [ ] **Step 2: Desktop in-app playback**

On a desktop browser, open an album (Now Playing modal or library detail panel) and press Play. Expected:
- Audio plays in the browser tab (not by opening the Spotify app).
- The bottom player bar appears showing album art + track title + artist.

- [ ] **Step 3: Transport controls**

Press pause/play, next, previous on the bar. Expected: playback responds and the bar's play/pause icon + track info update accordingly.

- [ ] **Step 4: Mobile fallback (if a device is available)**

On a phone browser, press Play. Expected: it deep-links to the Spotify app as before; no bottom bar appears.

- [ ] **Step 5: Graceful degradation**

(If testable) With a non-Premium account, confirm the app does not crash, the bar stays hidden, and Play falls back to the previous behavior.

- [ ] **Step 6: Final commit (if any QA tweaks were needed)**

```bash
git add -A
git commit -m "fix: in-app playback QA adjustments"
```

---

## Self-Review

**Spec coverage:**
- Scope (`streaming`) → Task 3. ✓
- Token endpoint → Task 1. ✓
- Device-routed playback → Task 2. ✓
- Player context/hook (desktop guard, events, controls) → Task 5. ✓
- Persistent bottom bar (art + title + 4 buttons, hidden when unavailable) → Task 6, mounted Task 7. ✓
- Wire existing play buttons w/ mobile fallback → Task 8. ✓
- Graceful non-Premium degradation → handled in Task 5 error listeners; verified Task 9 Step 5. ✓
- "What stays the same" (mobile deep link, token storage, onPlay) → preserved in Tasks 2 & 8. ✓
- Deferred (seek/volume/in-modal controls) → not implemented, per spec. ✓

**Placeholder scan:** No TBD/TODO. SDK type declarations and all component code shown in full.

**Type consistency:** `getValidAccessToken` return shape `{ access_token, expires_at }` matches `getSpotifyToken` (Task 3) and `getOAuthToken` usage (Task 5). `startPlayback(userId, uri, deviceId?)` matches the `play` route and `playOnSpotify(uri, deviceId?)`. `PlayerContextValue` members (`available`, `playAlbum`, `togglePlay`, `next`, `previous`, `currentTrack`, `paused`) are used identically in Tasks 6 and 8.
