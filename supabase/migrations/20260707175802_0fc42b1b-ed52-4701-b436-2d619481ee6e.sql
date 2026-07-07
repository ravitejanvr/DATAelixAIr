
SET statement_timeout = '15min';
INSERT INTO terminology.relationships
  (code_system_id, release_id, source_concept_id, target_concept_id, relationship_type, active)
SELECT r.code_system_id, r.id, src.id, dst.id, 'is-a', sr.active
FROM terminology.releases r
JOIN terminology.snomed_relationships sr ON true
JOIN terminology.concepts src ON src.code = sr.source_concept::text AND src.release_id = r.id
JOIN terminology.concepts dst ON dst.code = sr.destination_concept::text AND dst.release_id = r.id
WHERE r.id = 'd33a9493-1721-43f5-ac29-c3227a7b5aa4'::uuid
  AND sr.active AND sr.relationship_type = '116680003';
