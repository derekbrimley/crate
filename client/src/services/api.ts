import type {
  User,
  Item,
  SpotifySearchResult,
  PickHistoryEntry,
  DashboardData,
  AppConfig,
} from "../types";

const BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function getMe(): Promise<{ user: User | null }> {
  return request<{ user: User | null }>("/auth/me");
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

export function getLoginUrl(): string {
  return `${BASE}/auth/login`;
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
  await request(`/albums/${id}/promote`, { method: "POST" });
}

export async function searchSpotify(
  query: string
): Promise<{ albums: SpotifySearchResult[] }> {
  return request<{ albums: SpotifySearchResult[] }>(
    `/albums/search?q=${encodeURIComponent(query)}`
  );
}

// ── Picks / Dashboard ─────────────────────────────────────────────────────────

export async function getDashboard(context?: string): Promise<DashboardData> {
  const query = context ? `?context=${encodeURIComponent(context)}` : "";
  return request<DashboardData>(`/picks/dashboard${query}`);
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
    `/picks/history?limit=${limit}&offset=${offset}`
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
