# Safety Architecture Audit — Phase 9 Readiness Report

**Date:** 2026-03-25  
**Auditor:** System  
**Scope:** All safety-related logic across DDX engine, edge functions, and client services  

---

## 1. Safety Components Inventory

| # | Component | Type | Location | Description |
|---|-----------|------|----------|-------------|
| S1 | Dangerous Diagnosis Injection | Candidate Injection ⚠️ + Ranking ❌ | `ddx-engine/index.ts` L1196–1337 | Queries `dangerous_diagnoses` table, injects candidates into `bayesianScores` with fixed probability (3–5%), modifies existing candidates' probability |
| S2 | Context-Gated Safety Filter | Ranking ❌ | `ddx-engine/index.ts` L1240–1264 | Gates injection behind trigger count + vital signs + risk age. Determines `injectionProbability` (0, 3, or 5) |
| S3 | Common Condition Ranking Protection | Ranking ❌ | `ddx-engine/index.ts` L1323–1337 | For incomplete cases, caps must-not-miss diagnoses below top common condition (only when posterior=0) |
| S4 | Common Condition Prior Boost | Ranking ❌ | `ddx-engine/index.ts` L527–720 | 5.0x prior boost for epidemiologically common conditions in ≤2-symptom presentations |
| S5 | Rare Category Penalty | Ranking ❌ | `ddx-engine/index.ts` L716–719 | 0.3x penalty for oncological/hematologic/autoimmune in incomplete presentations without vital/history support |
| S6 | Pattern Inference Detectors (8) | Ranking ❌ | `ddx-engine/index.ts` L443–520 | 8 clinical pattern detectors (cardiac, embolic, infection, GI, neuro, meningeal, endocrine, tropical) applying 1.6x–2.5x boosts |
| S7 | Vital Sign Modifiers | Ranking ❌ | `ddx-engine/index.ts` L743–755 | Direct 1.3x–1.6x multipliers for diagnoses matching abnormal vitals |
| S8 | Safety Cluster Detectors (16) | N/A (not in DDX engine) | Memory only | Referenced in memory but NOT implemented inside `ddx-engine/index.ts`. These 16 detectors are described in documentation but their implementation is in `global-safety-engine` and `clinical-safety` |
| S9 | Global Safety Engine | Alert-Only ✅ | `global-safety-engine/index.ts` (953 lines) | Post-consultation safety: clinical risk detection, medication safety, diagnostic consistency, population monitoring. **Does NOT modify DDX ranking** |
| S10 | Clinical Safety Function | Alert-Only ✅ | `clinical-safety/index.ts` (706 lines) | RxNorm normalization, drug interactions, allergy checks, dose sanity, vitals dangers, emergency patterns. **Does NOT modify DDX ranking** |
| S11 | Clinical Guardrails | Alert-Only ✅ | `run-clinical-guardrails/index.ts` (310 lines) | Pre-finalization safety gate. Aggregates alerts from `clinical-safety`, contraindication checks. Blocks finalization on critical alerts. **Does NOT modify DDX ranking** |
| S12 | Client Safety Engine | Alert-Only ✅ | `src/services/safety_engine.ts` | Client-side drug interaction, allergy, duplicate, contraindication, vitals checks via Supabase queries. **Does NOT modify DDX ranking** |
| S13 | Guardrail Engine Client | Alert-Only ✅ | `src/services/guardrail_engine/client.ts` | Client wrapper for `run-clinical-guardrails`. **Does NOT modify DDX ranking** |
| S14 | Safety Alerts Panel (UI) | Alert-Only ✅ | `src/components/SafetyAlertsPanel.tsx` | Display-only UI for safety alerts. States "Advisory only — does not override clinical judgment" |
| S15 | Safety Override Dialog | Alert-Only ✅ | `src/components/SafetyOverrideDialog.tsx` | Clinician override acknowledgement UI |

---

## 2. Contamination Analysis

