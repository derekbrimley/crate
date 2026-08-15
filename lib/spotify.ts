import { getUserById, updateTokens } from "./queries";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

let cachedCCToken: string | null = null;
let cachedCCTokenExpiresAt: number = 0;

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  total_tracks: number;
  release_date: string;
  artists: { name: string }[];
  images: { url: string; width: number; height: number }[];
  external_urls: { spotify: string };
  uri: string;
  genres?: string[];
  popularity?: number;
}

async function refreshAccessToken(userId: number): Promise<string> {
  const user = await getUserById(userId);
  if (!user?.spotify_refresh_token) throw new Error("No refresh token");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: user.spotify_refresh_token,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await updateTokens(
    userId,
    data.access_token,
    data.refresh_token || user.spotify_refresh_token,
    expiresAt
  );

  return data.access_token;
}

async function getAccessToken(userId: number): Promise<string> {
  const user = await getUserById(userId);
  if (!user?.spotify_access_token) throw new Error("Not authenticated");

  if (user.token_expires_at && user.token_expires_at - 60 < Math.floor(Date.now() / 1000)) {
    return refreshAccessToken(userId);
  }

  return user.spotify_access_token;
}

async function spotifyFetch(
  userId: number,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken(userId);
  const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken(userId);
    return fetch(`${SPOTIFY_API}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 30;
    const err = new Error(`Spotify rate limited. Try again in ${seconds} seconds.`) as Error & { retryAfter: number };
    err.retryAfter = seconds;
    throw err;
  }

  return res;
}

async function getClientCredentialsToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedCCToken && now < cachedCCTokenExpiresAt - 60) {
    return cachedCCToken;
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify CC token fetch failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedCCToken = data.access_token;
  cachedCCTokenExpiresAt = now + data.expires_in;
  return data.access_token;
}

async function spotifyPublicFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = await getClientCredentialsToken();
  return fetch(`${SPOTIFY_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export async function searchAlbums(
  query: string,
  limit = 20
): Promise<SpotifyAlbum[]> {
  const params = new URLSearchParams({ q: query, type: "album", limit: String(limit) });
  const res = await spotifyPublicFetch(`/search?${params}`);
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
  const data = (await res.json()) as { albums: { items: SpotifyAlbum[] } };
  return data.albums.items.filter((a) => a.album_type !== "single");
}

export interface SpotifySavedAlbum {
  added_at: string;
  album: SpotifyAlbum;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  tracks: { total: number };
  owner: { display_name: string };
}

export async function getSavedAlbums(
  userId: number,
  limit = 50,
  offset = 0
): Promise<{ items: SpotifySavedAlbum[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await spotifyFetch(userId, `/me/albums?${params}`);
  if (!res.ok) throw new Error(`Spotify library fetch failed: ${res.status}`);
  const data = (await res.json()) as { items: SpotifySavedAlbum[]; total: number };
  return { items: data.items, total: data.total };
}

export async function getUserPlaylists(
  userId: number,
  limit = 50,
  offset = 0
): Promise<{ items: SpotifyPlaylist[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await spotifyFetch(userId, `/me/playlists?${params}`);
  if (!res.ok) throw new Error(`Spotify playlists fetch failed: ${res.status}`);
  const data = (await res.json()) as { items: SpotifyPlaylist[]; total: number };
  return { items: data.items, total: data.total };
}

const MAX_PLAYLIST_TRACKS = 500;

export async function getPlaylistAlbums(
  userId: number,
  playlistId: string
): Promise<{ spotify_id: string; name: string; total_tracks: number; artists: { name: string }[]; images: SpotifyAlbum["images"]; external_urls: { spotify: string }; uri: string }[]> {
  const seen = new Set<string>();
  const albums: { spotify_id: string; name: string; total_tracks: number; artists: { name: string }[]; images: SpotifyAlbum["images"]; external_urls: { spotify: string }; uri: string }[] = [];
  let offset = 0;
  const limit = 100;

  while (offset < MAX_PLAYLIST_TRACKS) {
    const fields = "items(track(type,album(id,name,album_type,total_tracks,artists(name),images,external_urls,uri))),total";
    const params = new URLSearchParams({ fields, limit: String(limit), offset: String(offset) });
    const res = await spotifyFetch(userId, `/playlists/${playlistId}/tracks?${params}`);
    if (!res.ok) throw new Error(`Spotify playlist tracks failed: ${res.status}`);

    const data = (await res.json()) as {
      items: { track: { type: string; album: SpotifyAlbum | null } | null }[];
      total: number;
    };

    for (const item of data.items) {
      const track = item.track;
      if (!track || track.type !== "track" || !track.album?.id) continue;
      if (track.album.album_type === "single") continue;
      if (seen.has(track.album.id)) continue;
      seen.add(track.album.id);
      albums.push({
        spotify_id: track.album.id,
        name: track.album.name,
        total_tracks: track.album.total_tracks,
        artists: track.album.artists,
        images: track.album.images,
        external_urls: track.album.external_urls,
        uri: track.album.uri,
      });
    }

    offset += limit;
    if (offset >= data.total) break;
  }

  return albums;
}

export function getBestImageUrl(images: SpotifyAlbum["images"]): string | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0].url;
}

// ── Artist Genres ────────────────────────────────────────────────────────────
// Spotify deprecated /audio-features for apps created after Nov 2024.
// Artist genres are still available and work well for context-based filtering.

interface SpotifyAlbumDetail {
  artists: { id: string }[];
}

interface SpotifyArtistDetail {
  id: string;
  genres: string[];
}

// ── Album Tracks ────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string;
  name: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
  artists: { name: string }[];
  uri: string;
}

export async function getAlbumTracks(
  albumId: string
): Promise<SpotifyTrack[]> {
  const res = await spotifyPublicFetch(`/albums/${albumId}/tracks?limit=50`);
  if (!res.ok) throw new Error(`Failed to fetch album tracks: ${res.status}`);
  const data = (await res.json()) as { items: SpotifyTrack[] };
  return data.items;
}

// ── Artist Albums ───────────────────────────────────────────────────────────

export async function getArtistAlbums(
  artistId: string
): Promise<SpotifyAlbum[]> {
  const params = new URLSearchParams({ include_groups: "album", limit: "20" });
  const res = await spotifyPublicFetch(`/artists/${artistId}/albums?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch artist albums: ${res.status}`);
  const data = (await res.json()) as { items: SpotifyAlbum[] };
  return data.items;
}

export async function getAlbumsBatch(ids: string[]): Promise<SpotifyAlbum[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.slice(0, 20).join(",") });
  const res = await spotifyPublicFetch(`/albums?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch albums batch: ${res.status}`);
  const data = (await res.json()) as { albums: SpotifyAlbum[] };
  return data.albums.filter(Boolean);
}

