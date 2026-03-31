export interface User {
  id: number;
  displayName: string | null;
  email: string | null;
  spotifyId: string;
}

export interface Item {
  id: number;
  user_id: number;
  media_type: string;
  list_type: "favorite" | "recommendation";
  title: string;
  creator: string;
  image_url: string | null;
  external_id: string;
  external_uri: string | null;
  external_url: string | null;
  added_at: number;
  metadata: string | null;
}

export interface SpotifySearchResult {
  spotify_id: string;
  title: string;
  artist: string;
  image_url: string | null;
  spotify_uri: string;
  spotify_url: string;
}

export interface PickHistoryEntry {
  id: number;
  mode: string;
  context: string | null;
  picked_at_ts: number;
  item_id: number;
  title: string;
  creator: string;
  image_url: string | null;
  external_id: string;
  external_uri: string | null;
  external_url: string | null;
  list_type: string;
}

export interface LibraryAlbum extends SpotifySearchResult {
  already_added: "favorite" | "recommendation" | null;
}

export interface SpotifyPlaylistInfo {
  id: string;
  name: string;
  image_url: string | null;
  track_count: number;
  owner: string;
}

export type DashboardMode = "favorites" | "discover" | "for_right_now" | "surprise";

export interface DashboardData {
  favorites?: Item[];
  discover?: Item[];
  for_right_now?: Item[];
  surprise?: Item[];
}

export interface AppConfig {
  dashboard_modes: string[];
  cards_per_mode: number;
  cooldown_days: number;
  weight_recent_days: number;
  weight_medium_days: number;
  weight_low: number;
  weight_medium: number;
  weight_high: number;
  weight_never_picked_bonus: number;
  contexts: string[];
  randomness_factor: number;
}

export const CONTEXT_LABELS: Record<string, { label: string; emoji: string }> = {
  driving: { label: "Driving", emoji: "🚗" },
  gym: { label: "Gym / Workout", emoji: "💪" },
  deep_work: { label: "Deep Work", emoji: "🧠" },
  cooking: { label: "Cooking", emoji: "🍳" },
  winding_down: { label: "Winding Down", emoji: "🌙" },
  hosting: { label: "Hosting / Party", emoji: "🎉" },
  morning: { label: "Morning", emoji: "☀️" },
  walking: { label: "Walking / Errands", emoji: "🚶" },
  chill: { label: "Chill / Background", emoji: "🧘" },
};