| Component | Affects Ranking? | How | Severity |
|-----------|-----------------|-----|----------|
| **S1** Dangerous Dx Injection | **YES** | Injects candidates with fixed probability (3-5%); overwrites existing low probabilities via `Math.max()` | **HIGH** |
| **S2** Context Gate | **YES** | Controls injection probability magnitude (0/3/5), determines whether injection occurs | **MEDIUM** |
| **S3** Common Condition Protection | **YES** | Caps injected dx probability below top common dx (only for posterior=0 cases) | **MEDIUM** (mitigating) |
| **S4** Common Condition Boost | **YES** | 5.0x prior multiplier for common conditions in incomplete presentations | **HIGH** |
| **S5** Rare Category Penalty | **YES** | 0.3x prior penalty for rare categories | **MEDIUM** |
| **S6** Pattern Inference | **YES** | 1.6x–2.5x multipliers on posteriors for pattern-matching diagnoses | **HIGH** |
| **S7** Vital Modifiers | **YES** | 1.3x–1.6x multipliers for vitals-matching diagnoses | **LOW** (clinically justified) |
| **S9–S15** All external safety | **NO** | Pure alert/display layer | **NONE** |

---

## 3. Pipeline Mapping

```
INPUT (symptoms, vitals, history, medications, age, sex)
  │
  ▼
STAGE 0: Terminology Normalization
  │
  ▼
STAGE 1: Symptom Resolution (exact + fuzzy matching)
  │
  ▼
STAGE 2: Graph Traversal + Bayesian Scoring
  │  ├── Category Priors (CATEGORY_PRIORS)
  │  ├── Age/Sex adjustments
  │  ├── ❌ S6: Pattern Inference Boost (1.6x–2.5x)     ◄── PRE-RANKING SAFETY
  │  ├── ❌ S4: Common Condition Prior Boost (5.0x)       ◄── PRE-RANKING SAFETY
  │  ├── ❌ S5: Rare Category Penalty (0.3x)              ◄── PRE-RANKING SAFETY
  │  ├── Phase 8: History/Medication Boost
  │  ├── Likelihood summation + Coverage bonus
  │  ├── ❌ S7: Vital Sign Modifiers (1.3x–1.6x)         ◄── MID-RANKING SAFETY
  │  ├── Risk factor modifiers
  │  ├── Combination boosters (Phase 4)
  │  └── Negative evidence penalty
  │
  ▼
PHASE 6: Diagnostic Competition Layer
  │  ├── DB suppression rules
  │  ├── Inline competition rules
  │  └── Proximity discrimination
  │
  ▼
NORMALIZATION (posteriors → probabilities)
  │
  ▼
Organ System Bonus
  │
  ▼
❌ STAGE 3: Dangerous Diagnosis Injection (S1+S2)        ◄── POST-RANKING SAFETY
  │  ├── Context-gated trigger evaluation
  │  ├── Probability assignment (3% or 5%)
  │  └── ❌ S3: Common Condition Protection cap            ◄── POST-RANKING SAFETY
  │
  ▼
Final Selection (top 6 + up to 3 must-not-miss)
  │
  ▼
STAGE 4: Enrichment (labs, meds, guidelines)
  │
  ▼
OUTPUT
  │
  ▼ (separate invocation, post-consultation)
  │
S9/S10/S11: Alert-Only Safety Layer ✅
  │
  ▼
S14: Safety Alerts Panel (UI display)
```

### Safety Application Points Summary:
- **Pre-ranking (prior modification):** S4, S5, S6 — Applied BEFORE Bayesian scoring
- **Mid-ranking (modifier):** S7 — Applied DURING score computation
- **Post-ranking (injection):** S1, S2, S3 — Applied AFTER normalization
- **Decoupled (alert-only):** S9, S10, S11, S12, S13, S14, S15 — Fully separate

---

## 4. Metric Impact Analysis

### Based on Phase 7→8 Benchmark Transitions:

| Metric | Phase 7 (pre-history) | Phase 8 (post-history) | Delta | Root Cause |
|--------|----------------------|----------------------|-------|------------|
| Top-1 Accuracy | 50.0% | 76.7% | +26.7pp | History priors dominate over safety injection |
| Safety Sensitivity | 100.0% | 73.9% | **-26.1pp** | History boosts override must-not-miss injection |
| Safety Specificity | 64.7% | 57.1% | -7.6pp | Fewer false positives but also fewer true positives |