// ── Album Detail (full album with artist IDs) ──────────────────────────────

export async function getAlbumFull(
  albumId: string
): Promise<SpotifyAlbum & { artists: { id: string; name: string }[] }> {
  const res = await spotifyPublicFetch(`/albums/${albumId}`);
  if (!res.ok) throw new Error(`Failed to fetch album: ${res.status}`);
  return (await res.json()) as SpotifyAlbum & { artists: { id: string; name: string }[] };
}

export async function fetchAlbumMeta(
  albumId: string
): Promise<{ genres: string[]; release_date: string | null; total_tracks: number | null }> {
  // Single album fetch gives us artist IDs (for genres), the release date, and track count.
  const albumRes = await spotifyPublicFetch(`/albums/${albumId}?fields=artists(id),release_date,total_tracks`);
  if (!albumRes.ok) throw new Error(`Failed to fetch album: ${albumRes.status}`);
  const albumData = (await albumRes.json()) as SpotifyAlbumDetail & { release_date?: string; total_tracks?: number };
  const release_date = albumData.release_date ?? null;
  const total_tracks = typeof albumData.total_tracks === "number" ? albumData.total_tracks : null;

  const artistIds = albumData.artists.map((a) => a.id).filter(Boolean);
  if (artistIds.length === 0) return { genres: [], release_date, total_tracks };

  const params = new URLSearchParams({ ids: artistIds.slice(0, 50).join(",") });
  const artistRes = await spotifyPublicFetch(`/artists?${params}`);
  if (!artistRes.ok) throw new Error(`Failed to fetch artists: ${artistRes.status}`);
  const artistData = (await artistRes.json()) as { artists: SpotifyArtistDetail[] };

  const genres = new Set<string>();
  for (const artist of artistData.artists ?? []) {
    for (const g of artist.genres ?? []) genres.add(g);
  }
  return { genres: Array.from(genres), release_date, total_tracks };
}

export async function fetchAlbumGenres(albumId: string): Promise<string[]> {
  return (await fetchAlbumMeta(albumId)).genres;
}

export interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
  supports_volume: boolean;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  device: SpotifyDevice | null;
  item: {
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { images: { url: string; width: number; height: number }[] };
  } | null;
}

/** Thrown when playback needs a device but none is available on the account. */
export class NoDeviceError extends Error {
  code = "NO_DEVICE" as const;
  constructor() {
    super("No Spotify device found. Open Spotify on your phone, tablet, or desktop app, then try again.");
  }
}

export async function getDevices(userId: number): Promise<SpotifyDevice[]> {
  const res = await spotifyFetch(userId, "/me/player/devices");
  if (!res.ok) throw new Error(`Spotify devices fetch failed: ${res.status}`);
  const data = (await res.json()) as { devices?: SpotifyDevice[] };
  // Restricted devices reject Web API commands, and id-less devices can't be targeted.
  return (data.devices ?? []).filter((d) => d.id && !d.is_restricted);
}

