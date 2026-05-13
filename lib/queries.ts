import { supabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_CONFIG } from "./defaults";
import type { User, Item, Pick, LastPickInfo, FriendRecommendation } from "./types";

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
  displayName: string | null,
  email: string | null
): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert(
      { supabase_uid: supabaseUid, display_name: displayName, email },
      { onConflict: "supabase_uid" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

export async function saveSpotifyTokens(
  supabaseUid: string,
  spotifyId: string,
  displayName: string | null,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<void> {
  await supabaseAdmin
    .from("users")
    .update({
      spotify_id: spotifyId,
      display_name: displayName,
      spotify_access_token: accessToken,
      spotify_refresh_token: refreshToken,
      token_expires_at: expiresAt,
    })
    .eq("supabase_uid", supabaseUid);
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
    metadata?: Record<string, unknown> | null;
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
    metadata: a.metadata ?? null,
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

export async function updateItemListType(
  userId: number,
  itemId: number,
  listType: "favorite" | "recommendation"
): Promise<void> {
  await supabaseAdmin
    .from("items")
    .update({ list_type: listType })
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
  const { data, error } = await supabaseAdmin.rpc("get_last_picks_for_user", {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data ?? []) as LastPickInfo[];
}

// ── Friend Recommendations ───────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .single();
  return (data as User) ?? null;
}

export async function sendFriendRecommendation(
  senderId: number,
  senderDisplayName: string | null,
  senderEmail: string | null,
  recipientId: number,
  album: {
    title: string;
    creator: string;
    image_url: string | null;
    external_id: string;
    external_uri: string | null;
    external_url: string | null;
    metadata?: Record<string, unknown> | null;
  }
): Promise<FriendRecommendation> {
  const now = Math.floor(Date.now() / 1000);
  const { data, error } = await supabaseAdmin
    .from("friend_recommendations")
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      title: album.title,
      creator: album.creator,
      image_url: album.image_url,
      external_id: album.external_id,
      external_uri: album.external_uri,
      external_url: album.external_url,
      metadata: album.metadata ?? null,
      status: "pending",
      sent_at: now,
      sender_display_name: senderDisplayName,
      sender_email: senderEmail,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FriendRecommendation;
}

export async function getPendingFriendRecommendations(
  recipientId: number,
  limit = 4
): Promise<FriendRecommendation[]> {
  const { data } = await supabaseAdmin
    .from("friend_recommendations")
    .select("*")
    .eq("recipient_id", recipientId)
    .eq("status", "pending")
    .order("sent_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as FriendRecommendation[];
}

export async function updateFriendRecommendationStatus(
  recipientId: number,
  recId: number,
  status: "accepted" | "dismissed"
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await supabaseAdmin
    .from("friend_recommendations")
    .update({ status, acted_at: now })
    .eq("id", recId)
    .eq("recipient_id", recipientId);
}

export async function getRecentRecipients(
  senderId: number
): Promise<{ display_name: string | null; email: string | null }[]> {
  const { data } = await supabaseAdmin
    .from("friend_recommendations")
    .select("recipient_id")
    .eq("sender_id", senderId)
    .order("sent_at", { ascending: false });

  if (!data || data.length === 0) return [];

  const seen = new Set<number>();
  const uniqueIds: number[] = [];
  for (const r of data) {
    if (!seen.has(r.recipient_id)) {
      seen.add(r.recipient_id);
      uniqueIds.push(r.recipient_id);
    }
  }

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("display_name, email")
    .in("id", uniqueIds);

  return (users ?? []) as { display_name: string | null; email: string | null }[];
}

export async function getSentRecommendationsForAlbum(
  senderId: number,
  externalId: string
): Promise<{ recipient_name: string | null; recipient_email: string | null; sent_at: number; status: string }[]> {
  const { data } = await supabaseAdmin
    .from("friend_recommendations")
    .select("recipient_id, sent_at, status")
    .eq("sender_id", senderId)
    .eq("external_id", externalId)
    .order("sent_at", { ascending: false });

  if (!data || data.length === 0) return [];

  const recipientIds = [...new Set(data.map((r) => r.recipient_id))];
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, display_name, email")
    .in("id", recipientIds);

  const userMap = new Map<number, { display_name: string | null; email: string | null }>();
  for (const u of users ?? []) {
    userMap.set(u.id, { display_name: u.display_name, email: u.email });
  }

  return data.map((r) => {
    const recipient = userMap.get(r.recipient_id);
    return {
      recipient_name: recipient?.display_name ?? null,
      recipient_email: recipient?.email ?? null,
      sent_at: r.sent_at,
      status: r.status,
    };
  });
}
