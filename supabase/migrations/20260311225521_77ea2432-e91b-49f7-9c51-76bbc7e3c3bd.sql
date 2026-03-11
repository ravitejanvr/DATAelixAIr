
-- Function to execute SQL against terminology schema (used by import edge function)
CREATE OR REPLACE FUNCTION public.exec_terminology_sql(sql_text TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'terminology'
AS $$
BEGIN
  -- Only allow INSERT/UPDATE on terminology schema tables
  IF sql_text !~* '^INSERT INTO terminology\.' THEN
    RAISE EXCEPTION 'Only INSERT INTO terminology.* is allowed';
  END IF;
  EXECUTE sql_text;
END;
$$;

-- Function to get terminology counts (used by admin UI)
CREATE OR REPLACE FUNCTION public.get_terminology_counts()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'terminology'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'concepts', (SELECT COUNT(*) FROM terminology.snomed_concepts),
    'descriptions', (SELECT COUNT(*) FROM terminology.snomed_descriptions),
    'relationships', (SELECT COUNT(*) FROM terminology.snomed_relationships),
    'mappings', (SELECT COUNT(*) FROM terminology.snomed_map_local)
  ) INTO result;
  RETURN result;
END;
$$;
