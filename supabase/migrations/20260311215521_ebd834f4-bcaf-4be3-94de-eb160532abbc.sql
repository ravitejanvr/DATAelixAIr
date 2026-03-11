
-- Pre-indexed medical knowledge table for common diseases
-- Avoids real-time retrieval for high-frequency conditions
CREATE TABLE IF NOT EXISTS public.preindexed_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_key text NOT NULL,
  condition_name text NOT NULL,
  icd10_codes text[] DEFAULT '{}',
  treatment_options jsonb DEFAULT '[]',
  recommended_tests jsonb DEFAULT '[]',
  guideline_citations jsonb DEFAULT '[]',
  safety_considerations jsonb DEFAULT '[]',
  evidence_grade text DEFAULT 'moderate',
  source_authorities text[] DEFAULT '{}',
  symptom_clusters text[] DEFAULT '{}',
  prevalence_tier text DEFAULT 'common' CHECK (prevalence_tier IN ('very_common', 'common', 'uncommon', 'rare')),
  last_verified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(condition_key)
);

-- Index for fast lookup by condition and symptom clusters
CREATE INDEX idx_preindexed_knowledge_condition ON public.preindexed_knowledge(condition_key);
CREATE INDEX idx_preindexed_knowledge_symptoms ON public.preindexed_knowledge USING gin(symptom_clusters);
CREATE INDEX idx_preindexed_knowledge_prevalence ON public.preindexed_knowledge(prevalence_tier);

-- Clinical reasoning cache table for symptom cluster memoization
CREATE TABLE IF NOT EXISTS public.reasoning_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key text NOT NULL,
  cluster_symptoms text[] NOT NULL,
  reasoning_output jsonb NOT NULL,
  confidence_score numeric(4,3) DEFAULT 0,
  hit_count integer DEFAULT 0,
  ttl_hours integer DEFAULT 24,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cluster_key)
);

CREATE INDEX idx_reasoning_cache_key ON public.reasoning_cache(cluster_key);
CREATE INDEX idx_reasoning_cache_expires ON public.reasoning_cache(expires_at);

-- RLS: readable by authenticated users (clinical data is non-PII reference data)
ALTER TABLE public.preindexed_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read preindexed knowledge" ON public.preindexed_knowledge FOR SELECT TO authenticated USING (true);

ALTER TABLE public.reasoning_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read reasoning cache" ON public.reasoning_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert reasoning cache" ON public.reasoning_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update reasoning cache" ON public.reasoning_cache FOR UPDATE TO authenticated USING (true);
