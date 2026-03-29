import { getUserById, updateTokens } from "../db/queries";

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
  const user = getUserById(userId);
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
  updateTokens(
    userId,
    data.access_token,
    data.refresh_token || user.spotify_refresh_token,
    expiresAt
  );

  return data.access_token;
}

async function getAccessToken(userId: number): Promise<string> {
  const user = getUserById(userId);
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

export async function getAlbum(userId: number, albumId: string): Promise<SpotifyAlbum> {
  const res = await spotifyFetch(userId, `/albums/${albumId}`);
  if (!res.ok) throw new Error(`Spotify album fetch failed: ${res.status}`);
  return res.json() as Promise<SpotifyAlbum>;
}

export async function getUserSavedAlbums(
  userId: number,
  limit = 50,
  offset = 0
): Promise<{ items: SpotifyAlbum[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await spotifyFetch(userId, `/me/albums?${params}`);
  if (!res.ok) throw new Error(`Spotify saved albums failed: ${res.status}`);
  const data = (await res.json()) as {
    items: { album: SpotifyAlbum }[];
    total: number;
  };
  return { items: data.items.map((i) => i.album), total: data.total };
}

export function getBestImageUrl(images: SpotifyAlbum["images"]): string | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0].url;
}
