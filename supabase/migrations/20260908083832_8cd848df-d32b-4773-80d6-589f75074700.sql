-- Refresh stored guideline rows shown to be outdated against current official guidance.
UPDATE public.clinical_guidelines SET
  year = 2018,
  title = 'Urinary Tract Infection (IDSA 2011, with FDA fluoroquinolone restrictions 2016/2018)',
  recommendation_text = 'Uncomplicated cystitis: nitrofurantoin 5 days, TMP-SMX 3 days (if local resistance <20%), or fosfomycin single dose. Fluoroquinolones are NOT first- or second-line for uncomplicated cystitis (FDA boxed warnings: tendon rupture, peripheral neuropathy, CNS effects, aortic dissection); reserve for complicated UTI/pyelonephritis when no alternative exists. Complicated UTI/pyelonephritis: ceftriaxone or other parenteral agent, fluoroquinolone only if benefit outweighs risk.',
  applicable_drugs = ARRAY['nitrofurantoin','trimethoprim-sulfamethoxazole','fosfomycin','ceftriaxone','ciprofloxacin','levofloxacin']
WHERE id = 'a1788ef8-7589-4180-8937-2a154b347fb0';

UPDATE public.clinical_guidelines SET
  year = 2024,
  title = 'Peptic Ulcer Disease and H. pylori (ACG 2024)',
  recommendation_text = 'Test all PUD patients for H. pylori. First-line eradication: bismuth quadruple therapy (PPI + bismuth + metronidazole + tetracycline) for 14 days, or vonoprazan-based regimens; clarithromycin triple therapy is discouraged unless susceptibility is confirmed. Confirm eradication at least 4 weeks after therapy. Continue PPI for ulcer healing and stop NSAIDs where possible.',
  applicable_drugs = ARRAY['omeprazole','vonoprazan','bismuth subsalicylate','metronidazole','tetracycline','amoxicillin','clarithromycin','rifabutin']
WHERE id = 'af2e5502-6abc-4844-a11c-676f2cfc2994';

UPDATE public.clinical_guidelines SET
  year = 2025,
  source_organization = 'American Diabetes Association',
  title = 'ADA Standards of Care in Diabetes 2025 (Type 2 Diabetes)',
  recommendation_text = 'Metformin plus lifestyle modification first-line. Add an SGLT2 inhibitor or GLP-1 receptor agonist early when ASCVD, heart failure, chronic kidney disease, or obesity is present, independent of HbA1c. Sulfonylureas and insulin are reserved for additional glycaemic control or symptomatic hyperglycaemia. FDA cautions: SGLT2 inhibitors (DKA, genital infection, rare Fournier gangrene); GLP-1 agonists and tirzepatide (thyroid C-cell tumour boxed warning, contraindicated in MEN2/medullary thyroid carcinoma history).',
  applicable_drugs = ARRAY['metformin','empagliflozin','dapagliflozin','semaglutide','dulaglutide','tirzepatide','glimepiride','insulin']
WHERE id = '3cce7cbb-8e7a-4d3b-9589-39f8e8d51d28';

UPDATE public.clinical_guidelines SET
  year = 2023,
  recommendation_text = 'Core: exercise, weight management, education for all patients. Topical NSAIDs are preferred over oral NSAIDs; oral NSAIDs short-term with caution. Intra-articular corticosteroid for short-term flare relief. Hyaluronic acid not routinely recommended. Opioids are not recommended.',
  applicable_drugs = ARRAY['topical diclofenac','ibuprofen','naproxen','acetaminophen','intra-articular triamcinolone','duloxetine']
WHERE id = '623c69e0-1481-4239-9126-5077c538fbe9';

UPDATE public.clinical_guidelines SET
  year = 2026,
  title = 'Early Management of Acute Ischemic Stroke (AHA/ASA 2026)',
  recommendation_text = 'IV thrombolysis with alteplase or tenecteplase within 4.5 hours (extendable in selected patients with perfusion imaging). Mechanical thrombectomy up to 24 hours with imaging selection, including expanded populations (large core infarct, basilar occlusion). Blood pressure and antithrombotic management per protocol.',
  applicable_drugs = ARRAY['alteplase','tenecteplase','aspirin','clopidogrel','atorvastatin']
