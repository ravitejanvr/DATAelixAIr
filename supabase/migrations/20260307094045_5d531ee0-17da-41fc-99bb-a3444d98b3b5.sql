
-- Expand regional_lexicon with additional metadata columns
ALTER TABLE public.regional_lexicon ADD COLUMN IF NOT EXISTS source_language text DEFAULT 'telugu';
ALTER TABLE public.regional_lexicon ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'verified';
ALTER TABLE public.regional_lexicon ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0;
ALTER TABLE public.regional_lexicon ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add index for fast phrase lookups during normalization
CREATE INDEX IF NOT EXISTS idx_lexicon_phrase_lower ON public.regional_lexicon(lower(regional_phrase));
CREATE INDEX IF NOT EXISTS idx_lexicon_language ON public.regional_lexicon(language);
CREATE INDEX IF NOT EXISTS idx_lexicon_category ON public.regional_lexicon(category);