export async function getPlaybackState(
  userId: number
): Promise<SpotifyPlaybackState | null> {
  const res = await spotifyFetch(userId, "/me/player");
  // 204 = nothing is playing and no device is active.
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify playback state failed: ${res.status}`);
  return (await res.json()) as SpotifyPlaybackState;
}

export async function startPlayback(
  userId: number,
  spotifyUri: string,
  deviceId?: string,
  positionOffset?: number
): Promise<void> {
  const payload: Record<string, unknown> = { context_uri: spotifyUri };
  if (typeof positionOffset === "number" && positionOffset >= 0) {
    payload.offset = { position: positionOffset };
  }
  const body = JSON.stringify(payload);
  const endpoint = deviceId
    ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : "/me/player/play";
  const res = await spotifyFetch(userId, endpoint, {
    method: "PUT",
    body,
  });
  if (res.status === 404) {
    throw new NoDeviceError();
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to start playback: ${res.status}`);
  }
}

/**
 * Start an album once a usable device shows up, waiting up to `timeoutMs`.
 *
 * Spotify only lists devices whose app is currently open, so a phone with
 * Spotify closed has nothing to play on. The client deep-links into the Spotify
 * app to wake it and calls this in parallel; a second or two later the app
 * registers as a device and playback starts on it. Waiting here rather than in
 * the browser matters because the browser is backgrounded the moment the
 * Spotify app comes to the foreground, which suspends its timers.
 */
export async function startPlaybackWhenReady(
  userId: number,
  spotifyUri: string,
  positionOffset?: number,
  timeoutMs = 8000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  const listDevices = async (): Promise<SpotifyDevice[]> => {
    try {
      return (await getDevices(userId)).filter((d) => !isWebPlayerDevice(d));
    } catch (err) {
      lastError = err;
      return [];
    }
  };

  // Devices already online before the app was woken. A device that appears
  // after this snapshot is the one the user just deep-linked into, which is a
  // far better target than, say, a desktop Spotify idling at home.
  const known = new Set((await listDevices()).map((d) => d.id));
  let devices: SpotifyDevice[] = [];

  for (;;) {
    devices = await listDevices();
    const target =
      devices.find((d) => d.id && !known.has(d.id)) ?? devices.find((d) => d.is_active);
    if (target?.id) {
      try {
        await startPlayback(userId, spotifyUri, target.id, positionOffset);
        return;
      } catch (err) {
        // The app registered but isn't ready to accept playback yet; keep trying.
        lastError = err;
      }
    }
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 600));
  }

  // Nothing woke up and nothing is active. Only fall back to an idle device when
  // it's unambiguous — guessing among several risks playing in the wrong room.
  if (devices.length === 1 && devices[0].id) {
    return startPlayback(userId, spotifyUri, devices[0].id, positionOffset);
  }

  if (lastError === null || lastError instanceof NoDeviceError) throw new NoDeviceError();
  throw lastError;
}

/** Browser-tab players cap at 256kbps, so they're never a playback target. */
export function isWebPlayerDevice(device: { name: string }): boolean {
  return /web player/i.test(device.name ?? "");
}

export type PlayerAction = "resume" | "pause" | "next" | "previous" | "seek" | "volume";

const PLAYER_COMMANDS: Record<PlayerAction, { method: string; path: string; param?: string }> = {
  resume:   { method: "PUT",  path: "/me/player/play" },
  pause:    { method: "PUT",  path: "/me/player/pause" },
  next:     { method: "POST", path: "/me/player/next" },
  previous: { method: "POST", path: "/me/player/previous" },
  seek:     { method: "PUT",  path: "/me/player/seek",   param: "position_ms" },
  volume:   { method: "PUT",  path: "/me/player/volume", param: "volume_percent" },
};

/**
 * Send a transport command to a Spotify device. Unlike the old Web Playback SDK
 * path, these are remote-control calls — the audio is rendered by the target
 * device (phone/tablet/desktop app), which is what allows lossless playback.
 */
export async function controlPlayback(
  userId: number,
  action: PlayerAction,
  deviceId?: string,
  value?: number
): Promise<void> {
  const command = PLAYER_COMMANDS[action];
  if (!command) throw new Error(`Unknown player action: ${action}`);

  const params = new URLSearchParams();
  if (command.param) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${action} requires a numeric value`);
    }
    params.set(command.param, String(Math.round(value)));
  }
  if (deviceId) params.set("device_id", deviceId);
  const query = params.toString();

  const res = await spotifyFetch(userId, `${command.path}${query ? `?${query}` : ""}`, {
    method: command.method,
  });
  if (res.status === 404) throw new NoDeviceError();
  // 403 covers "already playing/paused" and devices that disallow the command
  // (iOS rejects remote volume changes). Neither is worth failing the click over.
  if (res.status === 403) return;
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to ${action}: ${res.status}`);
  }
}

export async function getArtistGenres(artistIds: string[]): Promise<string[]> {
  if (artistIds.length === 0) return [];
  const params = new URLSearchParams({ ids: artistIds.slice(0, 50).join(",") });
  const res = await spotifyPublicFetch(`/artists?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { artists: SpotifyArtistDetail[] };
  const genres = new Set<string>();
  for (const artist of data.artists ?? []) {
    for (const g of artist.genres ?? []) genres.add(g);
  }
  return Array.from(genres);
}
