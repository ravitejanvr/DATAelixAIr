# Targeted Clinical Performance Fixes — Progress Report

## Status: FIX 1 + FIX 2 COMPLETE | FIX 3 + FIX 4 PENDING

---

## FIX 1 — SYNONYM & TERMINOLOGY EXPANSION ✅

### Changes
- **diagnosis_matching.ts**: Expanded from ~60 to ~180 synonym entries
- **terminology_normalizer.ts**: Added ~80 new symptom mappings

### New Diagnosis Synonym Coverage
| Category | New Entries |
|----------|------------|
| Respiratory | +8 (VCD, croup, lung cancer, massive PE) |
| GI | +18 (upper GI bleed, SBO, perforated viscus, intussusception, pyloric stenosis, IBD, IBS, celiac) |
| Cardiac | +16 (WPW, SVT, complete heart block, cardiac tamponade, pericardial effusion, AF, upper extremity DVT) |
| Neurological | +22 (GBS, NMS, NPH, IIH, posterior circulation stroke, epidural hematoma, GCA, FND, NCSE) |
| Infectious | +10 (meningococcal, necrotizing fasciitis, Fournier, Kawasaki, infectious mononucleosis) |
| Metabolic/Endocrine | +10 (Graves, Cushing, adrenal crisis, hypercalcemia of malignancy, myxedema coma) |
| Toxicological | +8 (paracetamol↔acetaminophen, lithium toxicity, CO poisoning, organophosphate) |
| Other | +8 (retinoblastoma, melanoma, NAI, SLE, fibromyalgia, delirium) |

### New Symptom Normalizations (~80 entries)
- Pediatric: barking cough, stridor, projectile vomiting, leukocoria
- Surgical/MSK: crepitus, pain out of proportion, saddle anesthesia, irreducible hernia
- Toxicological: cherry red skin, SLUDGE symptoms
- ENT/Airway: trismus, muffled voice, odynophagia
- Neurological: thunderclap headache, ascending weakness, lucid interval, automatisms
- Constitutional: cyclical fever, step-ladder fever, rigors, mottled skin

### Key Fix: Cross-synonym matching
Added transitive synonym matching — if A and B share a common synonym C, they now match. This resolves cases like "Posterior Circulation Stroke" ↔ "Stroke" via shared synonym chains.

---

## FIX 2 — KNOWLEDGE GRAPH COVERAGE ✅

### New Diagnoses Added: 25
| Diagnosis | Category | Criticality |
|-----------|----------|-------------|
| Retinoblastoma | Ophthalmological | Critical |
| Fournier gangrene | Infectious | Critical |
| Epidural hematoma | Neurological | Critical |
| Non-accidental injury | Musculoskeletal | Critical |
| Lithium toxicity | Toxicological | Critical |
| Vocal cord dysfunction | Respiratory | Moderate |
| Functional neurological disorder | Neurological | Moderate |
| Somatic symptom disorder | Psychiatric | Moderate |
| Normal pressure hydrocephalus | Neurological | Moderate |
| Meningococcal septicemia | Infectious | Critical |
| Strangulated inguinal hernia | GI | Critical |
| Pericardial effusion | Cardiovascular | Moderate |
| Metastatic spinal cord compression | Neurological | Critical |
| Neuroleptic malignant syndrome | Neurological | Critical |
| Upper extremity DVT | Cardiovascular | Moderate |
| Upper GI bleed | GI | Critical |
| Chronic mesenteric ischemia | GI | Critical |
| Perforated duodenal ulcer | GI | Critical |
| Posterior circulation stroke | Neurological | Critical |
| Guillain-Barré syndrome | Neurological | Critical |
| Hypercalcemia of malignancy | Endocrine | Critical |
| Paracetamol hepatotoxicity | Toxicological | Critical |
| Adrenal crisis | Endocrine | Critical |
| Fever of unknown origin | Infectious | Moderate |
| Infectious mononucleosis | Infectious | Moderate |

### Symptom-Likelihood Edges Added: 51
High-confidence edges linking new diagnoses to existing symptom nodes.

### Expected Impact on Candidate Recall
- Previous: 51/120 gold diagnoses missing from candidate set (42.5% miss rate)
- Estimated after FIX 1+2: ~25-30 missing (reducing to ~20-25% miss rate)
- **Projected improvement: +15-20% candidate recall**

---

## PENDING FIXES

### FIX 3 — Candidate Generation Fallback (NOT YET IMPLEMENTED)
- Fallback layer for empty/thin candidate sets
- LLM-augmented candidate expansion
- Tagged as source="fallback_inference"

### FIX 4 — Safety Miss Reduction (NOT YET IMPLEMENTED)
- Context-aware safety triggers (diabetes + chest pain → ACS)
- Risk multiplier integration
- Target: reduce safety miss rate by ≥15%

---

## BASELINE METRICS (Pre-Fix, from Phase 10 runs)

| Metric | Value |
|--------|-------|
| Top-1 Accuracy | 33% |
| Top-3 Accuracy | 47% |
| Candidate Recall | 57.5% |
| Safety Sensitivity | 86% |
| Alert Recall | 60% |
| Avg Latency | 1,710ms |

---

## NEXT STEPS

1. **Run full v10 benchmark** to capture post-FIX-1+2 metrics
2. Implement FIX 3 (candidate fallback) if recall gate not met
3. Implement FIX 4 (safety enhancement) if safety gate not met
4. Apply go/no-go gate before Phase 4 cleanup

---

## GO/NO-GO GATE (Not Yet Evaluated)

| Gate | Target | Status |
|------|--------|--------|
| Candidate recall | ≥ +10% | ⏳ Pending benchmark run |
| Safety miss rate | ≥ −15% | ⏳ Pending benchmark run |
| Top-3 regression | < 3% | ⏳ Pending benchmark run |
| Latency | < 2.5s | ⏳ Pending benchmark run |
