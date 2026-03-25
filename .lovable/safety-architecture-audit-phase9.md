# Safety Architecture Audit — Phase 9 Readiness (v2)

**Date:** 2026-03-25  
**Auditor:** DATAelixAIr Clinical AI Systems Auditor  
**Scope:** All safety-related logic across DDX Engine, Global Safety Engine, Clinical Safety, Guardrails, and client-side services  
**Objective:** Identify ranking contamination, classify all safety components, and define Phase 9 migration plan

---

## 1. Safety Components Inventory

| ID | Component | Type | Location | Description |
|----|-----------|------|----------|-------------|
| S1 | Dangerous Diagnosis Injection | Candidate Injection ⚠️ → Ranking ❌ | `ddx-engine/index.ts` L1196–1311 | Queries `dangerous_diagnoses` table, injects candidates with fixed probability (3–5%) into `bayesianScores[]` array. Sets `posterior: 0` for new injections. |
| S2 | Common Condition Prior Boost | Ranking ❌ | `ddx-engine/index.ts` L696–720 | For ≤2-symptom cases, applies **5.0x** prior multiplier to common conditions matching `COMMON_CONDITION_BOOSTS` map. Penalizes rare categories (oncological, hematologic, autoimmune) with **0.3x** when no abnormal vitals or history. |
| S3 | Pattern Inference Layer | Ranking ❌ | `ddx-engine/index.ts` L442–520 | 8 clinical pattern detectors (cardiac, embolic, infection, GI, neuro, meningeal, endocrine, tropical). Apply **1.6x–2.5x** boosts to matching diagnoses via `patternBoost` multiplier. |
| S4 | Safety Cluster Detectors (DDX) | Ranking ❌ | `ddx-engine/index.ts` L442–520 (same as S3) | Patterns 1–8 overlap with safety-critical conditions (sepsis, PE, meningitis, ACS). These are compound pattern multipliers that feed directly into the Bayesian scoring formula. |
| S5 | Negative Evidence Penalties | Ranking (Beneficial) ✅ | `ddx-engine/index.ts` L838–1001 | Applies 0.3x–0.6x penalties when expected cardinal symptoms are absent. Floor at 0.15. Legitimately improves ranking accuracy — NOT a safety concern. |
| S6 | Common Condition Ranking Protection | Ranking ❌ | `ddx-engine/index.ts` L1323–1337 | Post-normalization: for incomplete presentations, caps injected must-not-miss diagnoses (posterior=0) below top common condition. |
| S7 | Must-Not-Miss Final Selection | Output Shaping ⚠️ | `ddx-engine/index.ts` L1339–1351 | Reserves up to 3 slots in final output for `must_not_miss` diagnoses with probability > 0. These compete for ranking position in the final sorted output. |
| S8 | Physiology Context Boost | Ranking ❌ | `ddx-engine/index.ts` L1313–1321 | If `physiological_context.candidate_diagnosis_ids` provided, applies **1.2x** probability boost. Minor contamination. |
| S9 | Global Safety Engine | Alert-Only ✅ | `global-safety-engine/index.ts` (953 lines) | Post-finalization module with 6 sub-modules: Clinical Risk Detection, Medication Safety, Diagnostic Consistency, Population Monitoring, Outcome Tracking, Must-Not-Miss Detection. Writes to `clinical_alerts`, `medication_alerts`, `diagnostic_flags` tables. **Does NOT affect DDX ranking.** |
| S10 | Clinical Safety Function | Alert-Only ✅ | `clinical-safety/index.ts` (706 lines) | RxNorm normalization, drug interactions (via RxNav API), allergy checks, dose sanity, vitals dangers, emergency pattern matching, context completeness. Returns alerts without ranking modification. |
| S11 | Run Clinical Guardrails | Alert-Only ✅ | `run-clinical-guardrails/index.ts` (310 lines) | Orchestrator that calls `clinical-safety`, adds contraindication checks, persists alerts to DB. Determines if finalization should be blocked (but doesn't alter DDX). |
| S12 | Client Safety Engine | Alert-Only ✅ | `src/services/safety_engine.ts` (160 lines) | Client-side safety validation: drug interactions, allergy conflicts, duplicates, contraindications, vitals checks. Returns safety score. **Does NOT affect DDX ranking.** |
| S13 | Safety Layer API (Types) | Alert-Only ✅ | `src/layers/safety/api.ts` (301 lines) | Type definitions + fetch/acknowledge helpers for safety alerts. Pure data access layer. |
| S14 | Organ System Bonus | Ranking ❌ (minor) | `ddx-engine/index.ts` L1170–1191 | Post-normalization: applies **1.25x** probability multiplier to diagnoses matching organ systems with ≥2 symptoms. Can re-order final rankings. |

---

## 2. Contamination Analysis

| ID | Component | Affects Ranking? | How | Severity |
|----|-----------|-----------------|-----|----------|
| **S1** | Dangerous Dx Injection | **YES** | Injects candidates with fixed probability (3–5%) into Bayesian array. New injections have `posterior: 0` but non-zero `probability`. Occupies up to 3 slots in final output. | **HIGH** |
| **S2** | Common Condition Boost | **YES** | 5.0x prior multiplier dominates scoring for ≤2 symptom cases. 0.3x penalty on rare categories. Can make common conditions ~16x more likely than rare ones regardless of evidence. | **HIGH** |
| **S3** | Pattern Inference | **YES** | Compound boosts up to 2.5x applied multiplicatively within posterior formula. Pattern 6 (meningeal) at 2.5x is the most aggressive. | **MEDIUM** |
| **S4** | Safety Clusters (=S3) | **YES** | Same as S3. Sepsis, PE, ACS patterns boost safety-critical diagnoses in the ranking layer. | **MEDIUM** |
| **S5** | Negative Evidence | **YES** (beneficial) | Correctly penalizes diagnoses missing cardinal symptoms. Helps accuracy. | **NONE** (keep) |
| **S6** | Ranking Protection | **YES** | Caps injected-only must-not-miss below top common condition. Actually helpful but is a safety-ranking entanglement. | **LOW** |
| **S7** | Must-Not-Miss Selection | **YES** | Reserves final output slots. Can push out legitimately ranked diagnoses from the top-10. | **MEDIUM** |
| **S8** | Physiology Boost | **YES** | 1.2x on matching physiology candidates. Minor effect. | **LOW** |
| **S9** | Global Safety Engine | **NO** | Post-consultation alert-only. | **NONE** |
| **S10** | Clinical Safety | **NO** | Alert-only function. | **NONE** |
| **S11** | Guardrails | **NO** | Alert-only orchestrator. | **NONE** |
| **S12** | Client Safety Engine | **NO** | Client-side alert-only. | **NONE** |
| **S13** | Safety API Layer | **NO** | Types and data access only. | **NONE** |
| **S14** | Organ System Bonus | **YES** | 1.25x post-normalization. Can swap adjacent ranks. | **LOW** |

---

## 3. Pipeline Mapping

```
Input (symptoms, vitals, history, meds)
  │
  ├── STAGE 0: Terminology Normalization
  │
  ├── STAGE 1: Symptom Resolution (exact + fuzzy)
  │
  ├── STAGE 2: Graph Traversal + Bayesian Scoring
  │     │
  │     ├── [S2] Common Condition Prior Boost (5.0x) ← PRE-RANKING ❌
  │     ├── Phase 8: History-Aware Prior Boost (2.0–3.0x) ← PRE-RANKING (beneficial)
  │     ├── Phase 8: Medication-Informed Prior Boost (2.0x) ← PRE-RANKING (beneficial)
  │     ├── [S3/S4] Pattern Inference Boost (1.6–2.5x) ← MID-RANKING ❌
  │     ├── Likelihood summation (additive)
  │     ├── Coverage bonus (coverage^1.5)
  │     ├── Vital modifiers (1.3–1.6x)
  │     ├── Risk factor modifiers (1.3x)
  │     ├── Combination boosts (Phase 4, 1.5–3.0x)
  │     ├── [S5] Negative Evidence Penalties (0.15–1.0x) ← MID-RANKING ✅
  │     │
  │     └── rawPosterior = prior × Σlikelihood × coverage × vitals × risk × combo × pattern × history × med
  │
  ├── PHASE 6: Diagnostic Competition Layer
  │     ├── DB-driven suppression rules (0.2–0.5x)
  │     ├── Inline competition rules (0.2–0.5x)
  │     └── Proximity discrimination (0.7x)
  │
  ├── NORMALIZATION: posteriors → probabilities (sum to ~100)
  │
  ├── [S14] Organ System Bonus (1.25x post-norm) ← POST-RANKING ❌
  │
  ├── STAGE 3: Dangerous Diagnosis Injection ← POST-RANKING ❌
  │     ├── [S1] Context-gated injection (≥2 triggers, or 1+vitals/risk)
  │     ├── Fixed probability assignment (3–5%)
  │     ├── [S6] Common condition ranking protection
  │     └── [S7] Must-not-miss slot reservation (up to 3)
  │
  ├── [S8] Physiology Context Boost (1.2x) ← POST-RANKING ❌
  │
  ├── Final Selection: top 6 + up to 3 must-not-miss
  │
  └── OUTPUT
        ├── differential_diagnoses (with must_not_miss flag)
        ├── dangerous_diagnoses (separate array)
        ├── recommended_labs
        ├── suggested_medications
        └── reasoning_traces

────── COMPLETELY SEPARATE PIPELINE ──────

  POST-CONSULTATION:
  ├── [S9] Global Safety Engine → clinical_alerts, medication_alerts, diagnostic_flags
  ├── [S10] Clinical Safety → drug/allergy/dose/vitals alerts
  ├── [S11] Guardrails → orchestrates S10 + contraindications → blocks finalization if critical
  └── [S12] Client Safety Engine → client-side medication validation
```

---

## 4. Metric Impact Analysis

### From Phase 7→8 benchmark data:

| Metric | Phase 7 | Phase 8 | Delta | Root Cause |
|--------|---------|---------|-------|------------|
| Top-1 Accuracy | 50.0% | 76.7% | +26.7pp | History-aware priors correctly boosted common conditions |
| Top-3 Accuracy | 73.3% | 83.3% | +10.0pp | Better prior calibration |
| Recall | 73.3% | 90.0% | +16.7pp | History priors helped ambiguous cases |
| Safety Sensitivity | 100.0% | 73.9% | **-26.1pp** | History priors outcompete injected safety alerts |
| Safety Specificity | 64.7% | 57.1% | -7.6pp | More safety injections due to broader trigger matching |

### Ranking contamination quantification:

- **% of cases where safety changed Top-1**: Estimated ~20% (6/30 scenarios). S1 injection pushes safety diagnoses into Top-3 even when evidence doesn't support them.
- **False positive rate from safety triggers**: ~43% of injected dangerous diagnoses are false positives (specificity = 57.1%).
- **Safety sensitivity contribution**: S1 injection is the SOLE mechanism for safety sensitivity. Without it, 26.1% of dangerous conditions would be missed from Top-5 entirely.

### Key contamination patterns:

1. **S2 (5.0x common boost)** — In incomplete presentations, this makes common conditions so dominant that even genuine dangerous diagnoses with Bayesian support cannot compete.
2. **S1 (fixed probability injection)** — Assigns 3–5% probability regardless of actual evidence, diluting the differential.
3. **S3 (pattern boost up to 2.5x)** — The meningeal pattern (2.5x) and neuro deficit pattern (2.0x) can push safety-critical diagnoses to Top-1 even with weak symptom coverage.

---

## 5. Conflict Summary

### Why Phase 7 caused specificity problems:
Phase 7's context gating (S1) correctly reduced false safety injections from ~82% to ~35%. However, the 5.0x common condition boost (S2) and 0.3x rare penalty were introduced simultaneously, creating a **double suppression**: rare-but-real dangerous conditions got penalized by BOTH the gating AND the prior penalty.

### Why Phase 8 caused sensitivity problems:
Phase 8's history-aware priors (2.0–3.0x boosts for known conditions) directly conflict with S1 injection:
- **Example**: Patient with diabetes history presenting with vomiting + confusion → history boost makes "Type 2 Diabetes" 3.0x stronger, which outranks the injected "Diabetic Ketoacidosis" (probability: 5%). DKA is the actual dangerous diagnosis that should rank high.
- **Root cause**: History-aware priors modify the SAME scoring variable (prior) that safety injection tries to influence (probability), but history priors are multiplicative and compound with likelihood while safety injection uses a flat fixed value.

### Core architectural conflict:
The DDX engine uses a SINGLE output channel (`differential_diagnoses[]`) for BOTH evidence-based diagnoses and safety-critical alerts. This forces safety alerts to compete with evidence-based diagnoses in the same ranking space, creating an inherent tension between accuracy and sensitivity.

---

## 6. Deletion / Refactor Plan

| ID | Component | Action | Rationale |
|----|-----------|--------|-----------|
| **S1** | Dangerous Dx Injection | **REFACTOR** → Move to `safety_alerts` output channel | Stop injecting into `bayesianScores[]`. Instead, output as separate `safety_alerts[]` array that UI displays as independent clinical overlay. The DDX ranking stays purely evidence-based. |
| **S2** | Common Condition Boost (5.0x) | **REFACTOR** → Reduce to 2.0x | 5.0x is excessive and distorts priors. 2.0x provides sufficient epidemiological weighting without overwhelming Bayesian evidence. |
| **S2b** | Rare Category Penalty (0.3x) | **REFACTOR** → Change to 0.5x | 0.3x is too aggressive. 0.5x provides sufficient suppression while allowing rare conditions with genuine evidence to surface. |
| **S3** | Pattern Inference Boosts | **REFACTOR** → Cap at 2.0x max | The meningeal pattern at 2.5x is too aggressive. Cap all patterns at 2.0x to prevent single-pattern domination. |
| **S4** | Safety Clusters (=S3) | **KEEP** (after S3 cap) | Pattern detection is clinically valuable when properly bounded. |
| **S5** | Negative Evidence | **KEEP** | Correctly improves accuracy. No safety contamination. |
| **S6** | Ranking Protection | **REMOVE** | No longer needed once S1 moves to separate output. |
| **S7** | Must-Not-Miss Selection | **REMOVE** | No longer needed once safety alerts have their own output channel. |
| **S8** | Physiology Boost | **KEEP** (monitor) | Minor effect (1.2x). Acceptable. |
| **S9** | Global Safety Engine | **KEEP** | Already correctly decoupled. |
| **S10** | Clinical Safety | **KEEP** | Already correctly decoupled. |
| **S11** | Guardrails | **KEEP** | Already correctly decoupled. |
| **S12** | Client Safety Engine | **KEEP** | Already correctly decoupled. |
| **S13** | Safety API Layer | **KEEP** | Types and data access only. |
| **S14** | Organ System Bonus | **REFACTOR** → Move before normalization | Post-normalization multiplier is architecturally incorrect. Should be integrated as a pre-normalization modifier. |

### Phase 9 Implementation Steps (ordered):

1. **Create `safety_alerts[]` output channel** in DDX engine response. Separate from `differential_diagnoses[]`.
2. **Move S1 logic**: Dangerous diagnoses go to `safety_alerts[]` with full metadata (severity, protocol, triggers) but NO injection into `bayesianScores[]`.
3. **Remove S6 and S7**: No more ranking protection or slot reservation needed.
4. **Calibrate S2**: Common boost 5.0x → 2.0x, rare penalty 0.3x → 0.5x.
5. **Cap S3**: All pattern boosts ≤ 2.0x.
6. **Fix S14**: Move organ system bonus before normalization.
7. **Fix temperature bug**: Global safety engine L286 uses Fahrenheit thresholds for SIRS check — must convert to Celsius.
8. **Run benchmark**: Expect Top-1 accuracy ~75%+ (maintained), Safety Sensitivity tracked separately via `safety_alerts[]` presence (should be ~100%).

---

## 7. Redundancy & Duplication

| Issue | Components | Description |
|-------|-----------|-------------|
| **Duplicate must-not-miss detection** | S1 (DDX engine) + S9/Module 6 (Global Safety Engine L736–785) | Both query `dangerous_diagnoses` table and match trigger symptoms. S1 does it for ranking injection; S9 does it for post-consultation alerts. After Phase 9, only S9 should remain for alerts. |
| **Duplicate drug interaction checks** | S10 (clinical-safety, RxNav API) + S11 (guardrails, inline list) + S12 (client safety, DB query) + S9 (global safety engine, inline list) | Four separate implementations of drug interaction checking with different data sources (RxNav API vs hardcoded list vs DB table). Should consolidate to single source of truth. |
| **Duplicate allergy checks** | S10 (clinical-safety) + S11 (guardrails, via S10) + S12 (client safety) + S9 (global safety engine) | Three separate allergy checking implementations with slightly different class maps. |
| **Duplicate vitals danger checks** | S10 (clinical-safety L200–251) + S9 (global safety engine L193–283) + S12 (client safety L134–144) | Three implementations with different thresholds and rules. |
| **Temperature unit mismatch** | S9 (global-safety-engine L286) | SIRS check uses `temp > 100.4 || temp < 96.8` (Fahrenheit) but the engine's vitals may be in Celsius. The `clinical-safety` function (S10) correctly auto-detects units at L203–208, but the global safety engine does NOT. **BUG.** |

---

## 8. Phase 9 Readiness Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Separation of Concerns | 35/40 | Post-consultation safety (S9–S12) is well-separated. DDX-internal safety (S1–S4, S6–S7) is fully entangled. |
| Modularity | 20/30 | External modules are modular. DDX engine is a 1631-line monolith with safety logic inlined. |
| Contamination Risk | 10/30 | 6 components directly modify ranking. S1+S2 are HIGH severity. Pattern boosts compound multiplicatively. |

### **Overall Phase 9 Readiness Score: 65/100**

Up from 42/100 in the previous audit due to:
- Phase 7 context gating reduced blind injection
- Phase 8 history-aware priors provide a legitimate alternative to safety injection for many cases
- Post-consultation safety pipeline (S9–S12) is already fully decoupled

### Remaining blockers:
1. **S1 still injects into ranking** — the single biggest architectural issue
2. **S2 boost is too aggressive** at 5.0x — distorts evidence-based ranking
3. **No separate output channel** for safety alerts in DDX response
4. **Temperature unit bug** in global safety engine SIRS check

---

## Summary

The system has **14 identified safety components**. Of these:
- **6 contaminate ranking** (S1, S2, S3/S4, S6, S7, S14) — all within `ddx-engine/index.ts`
- **5 are correctly decoupled** (S9, S10, S11, S12, S13)
- **1 is beneficial** (S5 negative evidence)
- **1 is minor** (S8 physiology boost)

The primary Phase 9 refactor requires **3 deletions** (S6, S7, ranking protection code), **4 calibrations** (S2 boost, S2b penalty, S3 cap, S14 position), and **1 architectural change** (S1 → separate output channel).

**Estimated implementation effort**: ~200 lines changed in `ddx-engine/index.ts` + new `safety_alerts[]` field in response schema.
