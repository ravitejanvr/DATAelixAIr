
-- Symptom Localisation Edges: maps symptoms to anatomical systems with probability weights
CREATE TABLE public.symptom_localisation_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symptom_id UUID NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,
  anatomical_system TEXT NOT NULL,
  localisation_weight NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(symptom_id, anatomical_system)
);

-- Enable RLS
ALTER TABLE public.symptom_localisation_edges ENABLE ROW LEVEL SECURITY;

-- Public read policy (clinical knowledge graph data)
CREATE POLICY "Allow public read access to localisation edges"
  ON public.symptom_localisation_edges
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_localisation_symptom ON public.symptom_localisation_edges(symptom_id);
CREATE INDEX idx_localisation_system ON public.symptom_localisation_edges(anatomical_system);
