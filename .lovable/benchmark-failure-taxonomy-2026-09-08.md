# Benchmark v10 — Case-by-case failure taxonomy
Run `v10_phase10_1788843296589` (120 cases, live engine, post-terminology-freeze)

## Split
| Bucket | Cases |
|---|---|
| Correct top-1 | 42 (35%) |
| Generated but outranked (gold in candidate set, rank 2–5) | 33 |
| Generated but ranked >5 | 10 |
| Gold never generated | 35 (29%) |

Gold rank distribution among recalled cases: r1 42, r2 16, r3 10, r4 3, r5 4, >5 10.

## The 35 "never generated" — evidence against a knowledge-volume gap
Checked each gold label against `diagnoses` + `symptom_likelihoods`:

**A. Present in KB with rich edges, still not surfaced (21 cases) — retrieval/ranking defect, not knowledge**
Pneumonia (96 edges), COPD exacerbation (47), SLE-lookup collision (41), Cholecystitis (40), Stable angina (38),
Iron deficiency anemia (36), Lymphoma (35), Sinusitis (33), Infective endocarditis (22), Multiple sclerosis (22),
Melanoma (21), AKI (18), Ectopic pregnancy (18), Atrial fibrillation (17), Seizure (16), Pleural effusion (14),
Septic arthritis (13), Costochondritis (11), Testicular torsion (11), Chronic mesenteric ischemia (10),
Complete heart block (8).

**B. Present but thin (≤3 edges) — genuine knowledge gap (10 cases)**
Fournier gangrene (3), Guillain-Barré (3), Normal pressure hydrocephalus (2),
Pericardial effusion (0), Prostatitis (0), Vocal cord dysfunction (0), Functional neurological disorder (0),
Somatic symptom disorder (0), Fever of unknown origin (0), Non-accidental injury (0).

**C. Absent from KB entirely (4 cases)**
Panic attack, Vasovagal syncope, Meniere's disease, Lumbar spinal stenosis.

**D. Matching defect found**
`SLE` fuzzy-matched to `measles` / `obstructive sleep apnea` (substring match on a 3-letter abbreviation).
Abbreviation handling must be an explicit alias table, never substring.

## Conclusion
Prior work already proved bulk edge expansion yields ~nothing (+3 recall, −1 top-1).
This run confirms why: 21 of 35 misses are conditions the KB already knows well.
The bottleneck is candidate retrieval + ranking discrimination, in this order:
1. Retrieval/top-K truncation before scoring (why does a 96-edge pneumonia never enter the set?)
2. Ranking discrimination for recalled-but-outranked cases (43 cases, most at rank 2–3)
3. Targeted knowledge authoring for buckets B + C (14 cases only)
4. Alias/abbreviation table to remove wrong matches
