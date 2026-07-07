
-- 1. Drop staging FKs (staging is a landing zone for RF2 ETL; integrity is
--    enforced at promotion into terminology.concepts / .designations / .relationships).
ALTER TABLE terminology.snomed_descriptions
  DROP CONSTRAINT IF EXISTS snomed_descriptions_concept_id_fkey;
ALTER TABLE terminology.snomed_relationships
  DROP CONSTRAINT IF EXISTS snomed_relationships_source_concept_fkey;
ALTER TABLE terminology.snomed_relationships
  DROP CONSTRAINT IF EXISTS snomed_relationships_destination_concept_fkey;

-- 2. Extend verification to expose orphan / missing-reference counts on staging
--    plus description-type breakdown. Same signature, additive fields.
CREATE OR REPLACE FUNCTION public.terminology_verify_release(p_release_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'terminology'
AS $function$
DECLARE
  cs_id uuid; short_name text;
  concept_count bigint; designation_count bigint; relationship_count bigint;
  orphan_rels bigint; duplicate_codes bigint;
  concepts_without_designations bigint; concepts_without_preferred bigint;
  search_rows bigint; search_expected bigint;
  hierarchy_roots bigint; broken_hierarchy bigint;

  -- Staging integrity
  staging_concepts bigint; staging_descriptions bigint; staging_relationships bigint;
  staging_orphan_descriptions bigint;
  staging_orphan_rel_sources bigint;
  staging_orphan_rel_destinations bigint;
  staging_missing_concept_refs bigint;
  staging_desc_by_type json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT r.code_system_id, cs.short_name INTO cs_id, short_name
    FROM terminology.releases r JOIN terminology.code_systems cs ON cs.id = r.code_system_id
   WHERE r.id = p_release_id;
  IF cs_id IS NULL THEN RETURN json_build_object('ok', false, 'error', 'release_not_found'); END IF;

  SELECT count(*) INTO concept_count FROM terminology.concepts WHERE release_id = p_release_id;
  SELECT count(*) INTO designation_count FROM terminology.designations d
    JOIN terminology.concepts c ON c.id = d.concept_id WHERE c.release_id = p_release_id;
  SELECT count(*) INTO relationship_count FROM terminology.relationships WHERE release_id = p_release_id;

  SELECT count(*) INTO orphan_rels FROM terminology.relationships r
   WHERE r.release_id = p_release_id
     AND (NOT EXISTS (SELECT 1 FROM terminology.concepts c WHERE c.id = r.source_concept_id AND c.release_id = r.release_id)
       OR NOT EXISTS (SELECT 1 FROM terminology.concepts c WHERE c.id = r.target_concept_id AND c.release_id = r.release_id));

  SELECT COALESCE(sum(cnt - 1), 0) INTO duplicate_codes FROM (
    SELECT count(*) AS cnt FROM terminology.concepts WHERE release_id = p_release_id
     GROUP BY code HAVING count(*) > 1
  ) x;

  SELECT count(*) INTO concepts_without_designations FROM terminology.concepts c
   WHERE c.release_id = p_release_id
     AND NOT EXISTS (SELECT 1 FROM terminology.designations d WHERE d.concept_id = c.id AND d.active);

  SELECT count(*) INTO concepts_without_preferred FROM terminology.concepts c
   WHERE c.release_id = p_release_id
     AND NOT EXISTS (SELECT 1 FROM terminology.designations d
       WHERE d.concept_id = c.id AND d.active AND d.use_type IN ('fsn','preferred'));

  SELECT count(*) INTO search_rows FROM terminology.concept_search WHERE code_system_id = cs_id;
  SELECT count(*) INTO search_expected FROM terminology.designations d
    JOIN terminology.concepts c ON c.id = d.concept_id
   WHERE c.release_id = p_release_id AND d.active;

  SELECT count(*) INTO hierarchy_roots FROM terminology.concepts c
   WHERE c.release_id = p_release_id
     AND NOT EXISTS (SELECT 1 FROM terminology.relationships r
       WHERE r.source_concept_id = c.id AND r.relationship_type='is-a' AND r.active);

  SELECT count(*) INTO broken_hierarchy FROM terminology.relationships r
   WHERE r.release_id = p_release_id AND r.relationship_type='is-a' AND r.active
     AND NOT EXISTS (SELECT 1 FROM terminology.concepts c WHERE c.id = r.target_concept_id);

  -- ---- Staging integrity (RF2 landing tables) ----
  SELECT count(*) INTO staging_concepts       FROM terminology.snomed_concepts;
  SELECT count(*) INTO staging_descriptions   FROM terminology.snomed_descriptions;
  SELECT count(*) INTO staging_relationships  FROM terminology.snomed_relationships;

  SELECT count(*) INTO staging_orphan_descriptions
    FROM terminology.snomed_descriptions d
    LEFT JOIN terminology.snomed_concepts c ON c.concept_id = d.concept_id
   WHERE d.concept_id IS NOT NULL AND c.concept_id IS NULL;

  SELECT count(*) INTO staging_orphan_rel_sources
    FROM terminology.snomed_relationships r
    LEFT JOIN terminology.snomed_concepts c ON c.concept_id = r.source_concept
   WHERE r.source_concept IS NOT NULL AND c.concept_id IS NULL;

  SELECT count(*) INTO staging_orphan_rel_destinations
    FROM terminology.snomed_relationships r
    LEFT JOIN terminology.snomed_concepts c ON c.concept_id = r.destination_concept
   WHERE r.destination_concept IS NOT NULL AND c.concept_id IS NULL;

  SELECT count(DISTINCT missing) INTO staging_missing_concept_refs FROM (
    SELECT d.concept_id AS missing
      FROM terminology.snomed_descriptions d
      LEFT JOIN terminology.snomed_concepts c ON c.concept_id = d.concept_id
     WHERE d.concept_id IS NOT NULL AND c.concept_id IS NULL
    UNION
    SELECT r.source_concept
      FROM terminology.snomed_relationships r
      LEFT JOIN terminology.snomed_concepts c ON c.concept_id = r.source_concept
     WHERE r.source_concept IS NOT NULL AND c.concept_id IS NULL
    UNION
    SELECT r.destination_concept
      FROM terminology.snomed_relationships r
      LEFT JOIN terminology.snomed_concepts c ON c.concept_id = r.destination_concept
     WHERE r.destination_concept IS NOT NULL AND c.concept_id IS NULL
  ) m;

  SELECT COALESCE(json_object_agg(type_id, cnt), '{}'::json) INTO staging_desc_by_type FROM (
    SELECT type_id, count(*)::bigint AS cnt
      FROM terminology.snomed_descriptions
     GROUP BY type_id ORDER BY count(*) DESC
  ) t;

  RETURN json_build_object(
    'ok', (orphan_rels=0 AND duplicate_codes=0 AND broken_hierarchy=0
           AND concepts_without_designations=0 AND search_rows >= search_expected),
    'release_id', p_release_id, 'code_system', short_name,
    'counts', json_build_object('concepts', concept_count, 'designations', designation_count,
      'relationships', relationship_count, 'search_rows', search_rows,
      'search_expected_min', search_expected, 'hierarchy_roots', hierarchy_roots),
    'issues', json_build_object('orphan_relationships', orphan_rels, 'duplicate_codes', duplicate_codes,
      'broken_hierarchy_targets', broken_hierarchy,
      'concepts_without_designations', concepts_without_designations,
      'concepts_without_preferred_term', concepts_without_preferred,
      'search_index_shortfall', GREATEST(search_expected - search_rows, 0)),
    'staging', json_build_object(
      'snomed_concepts', staging_concepts,
      'snomed_descriptions', staging_descriptions,
      'snomed_relationships', staging_relationships,
      'orphan_descriptions', staging_orphan_descriptions,
      'orphan_relationship_sources', staging_orphan_rel_sources,
      'orphan_relationship_destinations', staging_orphan_rel_destinations,
      'distinct_missing_concept_references', staging_missing_concept_refs,
      'descriptions_by_type_id', staging_desc_by_type
    )
  );
END $function$;
