
-- Create terminology schema
CREATE SCHEMA IF NOT EXISTS terminology;

-- Table: terminology.snomed_concepts
CREATE TABLE terminology.snomed_concepts (
  concept_id BIGINT PRIMARY KEY,
  effective_time DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  module_id TEXT,
  definition_status_id TEXT
);

-- Table: terminology.snomed_descriptions
CREATE TABLE terminology.snomed_descriptions (
  description_id BIGINT PRIMARY KEY,
  concept_id BIGINT REFERENCES terminology.snomed_concepts(concept_id),
  language_code TEXT,
  type_id TEXT,
  term TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Table: terminology.snomed_relationships
CREATE TABLE terminology.snomed_relationships (
  relationship_id BIGINT PRIMARY KEY,
  source_concept BIGINT REFERENCES terminology.snomed_concepts(concept_id),
  destination_concept BIGINT REFERENCES terminology.snomed_concepts(concept_id),
  relationship_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Table: terminology.snomed_map_local
CREATE TABLE terminology.snomed_map_local (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_entity_type TEXT NOT NULL CHECK (local_entity_type IN ('symptom', 'diagnosis', 'lab', 'procedure', 'body_structure')),
  local_entity_id UUID NOT NULL,
  snomed_concept_id BIGINT REFERENCES terminology.snomed_concepts(concept_id),
  confidence_score FLOAT DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_snomed_concepts_id ON terminology.snomed_concepts(concept_id);
CREATE INDEX idx_snomed_descriptions_term ON terminology.snomed_descriptions USING GIN (to_tsvector('english', term));
CREATE INDEX idx_snomed_descriptions_concept ON terminology.snomed_descriptions(concept_id);
CREATE INDEX idx_snomed_relationships_source ON terminology.snomed_relationships(source_concept);
CREATE INDEX idx_snomed_relationships_dest ON terminology.snomed_relationships(destination_concept);
CREATE INDEX idx_snomed_map_local_entity ON terminology.snomed_map_local(local_entity_type, local_entity_id);
CREATE INDEX idx_snomed_map_local_concept ON terminology.snomed_map_local(snomed_concept_id);

-- Ontology storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ontology', 'ontology', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: only platform admins can upload/read ontology files
CREATE POLICY "Platform admins can manage ontology files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'ontology'
  AND public.has_role(auth.uid(), 'platform_admin')
)
WITH CHECK (
  bucket_id = 'ontology'
  AND public.has_role(auth.uid(), 'platform_admin')
);

-- Expose terminology schema to PostgREST
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, terminology';
NOTIFY pgrst, 'reload config';
