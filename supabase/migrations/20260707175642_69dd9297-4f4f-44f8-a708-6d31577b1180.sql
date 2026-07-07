
SET statement_timeout = '15min';
INSERT INTO terminology.designations (concept_id, language, term, use_type, active)
SELECT c.id, sd.language_code, sd.term,
       CASE sd.type_id WHEN '900000000000003001' THEN 'fsn' ELSE 'synonym' END,
       sd.active
FROM terminology.snomed_descriptions sd
JOIN terminology.concepts c
  ON c.code = sd.concept_id::text
 AND c.release_id = 'd33a9493-1721-43f5-ac29-c3227a7b5aa4'::uuid
WHERE sd.active;
