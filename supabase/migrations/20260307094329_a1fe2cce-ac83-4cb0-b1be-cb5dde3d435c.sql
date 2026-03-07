
-- Create function to increment lexicon usage counts
CREATE OR REPLACE FUNCTION public.increment_lexicon_usage(ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.regional_lexicon
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE id = ANY(ids);
$$;
