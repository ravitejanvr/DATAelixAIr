-- Blog articles table for editorial workflow
CREATE TABLE public.blog_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Research & Evidence',
  keywords text[] NOT NULL DEFAULT '{}',
  source_type text NOT NULL DEFAULT 'Editorial',
  related_platform_features text[] NOT NULL DEFAULT '{}',
  author text NOT NULL DEFAULT '',
  publish_date date,
  reading_time_min integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'draft',
  source_name text,
  source_url text,
  source_journal text,
  source_year integer,
  key_findings text[] NOT NULL DEFAULT '{}',
  clinical_implications text,
  meta_title text,
  meta_description text,
  og_image_url text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published articles"
ON public.blog_articles FOR SELECT
USING (status = 'published');

CREATE POLICY "Platform admins manage all articles"
ON public.blog_articles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Blog article index for RAG
CREATE TABLE public.blog_article_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.blog_articles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT '',
  full_text text NOT NULL DEFAULT '',
  indexed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_article_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage article index"
ON public.blog_article_index FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Authenticated read article index"
ON public.blog_article_index FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Public read article index"
ON public.blog_article_index FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM public.blog_articles ba
  WHERE ba.id = blog_article_index.article_id AND ba.status = 'published'
));