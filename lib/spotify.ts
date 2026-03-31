import { getUserById, updateTokens } from "./queries";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string; width: number; height: number }[];
  external_urls: { spotify: string };
  uri: string;
  genres?: string[];
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

export async function searchAlbums(
  userId: number,
  query: string,
  limit = 20
): Promise<SpotifyAlbum[]> {
  const params = new URLSearchParams({ q: query, type: "album", limit: String(limit) });
  const res = await spotifyFetch(userId, `/search?${params}`);
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
  const data = (await res.json()) as { albums: { items: SpotifyAlbum[] } };
  return data.albums.items;
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
): Promise<{ spotify_id: string; name: string; artists: { name: string }[]; images: SpotifyAlbum["images"]; external_urls: { spotify: string }; uri: string }[]> {
  const seen = new Set<string>();
  const albums: { spotify_id: string; name: string; artists: { name: string }[]; images: SpotifyAlbum["images"]; external_urls: { spotify: string }; uri: string }[] = [];
  let offset = 0;
  const limit = 100;

  while (offset < MAX_PLAYLIST_TRACKS) {
    const fields = "items(track(type,album(id,name,artists(name),images,external_urls,uri))),total";
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
      if (seen.has(track.album.id)) continue;
      seen.add(track.album.id);
      albums.push({
        spotify_id: track.album.id,
        name: track.album.name,
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
