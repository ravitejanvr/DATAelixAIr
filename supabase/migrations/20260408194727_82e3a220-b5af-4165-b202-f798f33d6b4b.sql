
-- Create insights_articles table for autonomous research ingestion
CREATE TABLE public.insights_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Research & Evidence',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  slug TEXT NOT NULL,
  clinical_relevance TEXT,
  CONSTRAINT insights_articles_url_unique UNIQUE (url),
  CONSTRAINT insights_articles_slug_unique UNIQUE (slug)
);

-- Enable RLS
ALTER TABLE public.insights_articles ENABLE ROW LEVEL SECURITY;

-- Public read access for active articles (this is public marketing content)
CREATE POLICY "Anyone can view active insights"
ON public.insights_articles FOR SELECT
USING (is_active = true);

-- Only service_role can insert/update/delete (via edge functions)
-- No INSERT/UPDATE/DELETE policies for authenticated users