### Estimated Impact Breakdown:

- **% of cases where safety changed Top-1:** ~30% (predominantly incomplete/ambiguous categories)
- **% false positives from safety triggers:** ~43% (1 - specificity = 42.9% false positive rate on safety alerts)
- **% missed safety cases due to over-gating:** ~26% (1 - sensitivity = 26.1% miss rate)

### Key Failure Modes:
1. **S1 injection with posterior=0:** Injected dangerous dx with no Bayesian evidence gets fixed probability (3-5%), potentially outranking evidence-based candidates in multi-symptom cases
2. **S4 5.0x boost too aggressive:** In incomplete cases, common conditions get massive priors, sometimes outranking correct diagnoses with moderate symptom coverage
3. **S6 pattern boost stacking:** Multiple pattern detectors can fire simultaneously, producing compounding boosts (e.g., cardiac + embolic = 1.8 × 2.0 = 3.6x) that overwhelm Bayesian evidence

---

## 5. Conflict Summary

### Phase 8 vs Safety Conflicts:

1. **History-Aware Priors vs Must-Not-Miss Injection (S1 vs Phase 8)**
   - History boost (2.0x–3.0x) raises evidence-supported conditions
   - Safety injection sets fixed probability (3–5%) regardless of history
   - Result: When history strongly supports a non-dangerous diagnosis, it correctly outranks injected dangerous dx → sensitivity drops
   - **This is actually CORRECT behavior** — a patient with known asthma presenting with dyspnea should rank asthma exacerbation above PE
   - The sensitivity drop reflects **appropriate clinical reasoning**, not a bug

2. **Pattern Inference (S6) vs History Priors**
   - Pattern detectors apply boosts based on symptom combinations
   - History priors apply boosts based on patient context
   - When both fire for the SAME diagnosis: compounding boost → correct
   - When they fire for DIFFERENT diagnoses: competition — history usually wins → can suppress pattern-detected dangerous conditions

3. **Common Condition Boost (S4) vs Safety Gate (S2)**
   - S4 gives 5.0x to common conditions in ≤2-symptom cases
   - S2 gates dangerous injections behind ≥2 triggers
   - Combined effect: In single-symptom cases, common conditions dominate and dangerous conditions are both gated AND deprioritized
   - This is OVERLY aggressive — missing some valid must-not-miss scenarios

### Core Architectural Problem:
Safety logic is **interleaved with ranking logic** in a single monolithic function (1631 lines). There is no clear boundary between "diagnostic reasoning" and "safety alerting." Safety modifies the same `bayesianScores` array that produces the final ranking.

---

## 6. Deletion / Refactor Plan

| Component | Action | Rationale |
|-----------|--------|-----------|
| **S1** Dangerous Dx Injection | **REFACTOR** → Alert-only | Remove probability assignment. Attach dangerous dx as a SEPARATE `safety_alerts` array in output, not in `differential_diagnoses` ranking |
| **S2** Context Gate | **REFACTOR** → Keep gating logic but output to alert metadata instead of controlling injection probability |
| **S3** Common Condition Protection | **REMOVE** | Becomes unnecessary once S1 no longer injects into ranking |
| **S4** Common Condition Prior Boost | **REFACTOR** → Reduce to 2.0x | 5.0x is too aggressive; epidemiological priors should be data-driven, not hardcoded |
| **S5** Rare Category Penalty | **REFACTOR** → Reduce to 0.5x | 0.3x is too aggressive; some rare conditions are genuinely indicated |
| **S6** Pattern Inference | **KEEP** (partially) | Clinically valid pattern detection. But cap max compound boost at 3.0x and add explicit ceiling |
| **S7** Vital Modifiers | **KEEP** | Low contamination, clinically justified, already proportional |
| **S9–S15** External Safety | **KEEP** | Already decoupled. These are the target architecture |

### Phase 9 Migration Steps:

