-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Drop legacy unsafe RPC
DROP FUNCTION IF EXISTS public.exec_terminology_sql(text);

-- Ensure schema exists (it does, but idempotent)
CREATE SCHEMA IF NOT EXISTS terminology;

-- === Generic FHIR-shaped model ===

CREATE TABLE IF NOT EXISTS terminology.code_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_uri text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL UNIQUE,
  description text,
  license text,
  active_release_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terminology.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_system_id uuid NOT NULL REFERENCES terminology.code_systems(id) ON DELETE CASCADE,
  release_identifier text NOT NULL,
  effective_date date,
  source_sha256 jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  chunk_manifest jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  loaded_at timestamptz,
  activated_at timestamptz,
  UNIQUE (code_system_id, release_identifier)
);

ALTER TABLE terminology.code_systems
  DROP CONSTRAINT IF EXISTS fk_code_systems_active_release;
ALTER TABLE terminology.code_systems
  ADD CONSTRAINT fk_code_systems_active_release
  FOREIGN KEY (active_release_id) REFERENCES terminology.releases(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS terminology.concepts (
  id bigserial PRIMARY KEY,
  code_system_id uuid NOT NULL REFERENCES terminology.code_systems(id) ON DELETE CASCADE,
  release_id uuid REFERENCES terminology.releases(id) ON DELETE CASCADE,
  code text NOT NULL,
  display text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (code_system_id, release_id, code)
);
CREATE INDEX IF NOT EXISTS concepts_release_active_idx
  ON terminology.concepts(code_system_id, release_id) WHERE active;

CREATE TABLE IF NOT EXISTS terminology.designations (
  id bigserial PRIMARY KEY,
  concept_id bigint NOT NULL REFERENCES terminology.concepts(id) ON DELETE CASCADE,
  language text NOT NULL,
  term text NOT NULL,
  use_type text NOT NULL DEFAULT 'synonym',
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS designations_concept_idx ON terminology.designations(concept_id);

CREATE TABLE IF NOT EXISTS terminology.relationships (
  id bigserial PRIMARY KEY,
  code_system_id uuid NOT NULL REFERENCES terminology.code_systems(id) ON DELETE CASCADE,
  release_id uuid REFERENCES terminology.releases(id) ON DELETE CASCADE,
  source_concept_id bigint NOT NULL,
  target_concept_id bigint NOT NULL,
  relationship_type text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS relationships_source_idx
  ON terminology.relationships(source_concept_id) WHERE active;
CREATE INDEX IF NOT EXISTS relationships_target_idx
  ON terminology.relationships(target_concept_id) WHERE active;

CREATE TABLE IF NOT EXISTS terminology.mappings (
  id bigserial PRIMARY KEY,
  source_concept_id bigint NOT NULL REFERENCES terminology.concepts(id) ON DELETE CASCADE,
  target_concept_id bigint REFERENCES terminology.concepts(id) ON DELETE CASCADE,
  target_code text,
  target_system_id uuid REFERENCES terminology.code_systems(id) ON DELETE CASCADE,
  equivalence text NOT NULL DEFAULT 'equivalent',
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mappings_source_idx ON terminology.mappings(source_concept_id);

CREATE TABLE IF NOT EXISTS terminology.local_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_system_id uuid NOT NULL REFERENCES terminology.code_systems(id) ON DELETE CASCADE,
  code text NOT NULL,
  language text NOT NULL,
  term text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  confidence real NOT NULL DEFAULT 1.0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS local_syn_lookup_idx
  ON terminology.local_synonyms(code_system_id, code) WHERE active;

-- === Search surface ===
CREATE TABLE IF NOT EXISTS terminology.concept_search (
  id bigserial PRIMARY KEY,
  concept_id bigint NOT NULL REFERENCES terminology.concepts(id) ON DELETE CASCADE,
  code_system_id uuid NOT NULL REFERENCES terminology.code_systems(id) ON DELETE CASCADE,
  code text NOT NULL,
  preferred_term text NOT NULL,
  term text NOT NULL,
  term_norm text NOT NULL,
  language text NOT NULL,
  source text NOT NULL,
  weight real NOT NULL DEFAULT 1.0,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS csearch_trgm_idx
  ON terminology.concept_search USING gin (term_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS csearch_prefix_idx
  ON terminology.concept_search (term_norm text_pattern_ops);
CREATE INDEX IF NOT EXISTS csearch_code_idx
  ON terminology.concept_search (code_system_id, code);

-- === Import job queue ===
CREATE TABLE IF NOT EXISTS terminology.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES terminology.releases(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  storage_path text NOT NULL,
  target_table text NOT NULL,
  expected_rows int NOT NULL DEFAULT 0,
  loaded_rows int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (release_id, chunk_index, target_table)
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON terminology.import_jobs(status, created_at);

-- === Seed SNOMED-CT code system ===
INSERT INTO terminology.code_systems (system_uri, name, short_name, description, license)
VALUES (
  'http://snomed.info/sct',
  'SNOMED CT',
  'snomed-ct',
  'SNOMED Clinical Terms — International Edition',
  'SNOMED International Affiliate License'
)
ON CONFLICT (system_uri) DO NOTHING;

-- === Public RPCs (single query surface for the app) ===

CREATE OR REPLACE FUNCTION public.terminology_search(
  q text,
  system_short_name text DEFAULT 'snomed-ct',
  limit_n int DEFAULT 20
) RETURNS TABLE (
  code text,
  preferred_term text,
  matched_term text,
  language text,
  source text,
  score real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, terminology
AS $$
DECLARE
  cs_id uuid;
  q_norm text;
BEGIN
  SELECT id INTO cs_id FROM terminology.code_systems WHERE short_name = system_short_name;
  IF cs_id IS NULL THEN RETURN; END IF;
  q_norm := lower(unaccent(coalesce(q, '')));
  IF length(q_norm) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT cs.code, cs.preferred_term, cs.term, cs.language, cs.source,
         (similarity(cs.term_norm, q_norm) * cs.weight)::real AS score
  FROM terminology.concept_search cs
  WHERE cs.code_system_id = cs_id
    AND cs.active
    AND cs.term_norm % q_norm
  ORDER BY score DESC
  LIMIT limit_n;
END;
$$;
REVOKE ALL ON FUNCTION public.terminology_search(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminology_search(text, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_terminology_counts()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, terminology
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'code_systems',                 (SELECT count(*) FROM terminology.code_systems),
    'releases',                     (SELECT count(*) FROM terminology.releases),
    'concepts',                     (SELECT count(*) FROM terminology.concepts),
    'designations',                 (SELECT count(*) FROM terminology.designations),
    'relationships',                (SELECT count(*) FROM terminology.relationships),
    'concept_search',               (SELECT count(*) FROM terminology.concept_search),
    'local_synonyms',               (SELECT count(*) FROM terminology.local_synonyms),
    'snomed_staging_concepts',      (SELECT count(*) FROM terminology.snomed_concepts),
    'snomed_staging_descriptions',  (SELECT count(*) FROM terminology.snomed_descriptions),
    'snomed_staging_relationships', (SELECT count(*) FROM terminology.snomed_relationships)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_terminology_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_terminology_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_terminology_dashboard()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, terminology
AS $$
DECLARE result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT json_build_object(
    'code_systems',
      (SELECT coalesce(json_agg(row_to_json(cs)), '[]'::json) FROM (
        SELECT id, short_name, name, active_release_id
        FROM terminology.code_systems ORDER BY short_name
      ) cs),
    'releases',
      (SELECT coalesce(json_agg(row_to_json(r)), '[]'::json) FROM (
        SELECT id, code_system_id, release_identifier, status, effective_date,
               created_at, loaded_at, activated_at, row_counts
        FROM terminology.releases ORDER BY created_at DESC LIMIT 20
      ) r),
    'jobs',
      (SELECT coalesce(json_agg(row_to_json(j)), '[]'::json) FROM (
        SELECT release_id, status,
               count(*)::int as chunk_count,
               coalesce(sum(loaded_rows), 0)::bigint as loaded_rows,
               coalesce(sum(expected_rows), 0)::bigint as expected_rows
        FROM terminology.import_jobs
        GROUP BY release_id, status
      ) j),
    'counts', (SELECT public.get_terminology_counts())
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_terminology_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_terminology_dashboard() TO authenticated;