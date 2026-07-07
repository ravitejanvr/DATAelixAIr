
CREATE OR REPLACE FUNCTION public._terminology_active_release(p_system text)
RETURNS TABLE (code_system_id uuid, release_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, terminology
AS $$
  SELECT cs.id, cs.active_release_id
  FROM terminology.code_systems cs
  WHERE cs.short_name = p_system AND cs.active_release_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.terminology_lookup(p_code text, p_system text DEFAULT 'snomed-ct')
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE cs_id uuid; rel_id uuid; c_id bigint; result json;
BEGIN
  SELECT r.code_system_id, r.release_id INTO cs_id, rel_id FROM public._terminology_active_release(p_system) r;
  IF cs_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO c_id FROM terminology.concepts
   WHERE code_system_id = cs_id AND release_id = rel_id AND code = p_code LIMIT 1;
  IF c_id IS NULL THEN RETURN NULL; END IF;
  SELECT json_build_object(
    'system', p_system, 'code', c.code, 'display', c.display, 'active', c.active,
    'designations', COALESCE((
      SELECT json_agg(json_build_object('language', d.language, 'term', d.term, 'use_type', d.use_type, 'active', d.active)
        ORDER BY (d.use_type='fsn') DESC, (d.use_type='preferred') DESC, d.term)
      FROM terminology.designations d WHERE d.concept_id = c.id AND d.active
    ), '[]'::json)
  ) INTO result FROM terminology.concepts c WHERE c.id = c_id;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.terminology_ancestors(p_code text, p_system text DEFAULT 'snomed-ct', p_max_depth int DEFAULT 20)
RETURNS TABLE (code text, display text, depth int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE cs_id uuid; rel_id uuid; c_id bigint;
BEGIN
  SELECT r.code_system_id, r.release_id INTO cs_id, rel_id FROM public._terminology_active_release(p_system) r;
  IF cs_id IS NULL THEN RETURN; END IF;
  SELECT id INTO c_id FROM terminology.concepts
   WHERE code_system_id = cs_id AND release_id = rel_id AND terminology.concepts.code = p_code LIMIT 1;
  IF c_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH RECURSIVE up AS (
    SELECT r.target_concept_id AS cid, 1 AS d
      FROM terminology.relationships r
     WHERE r.source_concept_id = c_id AND r.relationship_type='is-a' AND r.active
    UNION
    SELECT r.target_concept_id, up.d+1
      FROM terminology.relationships r JOIN up ON r.source_concept_id = up.cid
     WHERE r.relationship_type='is-a' AND r.active AND up.d < p_max_depth
  )
  SELECT c.code, c.display, MIN(up.d)::int
    FROM up JOIN terminology.concepts c ON c.id = up.cid
   GROUP BY c.code, c.display ORDER BY MIN(up.d), c.display;
END $$;

CREATE OR REPLACE FUNCTION public.terminology_descendants(p_code text, p_system text DEFAULT 'snomed-ct', p_max_depth int DEFAULT 5, p_limit int DEFAULT 500)
RETURNS TABLE (code text, display text, depth int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE cs_id uuid; rel_id uuid; c_id bigint;
BEGIN
  SELECT r.code_system_id, r.release_id INTO cs_id, rel_id FROM public._terminology_active_release(p_system) r;
  IF cs_id IS NULL THEN RETURN; END IF;
  SELECT id INTO c_id FROM terminology.concepts
   WHERE code_system_id = cs_id AND release_id = rel_id AND terminology.concepts.code = p_code LIMIT 1;
  IF c_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH RECURSIVE down AS (
    SELECT r.source_concept_id AS cid, 1 AS d
      FROM terminology.relationships r
     WHERE r.target_concept_id = c_id AND r.relationship_type='is-a' AND r.active
    UNION
    SELECT r.source_concept_id, down.d+1
      FROM terminology.relationships r JOIN down ON r.target_concept_id = down.cid
     WHERE r.relationship_type='is-a' AND r.active AND down.d < p_max_depth
  )
  SELECT c.code, c.display, MIN(down.d)::int
    FROM down JOIN terminology.concepts c ON c.id = down.cid
   GROUP BY c.code, c.display ORDER BY MIN(down.d), c.display LIMIT p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.terminology_canonicalize(p_q text, p_system text DEFAULT 'snomed-ct', p_min_score real DEFAULT 0.35)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE hit record;
BEGIN
  SELECT s.code, s.preferred_term, s.matched_term, s.score, s.language, s.source INTO hit
    FROM public.terminology_search(p_q, p_system, 5) s ORDER BY s.score DESC LIMIT 1;
  IF hit IS NULL OR hit.score < p_min_score THEN
    RETURN json_build_object('matched', false, 'q', p_q);
  END IF;
  RETURN json_build_object('matched', true, 'q', p_q, 'code', hit.code, 'display', hit.preferred_term,
    'matched_term', hit.matched_term, 'score', hit.score, 'language', hit.language, 'source', hit.source);
END $$;

CREATE OR REPLACE FUNCTION public.terminology_translate(p_source_code text, p_source_system text, p_target_system text)
RETURNS TABLE (target_code text, target_display text, equivalence text, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE src_cs uuid; src_rel uuid; tgt_cs uuid; tgt_rel uuid; src_id bigint;
BEGIN
  SELECT code_system_id, release_id INTO src_cs, src_rel FROM public._terminology_active_release(p_source_system);
  SELECT code_system_id, release_id INTO tgt_cs, tgt_rel FROM public._terminology_active_release(p_target_system);
  IF src_cs IS NULL OR tgt_cs IS NULL THEN RETURN; END IF;
  SELECT id INTO src_id FROM terminology.concepts
   WHERE code_system_id = src_cs AND release_id = src_rel AND code = p_source_code LIMIT 1;
  IF src_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT COALESCE(tc.code, m.target_code), tc.display, m.equivalence, m.source
    FROM terminology.mappings m
    LEFT JOIN terminology.concepts tc ON tc.id = m.target_concept_id
   WHERE m.source_concept_id = src_id
     AND (m.target_system_id = tgt_cs OR tc.code_system_id = tgt_cs);
END $$;

CREATE OR REPLACE FUNCTION public.terminology_validate(p_code text, p_system text DEFAULT 'snomed-ct')
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE cs_id uuid; rel_id uuid; rec record;
BEGIN
  SELECT code_system_id, release_id INTO cs_id, rel_id FROM public._terminology_active_release(p_system);
  IF cs_id IS NULL THEN RETURN json_build_object('valid', false, 'reason', 'no_active_release'); END IF;
  SELECT c.code, c.display, c.active INTO rec FROM terminology.concepts c
   WHERE c.code_system_id = cs_id AND c.release_id = rel_id AND c.code = p_code LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('valid', false, 'reason', 'unknown_code'); END IF;
  RETURN json_build_object('valid', rec.active, 'code', rec.code, 'display', rec.display, 'active', rec.active);
END $$;

CREATE OR REPLACE FUNCTION public.terminology_verify_release(p_release_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE
  cs_id uuid; short_name text;
  concept_count bigint; designation_count bigint; relationship_count bigint;
  orphan_rels bigint; duplicate_codes bigint;
  concepts_without_designations bigint; concepts_without_preferred bigint;
  search_rows bigint; search_expected bigint;
  hierarchy_roots bigint; broken_hierarchy bigint;
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
      'search_index_shortfall', GREATEST(search_expected - search_rows, 0))
  );
END $$;

CREATE OR REPLACE FUNCTION public.terminology_rollback_release(p_release_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, terminology AS $$
DECLARE cs_id uuid; prev_active uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT code_system_id INTO cs_id FROM terminology.releases WHERE id = p_release_id;
  IF cs_id IS NULL THEN RETURN json_build_object('ok', false, 'error', 'release_not_found'); END IF;
  SELECT active_release_id INTO prev_active FROM terminology.code_systems WHERE id = cs_id;
  UPDATE terminology.releases SET status='archived'
   WHERE code_system_id = cs_id AND status='active' AND id <> p_release_id;
  UPDATE terminology.releases SET status='active', activated_at = now() WHERE id = p_release_id;
  UPDATE terminology.code_systems SET active_release_id = p_release_id, updated_at = now() WHERE id = cs_id;
  RETURN json_build_object('ok', true, 'code_system_id', cs_id, 'previous_active', prev_active, 'now_active', p_release_id);
END $$;

GRANT EXECUTE ON FUNCTION public.terminology_lookup(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.terminology_ancestors(text, text, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.terminology_descendants(text, text, int, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.terminology_canonicalize(text, text, real) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.terminology_translate(text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.terminology_validate(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.terminology_verify_release(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terminology_rollback_release(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._terminology_active_release(text) FROM PUBLIC;
