export interface User {
  id: number;
  supabase_uid: string;
  spotify_id: string;
  display_name: string | null;
  email: string | null;
  spotify_access_token: string | null;
  spotify_refresh_token: string | null;
  token_expires_at: number | null;
  created_at: string;
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
  metadata: Record<string, unknown> | null;
}

export interface Pick {
  id: number;
  user_id: number;
  item_id: number;
  mode: string;
  context: string | null;
  picked_at: number;
}

export interface LastPickInfo {
  item_id: number;
  picked_at: number;
  pick_count: number;
}

export interface RightNowContext {
  key: string;
  label: string;
  emoji: string;
  prefer_genres: string[];
  avoid_genres: string[];
  prompt_hints: string;
}
