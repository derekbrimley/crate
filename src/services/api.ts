import type {
  Item,
  SpotifySearchResult,
  LibraryAlbum,
  SpotifyPlaylistInfo,
  PickHistoryEntry,
  DashboardData,
  AppConfig,
  AlbumDetails,
  CrateDefinition,
  SpotifyDevice,
  PlaybackState,
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
    // Surface the server's structured error (message + code) when there is one so
    // callers can branch on cases like NO_DEVICE instead of matching strings.
    let message = `API error ${res.status}: ${body}`;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(body) as { error?: string; code?: string };
      if (parsed.error) message = parsed.error;
      code = parsed.code;
    } catch { /* non-JSON body — keep the raw text */ }
    throw Object.assign(new Error(message), { status: res.status, code });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Albums ────────────────────────────────────────────────────────────────────

export async function getAlbums(listType?: "favorite" | "recommendation"): Promise<{ items: Item[] }> {
  const query = listType ? `?list_type=${listType}` : "";
  return request<{ items: Item[] }>(`/albums${query}`);
}

/** Returns the user's library row for a Spotify album id, or null if they don't have it. */
export async function lookupAlbum(externalId: string): Promise<{ item: Item | null }> {
  return request<{ item: Item | null }>(`/albums?external_id=${encodeURIComponent(externalId)}`);
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
): Promise<{ albums: LibraryAlbum[] }> {
  return request<{ albums: LibraryAlbum[] }>(
    `/albums/search?q=${encodeURIComponent(query)}`
  );
}

export async function backfillReleaseDates(): Promise<{ updated: number }> {
  return request<{ updated: number }>("/albums/backfill", { method: "POST" });
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

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/picks/dashboard");
}

export async function getDashboardCrate(crateId: string): Promise<DashboardData> {
  const params = new URLSearchParams({ crateId });
  return request<DashboardData>(`/picks/dashboard?${params}`);
}

export async function playOnSpotify(
  spotifyUri: string,
  deviceId?: string,
  positionOffset?: number,
  opts: { waitForDevice?: boolean } = {}
): Promise<void> {
  await request("/spotify/play", {
    method: "PUT",
    // keepalive lets the request survive the page being backgrounded, which is
    // exactly what happens when we deep-link into the Spotify app alongside it.
    keepalive: opts.waitForDevice,
    body: JSON.stringify({
      spotify_uri: spotifyUri,
      ...(deviceId ? { device_id: deviceId } : {}),
      ...(typeof positionOffset === "number" ? { offset: positionOffset } : {}),
      ...(opts.waitForDevice ? { wait_for_device: true } : {}),
    }),
  });
}

export async function getSpotifyDevices(): Promise<{ devices: SpotifyDevice[] }> {
  return request<{ devices: SpotifyDevice[] }>("/spotify/devices");
}

export async function getPlaybackState(): Promise<PlaybackState> {
  return request<PlaybackState>("/spotify/state");
}

export async function controlPlayback(
  action: "resume" | "pause" | "next" | "previous" | "seek" | "volume",
  deviceId?: string,
  value?: number
): Promise<void> {
  await request("/spotify/control", {
    method: "PUT",
    body: JSON.stringify({
      action,
      ...(deviceId ? { device_id: deviceId } : {}),
      ...(typeof value === "number" ? { value } : {}),
    }),
  });
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

// ── Friend Recommendations ───────────────────────────────────────────────────

export async function sendRecommendation(data: {
  email: string;
  album: {
    title: string;
    creator: string;
    image_url: string | null;
    external_id: string;
    external_uri: string | null;
    external_url: string | null;
  };
}): Promise<{ recommendation: unknown }> {
  return request<{ recommendation: unknown }>("/recommendations", {
    method: "POST",
    body: JSON.stringify({ action: "send", ...data }),
  });
}

export async function getRecentRecipients(): Promise<{ recipients: { display_name: string | null; email: string | null }[] }> {
  return request<{ recipients: { display_name: string | null; email: string | null }[] }>("/recommendations?type=recipients");
}

export async function actOnRecommendation(
  recId: number,
  action: "accept" | "dismiss"
): Promise<{ ok: true }> {
  return request<{ ok: true }>("/recommendations", {
    method: "POST",
    body: JSON.stringify({ action, rec_id: recId }),
  });
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

export async function saveCrates(crates: CrateDefinition[]): Promise<{ config: AppConfig }> {
  return request<{ config: AppConfig }>("/config", {
    method: "PATCH",
    body: JSON.stringify({ crates }),
  });
}
