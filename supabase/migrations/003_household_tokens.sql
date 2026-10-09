-- Household tokens: long-lived bearer tokens for shared devices (the kitchen
-- dashboard) that can read the library and start playback but never edit.
-- Only the hash is stored; the token itself is shown once at creation.

CREATE TABLE public.household_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read', 'play'],
  created_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
  last_used_at INTEGER
);

CREATE INDEX idx_household_tokens_user ON public.household_tokens(user_id);

ALTER TABLE public.household_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only the API (service role) reads or writes these.
