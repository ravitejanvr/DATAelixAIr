# DATAelixAIr Diagnostic Reasoning System — Full Audit Report
## Date: 2026-03-15

---

# CURRENT SYSTEM STATE

| Table | Count | Target | Gap |
|---|---|---|---|
| symptom_likelihoods | 5,507 | 12,000 | 6,493 edges needed |
| symptom_localisation_edges | 123 | 400+ | 277 edges needed |
| symptom_physiology_map | 906 | 2,000+ | 1,094 edges needed |
| symptom_cluster_edges | 87 | 200+ | 113 edges needed |
| cluster_nodes (syndromes) | 15 | 25+ | 10 clusters needed |
| cluster_disease_edges | 40 | 100+ | 60 edges needed |
| disease_system_tags | 421 | 500+ | ~79 needed |
| dangerous_diagnoses | 110 | 150+ | ~40 triggers needed |
| disease_priors | 566 | 600+ | OK (needs calibration) |
| active diagnoses | 392 | 420+ | ~28 missing |
| symptoms | 1,847 | — | Many orphaned (0 edges) |
| risk_factor_modifiers | 173 | 300+ | 127 needed |
| duration_modifiers | 84 | 150+ | 66 needed |
| onset_modifiers | 56 | 100+ | 44 needed |
| vital_sign_modifiers | 46 | 80+ | 34 needed |
| symptom_cluster_modifiers | 27 | 50+ | 23 needed |
| symptom_specificity | 284 | 500+ | 216 needed |

**Current Benchmark:** Top-1 ≈ 50%, Top-3 ≈ 77%, Recall ≈ 93%, Safety ≈ 77%
**Target Benchmark:** Top-1 ≥ 70%, Top-3 ≥ 90%, Recall ≥ 97%, Safety = 100%

---

# PART 1 — SYSTEM AUDIT: IDENTIFIED WEAKNESSES

## A. Missing Symptom-Disease Relationships

### Critical Symptom Hubs With Low Edge Density:
| Symptom | Current Edges | Minimum Target | Priority |
|---|---|---|---|
| dysuria | 6 | 15+ | CRITICAL |
| urinary frequency | 8 | 15+ | CRITICAL |
| constipation | 18 | 30+ | HIGH |
| back pain | 22 | 35+ | HIGH |
| edema | 23 | 30+ | HIGH |
| joint pain | 24 | 30+ | HIGH |
| sore throat | 26 | 30+ | MEDIUM |
| syncope | 29 | 35+ | HIGH |
| diarrhea | 35 | 40+ | MEDIUM |
| palpitations | 35 | 40+ | MEDIUM |

### Zero-Edge Symptoms (Critical Clinical Signs):
- `stiff neck` — CRITICAL for meningitis detection
- `acid reflux` — CRITICAL for GERD differentiation
- `dysmenorrhea` — Important for gynecological presentations
- `otalgia` — Important for otitis/referred pain
- `urinary frequency` — separate from "frequency" (ambiguous)
- `joint effusion` — Important for septic arthritis/gout
- `mild headache` — Important for tension headache differentiation

## B. Diseases Not Retrieved During Candidate Generation

