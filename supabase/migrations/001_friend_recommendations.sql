CREATE TABLE public.friend_recommendations (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  creator TEXT NOT NULL,
  image_url TEXT,
  external_id TEXT NOT NULL,
  external_uri TEXT,
  external_url TEXT,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'dismissed')),
  sent_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
  acted_at INTEGER,
  sender_display_name TEXT,
  sender_email TEXT
);

CREATE INDEX idx_friend_recs_recipient ON public.friend_recommendations(recipient_id, status);
CREATE INDEX idx_friend_recs_sender ON public.friend_recommendations(sender_id);
CREATE UNIQUE INDEX idx_friend_recs_unique_pending
  ON public.friend_recommendations(sender_id, recipient_id, external_id)
  WHERE status = 'pending';

ALTER TABLE public.friend_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY friend_recs_recipient ON public.friend_recommendations
  FOR SELECT USING (recipient_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid()));

CREATE POLICY friend_recs_sender ON public.friend_recommendations
  FOR SELECT USING (sender_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid()));
