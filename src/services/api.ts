import type {
  Item,
  SpotifySearchResult,
  LibraryAlbum,
  SpotifyPlaylistInfo,
  PickHistoryEntry,
  DashboardData,
  AppConfig,
  AlbumDetails,
} from "../types";
import { supabase } from "../lib/supabase";

const BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Albums ────────────────────────────────────────────────────────────────────

export async function getAlbums(listType?: "favorite" | "recommendation"): Promise<{ items: Item[] }> {
  const query = listType ? `?list_type=${listType}` : "";
  return request<{ items: Item[] }>(`/albums${query}`);
}

export async function addAlbum(data: {
  spotify_id: string;
  title: string;
  artist: string;
  image_url?: string;
  spotify_uri?: string;
  spotify_url?: string;
  list_type: "favorite" | "recommendation";
}): Promise<{ item: Item }> {
  return request<{ item: Item }>("/albums", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAlbum(id: number): Promise<void> {
  await request(`/albums/${id}`, { method: "DELETE" });
}

export async function promoteAlbum(id: number): Promise<void> {
  await request(`/albums/${id}`, { method: "POST" });
}

export async function moveAlbum(
  id: number,
  listType: "favorite" | "recommendation"
): Promise<void> {
  await request(`/albums/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ list_type: listType }),
  });
}

export async function searchSpotify(
  query: string
): Promise<{ albums: SpotifySearchResult[] }> {
  return request<{ albums: SpotifySearchResult[] }>(
    `/albums/search?q=${encodeURIComponent(query)}`
  );
}

// ── Spotify Import ───────────────────────────────────────────────────────────

export async function getSpotifyLibrary(
  limit = 50,
  offset = 0
): Promise<{ albums: LibraryAlbum[]; total: number }> {
  return request<{ albums: LibraryAlbum[]; total: number }>(
    `/spotify/library?limit=${limit}&offset=${offset}`
  );
}

export async function getSpotifyPlaylists(
  limit = 50,
  offset = 0
): Promise<{ playlists: SpotifyPlaylistInfo[]; total: number }> {
  return request<{ playlists: SpotifyPlaylistInfo[]; total: number }>(
    `/spotify/playlists?limit=${limit}&offset=${offset}`
  );
}

export async function getPlaylistAlbums(
  playlistId: string
): Promise<{ albums: LibraryAlbum[] }> {
  return request<{ albums: LibraryAlbum[] }>(
    `/spotify/playlists/${playlistId}/albums`
  );
}

export async function bulkAddAlbums(
  albums: SpotifySearchResult[],
  listType: "favorite" | "recommendation"
): Promise<{ added: number }> {
  return request<{ added: number }>("/albums/bulk", {
    method: "POST",
    body: JSON.stringify({
      albums: albums.map((a) => ({
        spotify_id: a.spotify_id,
        title: a.title,
        artist: a.artist,
        image_url: a.image_url,
        spotify_uri: a.spotify_uri,
        spotify_url: a.spotify_url,
      })),
      list_type: listType,
    }),
  });
}

// ── Album Details ────────────────────────────────────────────────────────────

export async function getAlbumDetails(spotifyId: string): Promise<AlbumDetails> {
  return request<AlbumDetails>(`/albums/${spotifyId}`);
}

// ── Picks / Dashboard ─────────────────────────────────────────────────────────

export async function getDashboard(context?: string, exclude?: string[]): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (context) params.set("context", context);
  if (exclude?.length) params.set("exclude", exclude.join(","));
  const query = params.toString();
  return request<DashboardData>(`/picks/dashboard${query ? `?${query}` : ""}`);
}

export async function getDashboardMode(mode: string, context: string): Promise<DashboardData> {
  const params = new URLSearchParams({ mode, context });
  return request<DashboardData>(`/picks/dashboard?${params}`);
}

export async function recordPick(data: {
  item_id: number;
  mode: string;
  context?: string;
}): Promise<void> {
  await request("/picks", { method: "POST", body: JSON.stringify(data) });
}

export async function getHistory(
  limit = 50,
  offset = 0
): Promise<{ history: PickHistoryEntry[] }> {
  return request<{ history: PickHistoryEntry[] }>(
    `/picks?limit=${limit}&offset=${offset}`
  );
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<{ config: AppConfig }> {
  return request<{ config: AppConfig }>("/config");
}

export async function updateConfig(
  updates: Partial<AppConfig>
): Promise<{ config: AppConfig }> {
  return request<{ config: AppConfig }>("/config", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}