### Missing Primary Care Diagnoses (not in diagnoses table or inactive):
1. **Costochondritis** — #1 cause of non-cardiac chest pain in primary care
2. **Tension headache** (as distinct entity) — Most common headache type
3. **Functional dyspepsia** — Common GI presentation
4. **BPPV (Benign Paroxysmal Positional Vertigo)** — Most common cause of vertigo
5. **Plantar fasciitis** — Most common cause of heel pain
6. **Rotator cuff tendinitis** — Most common shoulder pain cause
7. **Lateral epicondylitis (tennis elbow)** — Common MSK complaint
8. **Hemorrhoids** — Extremely common, often presenting as rectal bleeding
9. **Anal fissure** — Common cause of rectal pain/bleeding
10. **Tinea pedis (athlete's foot)** — Very common dermatologic condition
11. **Sciatica** (as distinct from lumbar disc herniation)
12. **Viral URI** (as alias — exists as "viral upper respiratory infection")

### Diagnoses With Critically Low Edge Count (≤7 edges):
- viral gastroenteritis: 7 edges (needs 15+)
- viral pharyngitis: 8 edges (needs 12+)
- otitis externa: 7 edges (needs 10+)
- cholelithiasis: 7 edges (needs 12+)
- depression: 8 edges (needs 15+)
- chronic sinusitis: 8 edges (needs 12+)

## C. Weak Symptom Hubs Causing Diagnostic Blind Spots

### Hub: Dysuria/Urinary Symptoms
- Only 6 edges for dysuria, 8 for urinary frequency
- Missing connections to: prostatitis, urethritis, STIs, interstitial cystitis, vaginitis, kidney stones
- **Impact:** UTI over-diagnosed, pyelonephritis under-differentiated

### Hub: Back Pain
- Only 22 edges for back pain
- Missing connections to: costochondritis, AAA, pancreatitis referred pain, renal colic, endometriosis
- Missing: cauda equina syndrome safety trigger for back pain + urinary retention

### Hub: Chest Pain
- 49 edges (reasonable) but missing: costochondritis, anxiety/panic attack, herpes zoster, musculoskeletal chest wall pain
- **Impact:** Cardiac causes over-weighted vs. benign causes

### Hub: Dizziness
- 53 edges but missing: BPPV (most common cause!), orthostatic hypotension, medication side effects
- **Impact:** Serious causes over-represented vs. benign positional vertigo

## D. Diseases Consistently Ranked Incorrectly

Based on architectural analysis:
1. **Viral URI vs. bacterial sinusitis** — No suppression logic; sinusitis over-ranked early
2. **Tension headache vs. migraine** — Tension headache missing as entity; migraine over-diagnosed
3. **Costochondritis vs. ACS** — Costochondritis missing entirely; chest pain defaults to cardiac
4. **GERD vs. peptic ulcer** — Insufficient differentiation signals (alarm symptoms)
5. **Functional dyspepsia vs. organic GI disease** — Functional diagnoses missing
6. **BPPV vs. central vertigo** — BPPV missing; dizziness skews toward serious causes

## E. Safety-Critical Diagnoses Insufficiently Weighted

### Missing Safety Triggers:
| Condition | Missing Trigger Symptom | Priority |
|---|---|---|
| Cauda equina syndrome | back pain + urinary retention | CRITICAL |
| Aortic dissection | sudden back pain (not just chest) | HIGH |
| Ectopic pregnancy | lower abdominal pain + amenorrhea | COVERED but needs expansion |
| Sepsis | confusion + fever (elderly) | Partially covered |
| PE | leg swelling + dyspnea (Wells) | Need more triggers |
| DKA | polyuria + polydipsia + vomiting | Need more triggers |
| Acute angle-closure glaucoma | eye pain + vision loss + headache | MISSING |
| Bowel obstruction | absolute constipation + vomiting + distension | Partially covered |

---

# PART 2 — PRIMARY CARE PRESENTATION MODEL

## Top 15 Symptom Hubs and Required Diagnosis Coverage

### Hub 1: CHEST PAIN
**Current edges:** 49 | **Target:** 65+
| Diagnosis | Likelihood | Status |
|---|---|---|
| Acute coronary syndrome | 0.15 | ✅ Present |
| Costochondritis | 0.25 | ❌ MISSING DIAGNOSIS |
| GERD/reflux esophagitis | 0.15 | ✅ Present |
| Anxiety/panic attack | 0.12 | Partial |
| Musculoskeletal chest wall pain | 0.15 | ❌ MISSING |
| Pulmonary embolism | 0.05 | ✅ Present |
| Pneumonia | 0.08 | ✅ Present |
| Pneumothorax | 0.03 | ✅ Present |
| Pericarditis | 0.04 | ✅ Present |
| Aortic dissection | 0.02 | ✅ Present |
| Herpes zoster (pre-eruption) | 0.03 | ❌ WEAK |
| Pleuritis | 0.05 | ✅ Present |

### Hub 2: ABDOMINAL PAIN
**Current edges:** 81 | **Target:** 90+
| Diagnosis | Likelihood | Status |
|---|---|---|
| Acute gastroenteritis | 0.20 | ✅ Present |
| GERD | 0.10 | ✅ Present |
| Peptic ulcer disease | 0.08 | ✅ Present |
| Appendicitis | 0.07 | ✅ Present |
| Cholecystitis | 0.06 | ✅ Present |
| Renal colic | 0.05 | ✅ Present |
| IBS | 0.08 | ✅ Present |
| Diverticulitis | 0.04 | ✅ Present |
| Pancreatitis | 0.03 | ✅ Present |
| Ectopic pregnancy | 0.03 | ✅ Present |
| Functional dyspepsia | 0.06 | ❌ MISSING |
| Mesenteric ischemia | 0.02 | Check |
| Bowel obstruction | 0.03 | ✅ Present |
| Constipation-related | 0.05 | ❌ WEAK |
| Hemorrhoids (rectal pain) | 0.04 | ❌ MISSING |

### Hub 3: HEADACHE
**Current edges:** 91 | **Target:** 95+
| Diagnosis | Likelihood | Status |
|---|---|---|
| Tension headache | 0.35 | ❌ MISSING DIAGNOSIS |
| Migraine | 0.25 | ✅ Present |
| Sinusitis | 0.10 | ✅ Present |
| Medication overuse headache | 0.05 | Check |
| Cluster headache | 0.03 | ✅ Present |
| Subarachnoid hemorrhage | 0.01 | ✅ Present (safety) |
| Meningitis | 0.02 | ✅ Present (safety) |
| Temporal arteritis | 0.02 | Check |
| Intracranial hypertension | 0.01 | ✅ Present |
| Cervicogenic headache | 0.03 | Check |
| Hypertensive crisis | 0.02 | Check |

### Hub 4: FEVER
**Current edges:** 150 | **Good density**
Key gaps: Need stronger differentiation between viral/bacterial causes

### Hub 5: COUGH
**Current edges:** 55 | **Target:** 70+
| Diagnosis | Likelihood | Status |
|---|---|---|
| Viral URI | 0.30 | ✅ Present |
| Acute bronchitis | 0.20 | ✅ Present |
| Pneumonia | 0.10 | ✅ Present |
| Asthma | 0.08 | ✅ Present |
| COPD exacerbation | 0.06 | ✅ Present |
| Post-nasal drip | 0.08 | ❌ MISSING |
| GERD (cough variant) | 0.05 | ❌ WEAK |
| Pertussis | 0.02 | Check |
| ACE inhibitor cough | 0.03 | ❌ MISSING |
| TB | 0.02 | ✅ Present |
| Lung cancer | 0.01 | ✅ Present |

### Hub 6: SHORTNESS OF BREATH / DYSPNEA
**Current edges:** 68 + 45 = 113 combined | **Good but needs consolidation**
Key gaps: COPD vs asthma differentiation, deconditioning, obesity

### Hub 7: DIZZINESS
**Current edges:** 53 | **Target:** 60+
| Diagnosis | Likelihood | Status |
|---|---|---|
| BPPV | 0.30 | ❌ MISSING DIAGNOSIS |
| Orthostatic hypotension | 0.10 | Check |
| Vestibular neuritis | 0.08 | Check |
| Ménière's disease | 0.05 | Check |
| Anxiety | 0.10 | Partial |
| Anemia | 0.08 | ✅ Present |
| Medication side effect | 0.05 | ❌ MISSING |
| Stroke/TIA | 0.03 | ✅ Present |
| Cardiac arrhythmia | 0.05 | ✅ Present |
| Hypoglycemia | 0.04 | ✅ Present |

### Hub 8: DYSURIA
**Current edges:** 6 | **Target:** 15+ (CRITICAL GAP)**
| Diagnosis | Likelihood | Status |
|---|---|---|
| UTI (lower) | 0.40 | ✅ but edge weak |
| Pyelonephritis | 0.10 | ✅ but edge weak |
| Urethritis/STI | 0.08 | ❌ MISSING |
| Prostatitis | 0.08 | Check |
| Vaginitis | 0.06 | ❌ MISSING |
| Interstitial cystitis | 0.04 | Check |
| Kidney stone | 0.05 | ✅ but edge weak |
| BPH | 0.05 | Check |

### Hub 9: BACK PAIN
**Current edges:** 22 | **Target:** 35+ (HIGH GAP)**
| Diagnosis | Likelihood | Status |
|---|---|---|
| Mechanical low back pain / strain | 0.40 | Check |
| Lumbar disc herniation | 0.12 | ✅ Present |
| Sciatica | 0.08 | ❌ MISSING |
| Spinal stenosis | 0.05 | Check |
| Ankylosing spondylitis | 0.03 | Check |
| Renal colic | 0.06 | ✅ but edge may be weak |
| Osteoarthritis | 0.05 | ✅ Present |
| Compression fracture | 0.03 | Check |
| Pyelonephritis (referred) | 0.04 | ❌ WEAK |
| Cauda equina syndrome | 0.01 | ❌ SAFETY GAP |
| AAA (elderly) | 0.01 | Check |

### Hub 10: SKIN RASH
**Current edges:** 45 | **Target:** 55+
Key gaps: tinea, drug eruptions, viral exanthems

### Hub 11: JOINT PAIN
**Current edges:** 24 | **Target:** 35+
Key gaps: osteoarthritis differentiation, tendinopathies, reactive arthritis

### Hub 12: SORE THROAT
**Current edges:** 26 | **Target:** 30+
Key gaps: viral vs strep differentiation signals, peritonsillar abscess

### Hub 13: DIARRHEA
**Current edges:** 35 | **Target:** 40+
Key gaps: C. difficile, IBS-D, medication-induced, malabsorption

### Hub 14: SYNCOPE
**Current edges:** 29 | **Target:** 35+
Key gaps: vasovagal (most common!), orthostatic, cardiac arrhythmia differentiation

### Hub 15: FATIGUE
**Current edges:** 202 | **Good density** — needs specificity calibration (too many weak edges dilute ranking)

---

# PART 3 — KNOWLEDGE GRAPH EXPANSION PLAN

## Priority 1: Missing Diagnoses to Create (28 entities)
1. Costochondritis
2. Tension-type headache
3. BPPV (benign paroxysmal positional vertigo)
4. Functional dyspepsia
5. Hemorrhoids
6. Anal fissure
7. Sciatica
8. Plantar fasciitis
9. Rotator cuff tendinitis
10. Lateral epicondylitis
11. Tinea pedis
12. Post-nasal drip syndrome
13. ACE inhibitor-induced cough
14. Orthostatic hypotension
15. Vestibular neuritis
16. Medication overuse headache
17. Musculoskeletal chest wall pain
18. Mechanical low back pain/strain
19. Vasovagal syncope
20. Drug eruption
21. Urethritis
22. Vaginitis
23. Prostatitis (acute)
24. Cauda equina syndrome
25. Acute angle-closure glaucoma
26. Cervicogenic headache
27. Reactive arthritis
28. Viral exanthem

## Priority 2: Symptom-Likelihood Edge Expansion (~6,500 new edges)

### Batch Structure (by organ system):
| Batch | System | Estimated New Edges |
|---|---|---|
| Batch A | Respiratory (URI, bronchitis, asthma, COPD, pneumonia) | 400 |
| Batch B | GI (gastroenteritis, GERD, PUD, IBS, dyspepsia, cholecystitis) | 500 |
| Batch C | MSK (back pain, joint pain, costochondritis, tendinopathies) | 450 |
| Batch D | Neurological (headaches, vertigo, syncope, neuropathy) | 400 |
| Batch E | Urological (UTI, pyelonephritis, prostatitis, kidney stones) | 350 |
| Batch F | Dermatologic (eczema, psoriasis, tinea, cellulitis, rash) | 400 |
| Batch G | Cardiovascular (CHF, CAD, hypertension, arrhythmias, PE) | 350 |
| Batch H | Endocrine (diabetes, thyroid, adrenal) | 300 |
| Batch I | Infectious (influenza, COVID, dengue, malaria, TB) | 400 |
| Batch J | Psychiatric (anxiety, depression, panic, insomnia) | 300 |
| Batch K | ENT (otitis, sinusitis, pharyngitis, tonsillitis) | 250 |
| Batch L | Gynecological (dysmenorrhea, PID, ectopic, vaginitis) | 200 |
| Batch M | Cross-system edges (safety & rare but critical) | 200 |
| **Total** | | **~4,500** |

### Remaining ~2,000 edges from:
- Strengthening existing weak connections
- Adding negative/protective associations
- Connecting zero-edge orphan symptoms

## Priority 3: Symptom Specificity Expansion
Target: 500+ entries (currently 284)
Focus: Add specificity weights for all symptoms with ≥10 edges

---

# PART 4 — CLINICAL SIGNAL EXPANSION

## Risk Factor Modifiers (127 new entries needed)
### Missing High-Impact Risk Factors:
| Risk Factor | Target Diagnoses | Priority |
|---|---|---|
| recent antibiotic use | C. difficile, candidiasis | CRITICAL |
| recent travel (tropical) | dengue, malaria, typhoid | HIGH |
| pregnancy | ectopic, PE, preeclampsia | CRITICAL |
| postpartum | PE, endometritis, depression | HIGH |
| sedentary lifestyle | DVT, PE, metabolic syndrome | HIGH |
| oral contraceptive use | DVT, PE, stroke | HIGH |
| recent surgery | DVT, PE, wound infection | HIGH |
| IV drug use | endocarditis, hepatitis, abscess | HIGH |
| occupational exposure | asbestosis, contact dermatitis | MEDIUM |
| pet exposure | toxoplasmosis, allergic rhinitis | MEDIUM |
| tick exposure | Lyme disease, RMSF | HIGH |
| unprotected sexual contact | STIs, PID, urethritis | HIGH |

## Duration Modifiers (66 new entries needed)
### Missing Key Temporal Relationships:
- Acute cough (<3 weeks) → viral URI, bronchitis
- Chronic cough (>8 weeks) → asthma, GERD, ACE inhibitor, TB
- Acute headache (<24h) → migraine, SAH, meningitis
- Chronic headache (>3 months) → tension-type, medication overuse
- Acute back pain (<6 weeks) → strain, disc herniation
- Chronic back pain (>12 weeks) → degenerative, ankylosing spondylitis
- Acute diarrhea (<2 weeks) → infectious, food poisoning
- Chronic diarrhea (>4 weeks) → IBS, IBD, celiac, malabsorption

## Onset Modifiers (44 new entries needed)
### Critical Onset Patterns:
- Thunderclap onset → SAH, aortic dissection, PE
- Gradual onset → degenerative, inflammatory, neoplastic
- Post-prandial onset → GERD, PUD, gallbladder, mesenteric ischemia
- Nocturnal onset → asthma, GERD, CHF (PND)
- Exertional onset → angina, aortic stenosis, exercise-induced asthma
- Positional → BPPV, GERD, orthostatic hypotension, pericarditis

## Vital Sign Modifiers (34 new entries needed)
### Missing Critical Vital Patterns:
- Bradycardia → hypothyroidism, heart block, raised ICP
- Narrow pulse pressure → cardiac tamponade, aortic stenosis
- Wide pulse pressure → aortic regurgitation, thyrotoxicosis
- Postural BP drop → dehydration, autonomic neuropathy, medication
- Oxygen desaturation on exertion → COPD, PE, ILD

---

# PART 5 — ANATOMICAL LOCALISATION EXPANSION

**Current:** 123 edges across 12 systems
**Target:** 400+ edges

### Critical Gaps by System:
| System | Current | Target | Gap |
|---|---|---|---|
| Musculoskeletal | 4 | 40+ | 36 — CRITICAL |
| Dermatologic | 7 | 25+ | 18 |
| Renal/Urological | 8 | 25+ | 17 |
| Infectious | 9 | 20+ | 11 |
| Immune | 3 | 15+ | 12 |
| Hematologic | 4 | 15+ | 11 |
| Ophthalmologic | 5 | 12+ | 7 |
| ENT | 0 | 20+ | 20 — CRITICAL |
| Gynecological | 0 | 15+ | 15 — CRITICAL |
| Psychiatric | 0 | 10+ | 10 |
| Hepatobiliary | 0 | 10+ | 10 |

### Example Expansions Needed:
**MSK System:** back pain → MSK, joint pain → MSK, joint swelling → MSK, muscle cramps → MSK, morning stiffness → MSK, reduced ROM → MSK, crepitus → MSK, heel pain → MSK

**ENT System:** otalgia → ENT, hearing loss → ENT, tinnitus → ENT, nasal congestion → ENT, post-nasal drip → ENT, hoarseness → ENT, epistaxis → ENT, ear discharge → ENT

**Gynecological:** dysmenorrhea → GYN, vaginal bleeding → GYN, pelvic pain → GYN, vaginal discharge → GYN, amenorrhea → GYN

---

# PART 6 — SYNDROME CLUSTER ENGINE EXPANSION

**Current clusters:** 15 | **Target:** 25+

### Missing Syndrome Clusters:
| Cluster Name | Key Symptoms | Min Activation | Anatomical System |
|---|---|---|---|
| flu_like_syndrome | fever + myalgia + cough + fatigue | 0.4 | Infectious |
| uti_lower_syndrome | dysuria + frequency + urgency | 0.5 | Renal |
| copd_exacerbation_syndrome | dyspnea + cough + sputum + wheeze | 0.5 | Respiratory |
| asthma_exacerbation_syndrome | wheeze + dyspnea + chest tightness + cough | 0.5 | Respiratory |
| migraine_syndrome | severe headache + nausea + photophobia + phonophobia | 0.5 | Neurological |
| vertigo_syndrome | dizziness + nausea + nystagmus ± hearing loss | 0.4 | Neurological |
| nephrolithiasis_syndrome | colicky flank pain + hematuria + nausea | 0.5 | Renal (already exists as renal_colic) |
| msk_inflammatory_syndrome | joint pain + swelling + morning stiffness + warmth | 0.5 | Musculoskeletal |
| dka_syndrome | polyuria + polydipsia + vomiting + abdominal pain + Kussmaul | 0.6 | Endocrine |
| thyrotoxicosis_syndrome | weight loss + tremor + palpitations + heat intolerance | 0.5 | Endocrine |

### Missing Cluster-Disease Edges:
Each new cluster needs 3-5 disease associations with strength weights.

---

# PART 7 — PHYSIOLOGY LAYER EXPANSION

**Current:** 906 mappings | **Target:** 2,000+

### Key Physiological States Missing or Underrepresented:
| Physiology State | Triggering Symptoms | Relevant Diagnoses |
|---|---|---|
| Airway hyperreactivity | wheeze, cough, chest tightness | Asthma, COPD, allergic bronchitis |
| Esophageal acid exposure | heartburn, acid reflux, chest pain | GERD, esophagitis, Barrett's |
| Vestibular dysfunction | vertigo, nystagmus, imbalance | BPPV, vestibular neuritis, Ménière's |
| Musculoskeletal inflammation | joint pain, swelling, stiffness | OA, RA, gout, reactive arthritis |
| Peripheral nerve compression | radiating pain, numbness, tingling | Sciatica, carpal tunnel, cervical radiculopathy |
| Urinary tract mucosal inflammation | dysuria, frequency, urgency | UTI, urethritis, interstitial cystitis |
| Gastric acid hypersecretion | epigastric pain, heartburn, nausea | PUD, gastritis, Zollinger-Ellison |
| Autonomic dysregulation | syncope, presyncope, postural dizziness | Vasovagal, orthostatic hypotension |
| Endolymphatic hydrops | vertigo attacks, hearing loss, tinnitus | Ménière's disease |
| Chest wall inflammation | localized chest pain, tenderness | Costochondritis, Tietze syndrome |

---

# PART 8 — SAFETY ENGINE REPAIR

## Target: 100% Detection of Must-Not-Miss Diagnoses

### Missing Safety Triggers to Add:
| Diagnosis | Trigger Symptom | Priority |
|---|---|---|
| Cauda equina syndrome | back pain + urinary retention | CRITICAL |
| Cauda equina syndrome | saddle anesthesia | CRITICAL |
| Cauda equina syndrome | bilateral leg weakness | CRITICAL |
| Acute angle-closure glaucoma | eye pain + vision loss | CRITICAL |
| Acute angle-closure glaucoma | halos around lights + headache | HIGH |
| Aortic dissection | sudden severe back pain | HIGH |
| Aortic dissection | blood pressure differential between arms | HIGH |
| PE | leg swelling + sudden dyspnea | HIGH |
| PE | hemoptysis + pleuritic chest pain | HIGH |
| DKA | polyuria + polydipsia + vomiting (diabetic) | HIGH |
| Bowel obstruction | absolute constipation + vomiting | HIGH |
| Ruptured AAA | sudden abdominal pain + hypotension (elderly) | CRITICAL |
| Necrotizing fasciitis | rapidly spreading erythema + severe pain | CRITICAL |
| Epidural abscess | back pain + fever + neurological deficit | CRITICAL |

### Bayesian Safety Floor Enhancement:
- All must-not-miss diagnoses should have a minimum posterior floor of 0.05 (5%)
- Safety-critical diagnoses should NEVER be pruned during cognitive pruning stage
- Current pruning threshold should exempt any diagnosis flagged as `must_not_miss`

---

# PART 9 — HYPOTHESIS COMPETITION (DIAGNOSTIC SUPPRESSION)

## New Table Required: `diagnosis_suppression_rules`
| Dominant Diagnosis | Suppressed Diagnosis | Condition | Suppression Factor |
|---|---|---|---|
| Tension headache | Migraine | No nausea/photophobia/aura | 0.5 |
| Migraine | Tension headache | Nausea + photophobia present | 0.3 |
| Viral URI | Acute sinusitis | Duration < 10 days, no facial pain | 0.4 |
| Viral URI | Acute bronchitis | No productive cough | 0.5 |
| UTI (lower) | Pyelonephritis | No fever, no flank pain | 0.3 |
| Pyelonephritis | UTI (lower) | Fever + flank pain present | 0.3 |
| GERD | Peptic ulcer disease | No alarm symptoms (weight loss, GI bleeding, dysphagia) | 0.4 |
| Costochondritis | ACS | Reproducible on palpation, age < 40 | 0.3 |
| BPPV | Central vertigo | Positional trigger, Dix-Hallpike positive | 0.3 |
| Vasovagal syncope | Cardiac syncope | Prodrome present, standing trigger, young | 0.3 |
| Mechanical back pain | Cauda equina | No red flags (urinary retention, saddle anesthesia) | 0.4 |
| Viral gastroenteritis | Appendicitis | No RLQ tenderness, no migration of pain | 0.4 |
| Acute bronchitis | Pneumonia | No fever, no focal signs, no hypoxia | 0.4 |
| Panic disorder | ACS | Young, no risk factors, hyperventilation | 0.3 |
| IBS | IBD | No alarm symptoms, no blood in stool | 0.4 |

---

# PART 10 — PRIORITIZED IMPLEMENTATION PLAN

## Phase 5A: Critical Gaps (Expected Impact: Top-1 +8-10%)
**Priority: IMMEDIATE**
1. ✅ Create 15 missing primary care diagnoses (costochondritis, tension headache, BPPV, etc.)
2. ✅ Wire dysuria/urinary frequency hub (add 25+ edges)
3. ✅ Wire back pain hub (add 15+ edges)
4. ✅ Wire dizziness hub (add 10+ edges including BPPV)
5. ✅ Add 14 missing safety triggers (cauda equina, glaucoma, etc.)
6. ✅ Add 10 new syndrome clusters
7. ✅ Create diagnosis_suppression_rules table + engine integration

## Phase 5B: Density Expansion (Expected Impact: Top-1 +5-7%, Top-3 +8%)
**Priority: HIGH**
1. Execute Batches A-M: ~4,500 new symptom_likelihood edges
2. Expand localisation edges: +277 new mappings
3. Expand physiology mappings: +500 new edges
4. Expand risk factor modifiers: +127 entries
5. Expand duration/onset modifiers: +110 entries
6. Expand vital sign modifiers: +34 entries

## Phase 5C: Calibration & Tuning (Expected Impact: Top-1 +3-5%)
**Priority: MEDIUM**
1. Recalibrate disease priors for new diagnoses
2. Add symptom specificity weights for 216+ symptoms
3. Add cluster-disease edges for new clusters
4. Fine-tune Bayesian safety floor parameters
5. Implement hypothesis competition in orchestrator

## Expected Combined Impact:
| Metric | Current | After 5A | After 5B | After 5C |
|---|---|---|---|---|
| Top-1 Accuracy | 50% | 60% | 67% | 72% |
| Top-3 Accuracy | 77% | 83% | 88% | 92% |
| Candidate Recall | 93% | 96% | 97% | 98% |
| Safety Detection | 77% | 95% | 98% | 100% |

---

## IMPLEMENTATION EXECUTION ORDER

### Step 1: Create missing diagnoses (INSERT into diagnoses table)
### Step 2: Wire symptom-likelihood edges for new + underserved diagnoses
### Step 3: Add safety triggers to dangerous_diagnoses
### Step 4: Create new syndrome clusters + edges
### Step 5: Expand localisation mappings
### Step 6: Expand physiology mappings
### Step 7: Add clinical signal modifiers
### Step 8: Create suppression rules table + engine logic
### Step 9: Recalibrate priors
### Step 10: Run benchmark validation

Each step should be executed as a batched SQL operation with UPSERT semantics to maintain idempotency.
