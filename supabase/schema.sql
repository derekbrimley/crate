-- Run this in your Supabase SQL editor

CREATE TABLE public.users (
  id SERIAL PRIMARY KEY,
  supabase_uid UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_id TEXT UNIQUE,
  display_name TEXT,
  email TEXT,
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  token_expires_at INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'album',
  list_type TEXT NOT NULL CHECK(list_type IN ('favorite', 'recommendation')),
  title TEXT NOT NULL,
  creator TEXT NOT NULL,
  image_url TEXT,
  external_id TEXT NOT NULL,
  external_uri TEXT,
  external_url TEXT,
  added_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
  metadata JSONB,
  UNIQUE(user_id, external_id, media_type)
);

CREATE TABLE public.picks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('favorites', 'discover', 'for_right_now', 'surprise')),
  context TEXT,
  picked_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
);

CREATE TABLE public.user_config (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
  UNIQUE(user_id, key)
);

CREATE INDEX idx_items_user_id ON public.items(user_id);
CREATE INDEX idx_picks_user_id ON public.picks(user_id);
CREATE INDEX idx_picks_item_id ON public.picks(item_id);
CREATE INDEX idx_user_config_user_id ON public.user_config(user_id);

-- Used by api/picks/history.ts
CREATE OR REPLACE FUNCTION get_pick_history(p_user_id INTEGER, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(
  id INTEGER, mode TEXT, context TEXT, picked_at_ts INTEGER,
  item_id INTEGER, title TEXT, creator TEXT, image_url TEXT,
  external_id TEXT, external_uri TEXT, external_url TEXT, list_type TEXT
) AS $$
  SELECT p.id, p.mode, p.context, p.picked_at AS picked_at_ts,
         i.id AS item_id, i.title, i.creator, i.image_url,
         i.external_id, i.external_uri, i.external_url, i.list_type
  FROM public.picks p
  JOIN public.items i ON i.id = p.item_id
  WHERE p.user_id = p_user_id
  ORDER BY p.picked_at DESC
  LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Used by api/picks/dashboard.ts (aggregated per-item pick info)
CREATE OR REPLACE FUNCTION get_last_picks_for_user(p_user_id INTEGER)
RETURNS TABLE(item_id INTEGER, picked_at INTEGER, pick_count BIGINT) AS $$
  SELECT item_id,
         MAX(picked_at)::INTEGER AS picked_at,
         COUNT(*) AS pick_count
  FROM public.picks
  WHERE user_id = p_user_id
  GROUP BY item_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Row Level Security
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON public.users
  USING (supabase_uid = auth.uid());

CREATE POLICY items_owner ON public.items
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid()));

CREATE POLICY picks_owner ON public.picks
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid()));

CREATE POLICY config_owner ON public.user_config
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid()));
