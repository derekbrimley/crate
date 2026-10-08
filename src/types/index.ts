import type { CrateDefinition } from "../../lib/crates";

export interface User {
  id: number;
  displayName: string | null;
  email: string | null;
  spotifyId: string | null;
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
  metadata: Record<string, unknown> | string | null;
}

export interface SpotifySearchResult {
  spotify_id: string;
  title: string;
  artist: string;
  image_url: string | null;
  spotify_uri: string;
  spotify_url: string;
  total_tracks?: number;
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

export type MediaType = "album" | "playlist";

export interface LibraryAlbum extends SpotifySearchResult {
  /** Absent on endpoints that only ever return albums. */
  media_type?: MediaType;
  total_tracks?: number;
  release_date?: string;
  already_added: "favorite" | "recommendation" | null;
}

export interface SpotifyPlaylistInfo {
  id: string;
  name: string;
  image_url: string | null;
  track_count: number;
  owner: string;
  uri: string;
  url: string;
  /** Whether the playlist itself is saved to the library, and on which list. */
  already_added: "favorite" | "recommendation" | null;
}

export interface AlbumTrack {
  number: number;
  disc: number;
  name: string;
  duration_ms: number;
  artists: string;
  uri: string;
}

export interface ArtistAlbum {
  spotify_id: string;
  title: string;
  artist: string;
  image_url: string | null;
  spotify_uri: string;
  spotify_url: string;
  total_tracks: number;
  release_date: string;
  popularity: number;
  already_added: "favorite" | "recommendation" | null;
}

export interface SentRecommendation {
  recipient_name: string | null;
  recipient_email: string | null;
  sent_at: number;
  status: string;
}

export interface PlaylistInfo {
  owner: string | null;
  description: string | null;
  total_tracks: number;
}

export interface AlbumDetails {
  tracks: AlbumTrack[];
  artist_albums: ArtistAlbum[];
  genres: string[];
  sent_to: SentRecommendation[];
  /** Present only for playlists. Their track `number` is the playlist position. */
  playlist?: PlaylistInfo;
}

// Crates are defined once, in lib/crates.ts, and shared with the server.
export type { CrateDefinition, CrateFilters, Membership } from "../../lib/crates";

export interface PickStat {
  item_id: number;
  picked_at: number;
  pick_count: number;
}

export interface DashboardData {
  crates?: { id: string; items: Item[]; deferred?: boolean }[];
  _config?: AppConfig;
  _picks?: PickStat[];
}

export interface FriendRecommendation {
  id: number;
  sender_id: number;
  recipient_id: number;
  title: string;
  creator: string;
  image_url: string | null;
  external_id: string;
  external_uri: string | null;
  external_url: string | null;
  metadata: Record<string, unknown> | null;
  status: "pending" | "accepted" | "dismissed";
  sent_at: number;
  acted_at: number | null;
  sender_display_name: string | null;
  sender_email: string | null;
}

export interface AppConfig {
  crates?: CrateDefinition[];
  [key: string]: unknown;
}

/** A Spotify Connect target — a phone, tablet, desktop app, speaker, etc. */
export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
  supports_volume: boolean;
}

/** The album a currently-playing track belongs to, as reported by Spotify. */
export interface PlayingAlbum {
  id: string;
  name: string;
  artist: string;
  image_url: string | null;
  uri: string;
  url: string | null;
}

export interface PlaybackState {
  playing: {
    uri: string;
    name: string;
    artist: string;
    image_url: string | null;
    duration: number;
    position: number;
    paused: boolean;
    // The album this track belongs to — null for podcast episodes.
    album: PlayingAlbum | null;
  } | null;
  device: {
    id: string;
    name: string;
    type: string;
    volume_percent: number | null;
    supports_volume: boolean;
  } | null;
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
