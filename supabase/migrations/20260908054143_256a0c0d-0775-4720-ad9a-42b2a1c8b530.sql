
-- Primary-care prevalence recalibration for bulk-defaulted rare conditions.
-- Bands: very common >=0.05, common 0.02, uncommon 0.005, rare 0.001, very rare 0.0002.
WITH bands(name, prevalence) AS (VALUES
  ('anthrax', 0.0002), ('plague', 0.0002), ('cholera', 0.0008), ('brucellosis', 0.0005),
  ('cat scratch disease', 0.0008), ('herpes simplex encephalitis', 0.0002),
  ('necrotizing fasciitis', 0.0002), ('toxic epidermal necrolysis', 0.0002),
  ('toxic shock syndrome', 0.0003), ('tetanus', 0.0002), ('Lyme disease', 0.0008),
  ('rickettsial infection', 0.001), ('toxoplasmosis', 0.001), ('shigellosis', 0.003),
  ('amoebiasis', 0.004), ('giardiasis', 0.004), ('typhoid fever', 0.004),
  ('chikungunya', 0.004), ('malaria', 0.006), ('Clostridium difficile colitis', 0.001),
  ('orbital cellulitis', 0.0005), ('epiglottitis', 0.0003), ('mastoiditis', 0.0008),
  ('septic arthritis', 0.0008), ('osteomyelitis', 0.001), ('scarlet fever', 0.002),
  ('lung cancer', 0.0008), ('colorectal cancer', 0.0008), ('esophageal cancer', 0.0003),
  ('polyarteritis nodosa', 0.0002), ('Wegener granulomatosis', 0.0002),
  ('pemphigus vulgaris', 0.0003), ('bullous pemphigoid', 0.0005), ('dermatomyositis', 0.0003),
  ('scleroderma', 0.0005), ('autoimmune hepatitis', 0.0005),
  ('constrictive pericarditis', 0.0003), ('dilated cardiomyopathy', 0.001),
  ('Takotsubo cardiomyopathy', 0.0003), ('cor pulmonale', 0.001),
  ('mitral stenosis', 0.001), ('aortic stenosis', 0.003), ('aortic regurgitation', 0.002),
  ('mitral regurgitation', 0.003), ('pulmonary hypertension', 0.001),
  ('Wolff-Parkinson-White syndrome', 0.0005), ('Acute Rheumatic Fever', 0.001),
  ('Acute Cholangitis', 0.001), ('spontaneous bacterial peritonitis', 0.0005),
  ('ischemic colitis', 0.0008), ('mesenteric ischemia', 0.0005),
  ('esophageal varices', 0.001), ('rectal prolapse', 0.001),
  ('primary hyperparathyroidism', 0.001), ('hidradenitis suppurativa', 0.002),
  ('lichen planus', 0.003), ('vitiligo', 0.004), ('alopecia areata', 0.004),
  ('anterior uveitis', 0.002), ('roseola', 0.005), ('ectopic pregnancy', 0.001),
  ('pelvic inflammatory disease', 0.006), ('diabetes mellitus type 1', 0.002),
  ('herpes zoster', 0.008), ('gastroparesis', 0.002), ('thrombocytopenia', 0.003),
  ('bipolar disorder', 0.005), ('post traumatic stress disorder', 0.008),
  ('rotavirus gastroenteritis', 0.008), ('bronchiolitis', 0.01)
)
UPDATE public.disease_priors p
SET base_prevalence = b.prevalence
FROM bands b
JOIN public.diagnoses d
  ON lower(d.diagnosis_name) = lower(b.name) AND d.is_active
WHERE p.diagnosis_id = d.id;

-- Tuberculosis: uncommon globally in primary care, regionally amplified in India.
UPDATE public.disease_priors p
SET base_prevalence = 0.002,
    region_modifier = coalesce(p.region_modifier, '{}'::jsonb) || '{"india": 4.0, "south_asia": 4.0}'::jsonb
FROM public.diagnoses d
WHERE p.diagnosis_id = d.id
  AND d.is_active
  AND lower(d.diagnosis_name) IN ('tuberculosis', 'pulmonary tuberculosis', 'tuberculosis pulmonary');
