import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "crate.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  applyMigrations(_db);
  return _db;
}

function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotify_id TEXT NOT NULL UNIQUE,
      display_name TEXT,
      email TEXT,
      spotify_access_token TEXT,
      spotify_refresh_token TEXT,
      token_expires_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_type TEXT NOT NULL DEFAULT 'album',
      list_type TEXT NOT NULL CHECK(list_type IN ('favorite', 'recommendation')),
      title TEXT NOT NULL,
      creator TEXT NOT NULL,
      image_url TEXT,
      external_id TEXT NOT NULL,
      external_uri TEXT,
      external_url TEXT,
      added_at INTEGER NOT NULL DEFAULT (unixepoch()),
      metadata TEXT,
      UNIQUE(user_id, external_id, media_type)
    );

    CREATE TABLE IF NOT EXISTS picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK(mode IN ('favorites', 'discover', 'for_right_now', 'surprise')),
      context TEXT,
      picked_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(user_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
    CREATE INDEX IF NOT EXISTS idx_picks_user_id ON picks(user_id);
    CREATE INDEX IF NOT EXISTS idx_picks_item_id ON picks(item_id);
    CREATE INDEX IF NOT EXISTS idx_user_config_user_id ON user_config(user_id);
  `);
}
