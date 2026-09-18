-- Deduplicate 6 of the 9 clinical_guidelines pairs from #22 — the
-- low-stakes ones, where the two rows are either genuinely near-identical
-- or the later (Pass B) row is confirmed more complete/current, with no
-- conflicting clinical content between them (unlike the IDSA and ACG pairs
-- in #22, which need a deliberate clinical-content review, not a
-- deactivation).
--
-- superseded_by is deliberately NOT used here: these pairs are not real
-- chronological editions, just two bulk-ingestion passes over the same
-- corpus 45 minutes apart on 2026-03-13. Deactivating the non-canonical
-- row (same mechanism the table already uses everywhere else) is correct;
-- linking them as if one genuinely replaced the other would misrepresent
-- what actually happened.
--
-- Kept (Pass B) / deactivated (Pass A) per pair:
--   ATA / hypothyroidism   — Pass B (66658d1b) is more specific (TSH
--     0.5-2.5 target, elderly/cardiac start-low guidance).
--   WHO / malaria          — Pass B (499abfa3) adds G6PD testing before
--     primaquine.
--   GOLD / COPD            — Pass B (9dac2204) is fuller (adds triple
--     therapy for Group E + pulmonary rehab).
--   KDIGO / chronic kidney disease — Pass B (b598e268) is fuller.
--   ADA / type 2 diabetes  — content genuinely near-identical (differs
--     only in drug-name wording); kept Pass B for consistency with the
--     rest of this batch, not because it's clinically superior.
--   WHO / dengue fever     — same: near-identical, Pass B kept for
--     consistency, not a clinical judgment call.
UPDATE public.clinical_guidelines
SET is_active = false
WHERE id IN (
  '60ebb380-44e7-4a31-bd37-87c97c9744e7', -- ATA hypothyroidism, Pass A (2014)
  '5fb40e29-a589-43ce-9df6-27436ee6fa99', -- WHO malaria, Pass A (2023)
  'dbf9bb26-199a-4957-9152-4c6227f3ffe8', -- GOLD COPD, Pass A
  '5e44edfa-211e-4970-a9a2-24b88f5a0344', -- KDIGO CKD, Pass A
  '64a0621d-0378-47d6-b818-095ebbfef301', -- ADA type 2 diabetes, Pass A
  '8096e387-2484-4a40-bcf4-b6f6a0e8ee70'  -- WHO dengue fever, Pass A
);

-- IDSA / urinary tract infection and ACG / peptic ulcer disease are
-- deliberately NOT touched here — see #22. Their two rows give
-- conflicting clinical guidance and need a content merge/review, not a
-- pick-the-newer-one deactivation.
