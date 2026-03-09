
-- ============================================================
-- Table: medical_evidence
-- Stores ingested evidence from PubMed, EuropePMC, WHO, ICMR
-- ============================================================
CREATE TABLE public.medical_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'pubmed',
  source_id text, -- e.g. PMID, DOI
  title text NOT NULL,
  authors text DEFAULT '',
  journal text DEFAULT '',
  year integer,
  abstract text DEFAULT '',
  summary text DEFAULT '',
  keywords text[] DEFAULT '{}',
  evidence_strength text DEFAULT 'unknown',
  relevance_category text DEFAULT 'general',
  relevance_score numeric DEFAULT 0,
  url text,
  is_ai_summarized boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: guideline_updates
-- Tracks updates from WHO, ICMR, NICE, specialty bodies
-- ============================================================
CREATE TABLE public.guideline_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_organization text NOT NULL,
  country text DEFAULT 'global',
  specialty text DEFAULT 'general',
  title text NOT NULL,
  summary text DEFAULT '',
  recommendation_text text DEFAULT '',
  version text DEFAULT '1.0',
  publication_date date,
  url text,
  keywords text[] DEFAULT '{}',
  applicable_conditions text[] DEFAULT '{}',
  applicable_drugs text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  supersedes_id uuid REFERENCES public.guideline_updates(id),
  metadata jsonb DEFAULT '{}',
  ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: drug_safety_updates
-- Stores OpenFDA alerts, recall notices, safety signals
-- ============================================================
CREATE TABLE public.drug_safety_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'openfda',
  drug_name text NOT NULL,
  generic_name text,
  alert_type text NOT NULL DEFAULT 'safety_alert',
  severity text NOT NULL DEFAULT 'moderate',
  title text NOT NULL,
  description text DEFAULT '',
  black_box_warning boolean DEFAULT false,
  recall_info text,
  affected_populations text[] DEFAULT '{}',
  contraindications text[] DEFAULT '{}',
  source_url text,
  source_id text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes for search and retrieval
-- ============================================================
CREATE INDEX idx_medical_evidence_source ON public.medical_evidence(source);
CREATE INDEX idx_medical_evidence_year ON public.medical_evidence(year DESC);
CREATE INDEX idx_medical_evidence_relevance ON public.medical_evidence(relevance_category);
CREATE INDEX idx_medical_evidence_keywords ON public.medical_evidence USING GIN(keywords);
CREATE INDEX idx_medical_evidence_ingested ON public.medical_evidence(ingested_at DESC);

CREATE INDEX idx_guideline_updates_org ON public.guideline_updates(source_organization);
CREATE INDEX idx_guideline_updates_country ON public.guideline_updates(country);
CREATE INDEX idx_guideline_updates_specialty ON public.guideline_updates(specialty);
CREATE INDEX idx_guideline_updates_conditions ON public.guideline_updates USING GIN(applicable_conditions);
CREATE INDEX idx_guideline_updates_drugs ON public.guideline_updates USING GIN(applicable_drugs);

CREATE INDEX idx_drug_safety_drug ON public.drug_safety_updates(drug_name);
CREATE INDEX idx_drug_safety_generic ON public.drug_safety_updates(generic_name);
CREATE INDEX idx_drug_safety_type ON public.drug_safety_updates(alert_type);
CREATE INDEX idx_drug_safety_severity ON public.drug_safety_updates(severity);
CREATE INDEX idx_drug_safety_active ON public.drug_safety_updates(is_active) WHERE is_active = true;

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.medical_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guideline_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_safety_updates ENABLE ROW LEVEL SECURITY;

-- medical_evidence: authenticated read, platform_admin write
CREATE POLICY "Authenticated read medical evidence"
  ON public.medical_evidence FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage medical evidence"
  ON public.medical_evidence FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'));

-- guideline_updates: authenticated read, platform_admin write
CREATE POLICY "Authenticated read guideline updates"
  ON public.guideline_updates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage guideline updates"
  ON public.guideline_updates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'));

-- drug_safety_updates: authenticated read, platform_admin write
CREATE POLICY "Authenticated read drug safety updates"
  ON public.drug_safety_updates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage drug safety updates"
  ON public.drug_safety_updates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'));
