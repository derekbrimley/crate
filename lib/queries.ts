import { supabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_CONFIG } from "./defaults";
import type { User, Item, Pick, LastPickInfo } from "./types";

// ── Config ────────────────────────────────────────────────────────────────────

export async function getAllConfig(userId: number): Promise<Record<string, unknown>> {
  const { data } = await supabaseAdmin
    .from("user_config")
    .select("key, value")
    .eq("user_id", userId);

  const result: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const row of data ?? []) {
    result[row.key] = row.value;
  }
  return result;
}

export async function setConfig(userId: number, key: string, value: unknown): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await supabaseAdmin.from("user_config").upsert(
    { user_id: userId, key, value, updated_at: now },
    { onConflict: "user_id,key" }
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function upsertUser(
  supabaseUid: string,
  spotifyId: string,
  displayName: string | null,
  email: string | null,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        supabase_uid: supabaseUid,
        spotify_id: spotifyId,
        display_name: displayName,
        email,
        spotify_access_token: accessToken,
        spotify_refresh_token: refreshToken,
        token_expires_at: expiresAt,
      },
      { onConflict: "spotify_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

export async function getUserById(id: number): Promise<User | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  return (data as User) ?? null;
}

export async function updateTokens(
  userId: number,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<void> {
  await supabaseAdmin
    .from("users")
    .update({
      spotify_access_token: accessToken,
      spotify_refresh_token: refreshToken,
      token_expires_at: expiresAt,
    })
    .eq("id", userId);
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function addItem(
  userId: number,
  listType: "favorite" | "recommendation",
  title: string,
  creator: string,
  imageUrl: string | null,
  externalId: string,
  externalUri: string | null,
  externalUrl: string | null,
  metadata: Record<string, unknown> | null = null
): Promise<Item> {
  const now = Math.floor(Date.now() / 1000);
  const { data, error } = await supabaseAdmin
    .from("items")
    .upsert(
      {
        user_id: userId,
        media_type: "album",
        list_type: listType,
        title,
        creator,
        image_url: imageUrl,
        external_id: externalId,
        external_uri: externalUri,
        external_url: externalUrl,
        added_at: now,
        metadata,
      },
      { onConflict: "user_id,external_id,media_type" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Item;
}

export async function bulkAddItems(
  userId: number,
  listType: "favorite" | "recommendation",
  albums: {
    title: string;
    creator: string;
    image_url: string | null;
    external_id: string;
    external_uri: string | null;
    external_url: string | null;
  }[]
): Promise<number> {
  if (albums.length === 0) return 0;

  const now = Math.floor(Date.now() / 1000);
  const rows = albums.map((a) => ({
    user_id: userId,
    media_type: "album" as const,
    list_type: listType,
    title: a.title,
    creator: a.creator,
    image_url: a.image_url,
    external_id: a.external_id,
    external_uri: a.external_uri,
    external_url: a.external_url,
    added_at: now,
    metadata: null,
  }));

  const { data, error } = await supabaseAdmin
    .from("items")
    .upsert(rows, { onConflict: "user_id,external_id,media_type" })
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

export async function getItems(
  userId: number,
  listType?: "favorite" | "recommendation"
): Promise<Item[]> {
  let query = supabaseAdmin
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (listType) {
    query = query.eq("list_type", listType);
  }

  const { data } = await query;
  return (data ?? []) as Item[];
}

export async function deleteItem(userId: number, itemId: number): Promise<void> {
  await supabaseAdmin
    .from("items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);
}

export async function promoteItem(userId: number, itemId: number): Promise<void> {
  await supabaseAdmin
    .from("items")
    .update({ list_type: "favorite" })
    .eq("id", itemId)
    .eq("user_id", userId);
}

// ── Picks ─────────────────────────────────────────────────────────────────────

export async function recordPick(
  userId: number,
  itemId: number,
  mode: string,
  context: string | null = null
): Promise<Pick> {
  const now = Math.floor(Date.now() / 1000);
  const { data, error } = await supabaseAdmin
    .from("picks")
    .insert({ user_id: userId, item_id: itemId, mode, context, picked_at: now })
    .select()
    .single();

  if (error) throw error;
  return data as Pick;
}

export async function getPickHistory(
  userId: number,
  limit = 100,
  offset = 0
): Promise<unknown[]> {
  const { data, error } = await supabaseAdmin.rpc("get_pick_history", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data ?? [];
}

export async function getLastPicksForUser(userId: number): Promise<LastPickInfo[]> {
  const { data } = await supabaseAdmin
    .from("picks")
    .select("item_id, picked_at")
    .eq("user_id", userId);

  if (!data) return [];

  // Group by item_id client-side (no GROUP BY in Supabase PostgREST directly)
  const map = new Map<number, { picked_at: number; pick_count: number }>();
  for (const row of data) {
    const existing = map.get(row.item_id);
    if (!existing || row.picked_at > existing.picked_at) {
      map.set(row.item_id, {
        picked_at: Math.max(row.picked_at, existing?.picked_at ?? 0),
        pick_count: (existing?.pick_count ?? 0) + 1,
      });
    } else {
      map.set(row.item_id, {
        picked_at: existing.picked_at,
        pick_count: existing.pick_count + 1,
      });
    }
  }

  return Array.from(map.entries()).map(([item_id, { picked_at, pick_count }]) => ({
    item_id,
    picked_at,
    pick_count,
  }));
}