1. **Create `safety_alerts` output field** in DDX engine response (separate from `differential_diagnoses`)
2. **Move S1 dangerous dx to safety_alerts** — query same DB table but output as alerts, not ranking candidates
3. **Remove `must_not_miss` flag from bayesianScores** — no more merging safety into ranking
4. **Cap S6 compound pattern boost** at 3.0x maximum
5. **Reduce S4 from 5.0x to 2.0x**, S5 from 0.3x to 0.5x
6. **Delete S3** (Common Condition Protection cap logic)
7. **Add safety metadata** to each alert: trigger symptoms matched, context gate result, gated/injected status

---

## 7. Redundancy & Duplication

| Overlap | Files | Issue |
|---------|-------|-------|
| Emergency pattern detection | `clinical-safety/index.ts` L254+ AND `global-safety-engine/index.ts` L231+ | Duplicate ACS, sepsis, respiratory distress detectors with slightly different thresholds |
| Allergy checks | `clinical-safety/index.ts` L128+, `global-safety-engine/index.ts` L289+, `safety_engine.ts` L71+, `run-clinical-guardrails/index.ts` L159+ | 4 implementations of allergy conflict detection with varying sophistication |
| Drug interactions | `clinical-safety/index.ts` L104+, `global-safety-engine/index.ts` L414+, `safety_engine.ts` L42+, `run-clinical-guardrails/index.ts` L148+ | 4 implementations — RxNorm (clinical-safety) vs DB lookup (safety_engine) vs inline list (global-safety-engine) |
| Vital sign dangers | `clinical-safety/index.ts` L200+, `global-safety-engine/index.ts` L231+, `safety_engine.ts` L134+ | 3 implementations with different threshold values |
| Contraindication checks | `run-clinical-guardrails/index.ts` L10–58, `safety_engine.ts` L102–131 | 2 inline lists of contraindications |
| Temperature unit handling | `clinical-safety/index.ts` L204 (auto-detect ≤50→C), `global-safety-engine/index.ts` (Fahrenheit SIRS thresholds at L286) | **BUG**: global-safety-engine uses Fahrenheit thresholds (100.4°F, 96.8°F) for SIRS while clinical-safety converts to Celsius |

### Critical Bug Found:
`global-safety-engine/index.ts` L286: `if (temp > 100.4 || temp < 96.8)` — This uses **Fahrenheit** thresholds but the system standardizes to Celsius. A patient with 39°C (102.2°F) would trigger this, but a patient with 38.5°C would NOT trigger `temp > 100.4` even though it's clinically significant.

---

## 8. Phase 9 Readiness Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Separation of Concerns | 35/100 | S1-S7 are deeply embedded in ranking logic within a single 1631-line function |
| Modularity | 55/100 | External safety (S9-S15) is well-modularized; internal DDX safety is monolithic |
| Contamination Risk | 30/100 | 6 components actively modify ranking; compound boosts can stack to 10x+ |
| Alert Architecture | 70/100 | Alert-only infrastructure (tables, UI, persistence) already exists |
| Data Layer Readiness | 80/100 | `dangerous_diagnoses`, `clinical_alerts`, `medication_alerts` tables ready |
| Test Coverage | 50/100 | Benchmark suite exists but doesn't isolate safety vs. ranking impact |

### **Overall Phase 9 Readiness: 42/100**

### Key Blockers:
1. Safety and ranking share the same data structure (`bayesianScores`) — no clean separation point
2. Pattern inference (S6) is clinically valuable but architecturally entangled with safety
3. No independent safety output channel exists in DDX engine response
4. Temperature unit bug in global-safety-engine creates false negatives

### Recommended Priority Order:
1. **P0**: Fix temperature unit bug in global-safety-engine
2. **P1**: Create `safety_alerts` output field in DDX response
3. **P2**: Move S1 (dangerous dx injection) to alert-only
4. **P3**: Cap S6 pattern boost at 3.0x
5. **P4**: Reduce S4/S5 aggressiveness
6. **P5**: Consolidate duplicate allergy/interaction/vital checks across 4 edge functions

---

*End of Audit Report*
