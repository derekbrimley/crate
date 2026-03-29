import { getDb } from "./schema";
import { DEFAULT_CONFIG } from "../config/defaults";

// ── Config ────────────────────────────────────────────────────────────────────

const configCache = new Map<string, Map<string, unknown>>();

export function getConfig<T>(userId: number, key: string): T {
  if (!configCache.has(String(userId))) {
    configCache.set(String(userId), new Map());
  }
  const cache = configCache.get(String(userId))!;
  if (cache.has(key)) return cache.get(key) as T;

  const db = getDb();
  const row = db
    .prepare("SELECT value FROM user_config WHERE user_id = ? AND key = ?")
    .get(userId, key) as { value: string } | undefined;

  const value: unknown = row ? JSON.parse(row.value) : DEFAULT_CONFIG[key];
  cache.set(key, value);
  return value as T;
}

export function setConfig(userId: number, key: string, value: unknown): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_config (user_id, key, value, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
  `).run(userId, key, JSON.stringify(value));

  // Invalidate cache
  configCache.get(String(userId))?.delete(key);
}

export function getAllConfig(userId: number): Record<string, unknown> {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM user_config WHERE user_id = ?")
    .all(userId) as { key: string; value: string }[];

  const result: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const row of rows) {
    result[row.key] = JSON.parse(row.value);
  }
  return result;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  spotify_id: string;
  display_name: string | null;
  email: string | null;
  spotify_access_token: string | null;
  spotify_refresh_token: string | null;
  token_expires_at: number | null;
  created_at: number;
}

export function upsertUser(
  spotifyId: string,
  displayName: string | null,
  email: string | null,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): User {
  const db = getDb();
  db.prepare(`
    INSERT INTO users (spotify_id, display_name, email, spotify_access_token, spotify_refresh_token, token_expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(spotify_id) DO UPDATE SET
      display_name = excluded.display_name,
      email = excluded.email,
      spotify_access_token = excluded.spotify_access_token,
      spotify_refresh_token = excluded.spotify_refresh_token,
      token_expires_at = excluded.token_expires_at
  `).run(spotifyId, displayName, email, accessToken, refreshToken, expiresAt);

  return db
    .prepare("SELECT * FROM users WHERE spotify_id = ?")
    .get(spotifyId) as User;
}

export function getUserById(id: number): User | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as User | undefined;
}

export function updateTokens(
  userId: number,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): void {
  getDb()
    .prepare(`
      UPDATE users SET spotify_access_token = ?, spotify_refresh_token = ?, token_expires_at = ?
      WHERE id = ?
    `)
    .run(accessToken, refreshToken, expiresAt, userId);
}

// ── Items ─────────────────────────────────────────────────────────────────────

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

export function addItem(
  userId: number,
  listType: "favorite" | "recommendation",
  title: string,
  creator: string,
  imageUrl: string | null,
  externalId: string,
  externalUri: string | null,
  externalUrl: string | null,
  metadata: Record<string, unknown> | null = null
): Item {
  const db = getDb();
  db.prepare(`
    INSERT INTO items (user_id, list_type, title, creator, image_url, external_id, external_uri, external_url, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, external_id, media_type) DO UPDATE SET
      list_type = excluded.list_type,
      title = excluded.title,
      creator = excluded.creator,
      image_url = excluded.image_url,
      external_uri = excluded.external_uri,
      external_url = excluded.external_url,
      metadata = excluded.metadata
  `).run(
    userId,
    listType,
    title,
    creator,
    imageUrl,
    externalId,
    externalUri,
    externalUrl,
    metadata ? JSON.stringify(metadata) : null
  );
  return db
    .prepare("SELECT * FROM items WHERE user_id = ? AND external_id = ? AND media_type = 'album'")
    .get(userId, externalId) as Item;
}

export function getItems(
  userId: number,
  listType?: "favorite" | "recommendation"
): Item[] {
  const db = getDb();
  if (listType) {
    return db
      .prepare("SELECT * FROM items WHERE user_id = ? AND list_type = ? ORDER BY added_at DESC")
      .all(userId, listType) as Item[];
  }
  return db
    .prepare("SELECT * FROM items WHERE user_id = ? ORDER BY added_at DESC")
    .all(userId) as Item[];
}

export function deleteItem(userId: number, itemId: number): void {
  getDb()
    .prepare("DELETE FROM items WHERE id = ? AND user_id = ?")
    .run(itemId, userId);
}

export function promoteItem(userId: number, itemId: number): void {
  getDb()
    .prepare("UPDATE items SET list_type = 'favorite' WHERE id = ? AND user_id = ?")
    .run(itemId, userId);
}

// ── Picks ─────────────────────────────────────────────────────────────────────

export interface Pick {
  id: number;
  user_id: number;
  item_id: number;
  mode: string;
  context: string | null;
  picked_at: number;
}

export function recordPick(
  userId: number,
  itemId: number,
  mode: string,
  context: string | null = null
): Pick {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO picks (user_id, item_id, mode, context) VALUES (?, ?, ?, ?)"
    )
    .run(userId, itemId, mode, context);
  return db
    .prepare("SELECT * FROM picks WHERE id = ?")
    .get(result.lastInsertRowid) as Pick;
}

export function getPickHistory(
  userId: number,
  limit = 100,
  offset = 0
): Array<Pick & Item & { picked_at_ts: number }> {
  return getDb()
    .prepare(`
      SELECT p.id, p.mode, p.context, p.picked_at as picked_at_ts,
             i.id as item_id, i.title, i.creator, i.image_url,
             i.external_id, i.external_uri, i.external_url, i.list_type
      FROM picks p
      JOIN items i ON p.item_id = i.id
      WHERE p.user_id = ?
      ORDER BY p.picked_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(userId, limit, offset) as Array<Pick & Item & { picked_at_ts: number }>;
}

export interface LastPickInfo {
  item_id: number;
  picked_at: number;
  pick_count: number;
}

export function getLastPicksForUser(userId: number): LastPickInfo[] {
  return getDb()
    .prepare(`
      SELECT item_id,
             MAX(picked_at) as picked_at,
             COUNT(*) as pick_count
      FROM picks
      WHERE user_id = ?
      GROUP BY item_id
    `)
    .all(userId) as LastPickInfo[];
}
