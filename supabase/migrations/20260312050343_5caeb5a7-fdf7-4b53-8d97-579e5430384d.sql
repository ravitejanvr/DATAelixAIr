CREATE TABLE IF NOT EXISTS public.knowledge_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  cache_type text NOT NULL,
  query_text text DEFAULT '',
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  hit_count integer DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cache_key, cache_type)
);

ALTER TABLE public.knowledge_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read knowledge cache"
  ON public.knowledge_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert knowledge cache"
  ON public.knowledge_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update knowledge cache"
  ON public.knowledge_cache FOR UPDATE
  TO authenticated
  USING (true);
