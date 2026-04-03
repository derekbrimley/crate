import { getUserById, updateTokens } from "./queries";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

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
  const data = (await res.json()) as { access_token: string };
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

export async function fetchAlbumGenres(
  albumId: string
): Promise<string[]> {
  // Step 1: get artist IDs from the album
  const albumRes = await spotifyPublicFetch(`/albums/${albumId}?fields=artists(id)`);
  if (!albumRes.ok) throw new Error(`Failed to fetch album: ${albumRes.status}`);
  const albumData = (await albumRes.json()) as SpotifyAlbumDetail;
  const artistIds = albumData.artists.map((a) => a.id).filter(Boolean);
  if (artistIds.length === 0) return [];

  // Step 2: batch-fetch artist genres (up to 50 per request)
  const params = new URLSearchParams({ ids: artistIds.slice(0, 50).join(",") });
  const artistRes = await spotifyPublicFetch(`/artists?${params}`);
  if (!artistRes.ok) throw new Error(`Failed to fetch artists: ${artistRes.status}`);
  const artistData = (await artistRes.json()) as { artists: SpotifyArtistDetail[] };

  const genres = new Set<string>();
  for (const artist of artistData.artists ?? []) {
    for (const g of artist.genres ?? []) genres.add(g);
  }
  return Array.from(genres);
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
