
-- Clinical Syndrome Cluster Reasoning Layer
-- Intermediate reasoning nodes representing recognized clinical syndromes

CREATE TABLE public.cluster_nodes (
  cluster_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  anatomical_system TEXT,
  min_activation_score NUMERIC DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.symptom_cluster_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id UUID NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES public.cluster_nodes(cluster_id) ON DELETE CASCADE,
  likelihood_weight NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symptom_id, cluster_id)
);

CREATE TABLE public.cluster_disease_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.cluster_nodes(cluster_id) ON DELETE CASCADE,
  disease_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  association_strength NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cluster_id, disease_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_symptom_cluster_edges_symptom ON public.symptom_cluster_edges(symptom_id);
CREATE INDEX idx_symptom_cluster_edges_cluster ON public.symptom_cluster_edges(cluster_id);
CREATE INDEX idx_cluster_disease_edges_cluster ON public.cluster_disease_edges(cluster_id);
CREATE INDEX idx_cluster_disease_edges_disease ON public.cluster_disease_edges(disease_id);

-- RLS: public read for knowledge graph
ALTER TABLE public.cluster_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_cluster_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_disease_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cluster_nodes" ON public.cluster_nodes FOR SELECT USING (true);
CREATE POLICY "Public read symptom_cluster_edges" ON public.symptom_cluster_edges FOR SELECT USING (true);
CREATE POLICY "Public read cluster_disease_edges" ON public.cluster_disease_edges FOR SELECT USING (true);

-- Also create missing diagnosis nodes
INSERT INTO public.diagnoses (id, diagnosis_name, category, is_active) VALUES
  (gen_random_uuid(), 'COPD exacerbation', 'respiratory', true),
  (gen_random_uuid(), 'tension headache', 'neurological', true),
  (gen_random_uuid(), 'erysipelas', 'dermatological', true)
ON CONFLICT DO NOTHING;
