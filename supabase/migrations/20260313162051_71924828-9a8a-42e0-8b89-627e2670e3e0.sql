-- Add unique constraint on clinical_guidelines title
ALTER TABLE public.clinical_guidelines ADD CONSTRAINT clinical_guidelines_title_key UNIQUE (title);

-- Add missing anatomical systems
INSERT INTO public.anatomical_systems (system_name, description) VALUES
  ('infectious', 'Infectious disease processes'),
  ('pediatric', 'Pediatric-specific physiological processes'),
  ('ophthalmologic', 'Ophthalmologic/ocular system')
ON CONFLICT DO NOTHING;