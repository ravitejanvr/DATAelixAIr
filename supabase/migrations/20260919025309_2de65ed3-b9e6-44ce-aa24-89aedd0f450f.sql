-- Resolve the last 2 of 9 clinical_guidelines duplicate pairs from #22 —
-- IDSA/UTI and ACG/peptic ulcer disease, the two where the Pass A and
-- Pass B rows gave genuinely conflicting clinical guidance and needed an
-- actual content review rather than a pick-the-newer-one deactivation
-- (see #24 for the other 6 pairs, which didn't have this problem).
--
-- IDSA / urinary tract infection: the two rows didn't actually disagree —
-- Pass B (ec218579) was a lossy compression of Pass A (a1788ef8) that
-- dropped the FDA fluoroquinolone boxed-warning detail and the
-- complicated-UTI/pyelonephritis treatment pathway. Merged Pass B's one
-- real addition (explicit culture guidance for complicated/recurrent UTI)
-- into Pass A, which becomes the canonical row; Pass B is deactivated.
--
-- ACG / peptic ulcer disease: the two rows gave OPPOSITE guidance on
-- whether clarithromycin triple therapy is appropriate first-line.
-- Independently validated against two LLMs, both citing the same primary
-- source: Chey WD, Howden CW, Moss SF, et al. "ACG Clinical Guideline:
-- Treatment of Helicobacter pylori Infection." Am J Gastroenterol.
-- 2024;119(9):1730-1753. DOI 10.14309/ajg.0000000000002968. Current (2024)
-- ACG guidance avoids empiric clarithromycin-containing regimens without
-- demonstrated susceptibility, superseding the 2017 guideline's <15%
-- resistance threshold — Pass A (af2e5502) was directionally correct,
-- Pass B (cc749b88) reflected the superseded 2017 approach. Pass A
-- becomes the canonical row, corrected and expanded per the 2024
-- guideline; Pass B is deactivated.

UPDATE public.clinical_guidelines
SET
  title = 'Urinary Tract Infection Management (IDSA, with FDA Fluoroquinolone Safety Restrictions)',
  source = 'IDSA, incorporating FDA fluoroquinolone boxed warnings (2016/2018)',
  summary = 'Guidelines for treatment of acute uncomplicated cystitis and pyelonephritis, with FDA fluoroquinolone safety restrictions and culture guidance for complicated/recurrent UTI',
  recommendation_text = 'Uncomplicated cystitis: nitrofurantoin 5 days, TMP-SMX 3 days (if local resistance <20%), or fosfomycin single dose. Fluoroquinolones are NOT first- or second-line for uncomplicated cystitis (FDA boxed warnings: tendon rupture, peripheral neuropathy, CNS effects, aortic dissection); reserve for complicated UTI/pyelonephritis when no alternative exists. Complicated UTI/pyelonephritis: ceftriaxone or other parenteral agent, fluoroquinolone only if benefit outweighs risk. Obtain urine culture for complicated or recurrent UTI.',
  keywords = ARRAY['UTI', 'cystitis', 'pyelonephritis', 'dysuria', 'nitrofurantoin', 'urine culture']
WHERE id = 'a1788ef8-7589-4180-8937-2a154b347fb0';

UPDATE public.clinical_guidelines
SET
  title = 'H. pylori Eradication in Peptic Ulcer Disease (ACG 2024)',
  source = 'ACG 2024',
  summary = 'ACG 2024 guideline for H. pylori eradication in peptic ulcer disease (Chey et al., Am J Gastroenterol 2024;119(9):1730-1753, DOI 10.14309/ajg.0000000000002968) — supersedes the 2017 guideline''s empiric clarithromycin-first approach',
  recommendation_text = 'Test all peptic ulcer disease patients for H. pylori. For treatment-naive patients with unknown antibiotic susceptibility, 14-day optimized bismuth quadruple therapy (PPI + bismuth + metronidazole + tetracycline) is the preferred empiric regimen; rifabutin triple therapy and vonoprazan-amoxicillin dual therapy are suggested empiric alternatives. Avoid clarithromycin-containing regimens empirically unless clarithromycin susceptibility has been demonstrated (ACG 2024 superseded the 2017 <15%-resistance threshold for empiric clarithromycin triple therapy). Confirm eradication with a urea breath test, stool antigen test, or biopsy-based test at least 4 weeks after completing therapy; hold PPIs for 2 weeks and antibiotics/bismuth for 4 weeks beforehand. Continue PPI for ulcer healing and discontinue NSAIDs where possible.',
  keywords = ARRAY['peptic ulcer', 'H. pylori', 'PPI', 'dyspepsia', 'bismuth quadruple therapy'],
  guideline_url = 'https://doi.org/10.14309/ajg.0000000000002968'
WHERE id = 'af2e5502-6abc-4844-a11c-676f2cfc2994';

UPDATE public.clinical_guidelines
SET is_active = false
WHERE id IN (
  'ec218579-b4db-471d-9341-7c2b93c1f83f', -- IDSA UTI, Pass B (superseded by merged a1788ef8)
  'cc749b88-c124-4748-85ce-84e53a67c8e8'  -- ACG peptic ulcer, Pass B (superseded 2017-style approach)
);