WHERE id = '8fc4ea20-2228-4aa3-b2bf-3912830a1be0';

UPDATE public.clinical_guidelines SET
  year = 2022,
  title = 'ICMR National Treatment Guidelines for Antimicrobial Use',
  recommendation_text = 'UTI: nitrofurantoin first-line for uncomplicated infection. Community-acquired pneumonia: amoxicillin-clavulanate or amoxicillin with a macrolide/doxycycline, guided by local resistance rather than amoxicillin alone. Obtain cultures before antibiotics where feasible and de-escalate on results.',
  applicable_drugs = ARRAY['nitrofurantoin','amoxicillin','amoxicillin-clavulanate','azithromycin','doxycycline','ceftriaxone']
WHERE id = 'f130d92b-513d-40ab-9454-33ed34cd7c17';

UPDATE public.clinical_guidelines SET
  year = 2026,
  title = 'Surviving Sepsis Campaign International Guidelines 2026',
  recommendation_text = 'Measure lactate, obtain blood cultures before antibiotics, give broad-spectrum antibiotics urgently, and resuscitate with balanced crystalloids using individualised volume assessment. Start norepinephrine early as first-line vasopressor for persistent hypotension rather than deferring until fluid loading is complete. Reassess perfusion frequently.',
  applicable_drugs = ARRAY['piperacillin-tazobactam','meropenem','vancomycin','norepinephrine']
WHERE id = 'ef783c57-73cf-4734-a93f-23dfe963a006';

UPDATE public.clinical_guidelines SET
  year = 2024,
  source_organization = 'NICE/BTS/SIGN',
  title = 'Asthma Diagnosis, Monitoring and Management (NICE/BTS/SIGN NG245, 2024)',
  recommendation_text = 'Do not use a short-acting beta-agonist alone as reliever therapy. For adults and adolescents aged 12 and over with poorly controlled asthma, offer low-dose ICS-formoterol as combined maintenance and reliever therapy (MART). Escalate ICS dose or add-on therapy (LTRA, biologics) stepwise if control is inadequate.',
  applicable_drugs = ARRAY['budesonide-formoterol','beclometasone-formoterol','salbutamol','montelukast','mepolizumab','dupilumab']
WHERE id = '5b57902a-4a8c-4ca9-9416-4d008353afae';

UPDATE public.clinical_guidelines SET
  year = 2024,
  source_organization = 'American Headache Society',
  title = 'Migraine Acute and Preventive Treatment (AHS 2024 position statement)',
  recommendation_text = 'Acute: triptans first-line; gepants (rimegepant, ubrogepant) or lasmiditan when triptans are contraindicated or ineffective. Prevention: CGRP-targeting therapies (monoclonal antibodies or atogepant) are reasonable first-line options alongside topiramate, beta-blockers or candesartan. Lasmiditan carries driving-impairment warnings.',
  applicable_drugs = ARRAY['sumatriptan','rizatriptan','rimegepant','ubrogepant','atogepant','lasmiditan','erenumab','fremanezumab','galcanezumab','topiramate','propranolol']
WHERE id = 'f2b9e30c-4266-460c-b74b-e672da259811';

UPDATE public.clinical_guidelines SET
  year = 2022,
  title = 'WHO Consolidated Guidelines on Tuberculosis (Treatment)',
  recommendation_text = 'Drug-susceptible pulmonary TB: standard 6-month regimen (2HRZE/4HR) remains valid; WHO also recommends a 4-month regimen of isoniazid, rifapentine, moxifloxacin and pyrazinamide for eligible patients aged 12 and over. MDR/RR-TB: 6-month BPaLM regimen (bedaquiline, pretomanid, linezolid, moxifloxacin) is preferred over longer regimens. Monitor for linezolid myelosuppression/neuropathy and bedaquiline/moxifloxacin QT prolongation.',
  applicable_drugs = ARRAY['isoniazid','rifampicin','pyrazinamide','ethambutol','rifapentine','moxifloxacin','bedaquiline','pretomanid','linezolid']
WHERE id = '1a2efde3-ee9f-4c23-9a1a-e79f8d641912';
