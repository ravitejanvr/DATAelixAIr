# Phase 10 Architectural Audit Report
## Safety-Informed Candidate Augmentation

**Auditor Role:** Principal Clinical AI Architect & Systems Safety Auditor  
**Date:** 2026-03-25  
**Audit Scope:** Multi-dimensional validation of Phase 10 proposal  
**Status:** COMPLETE

---

## EXECUTIVE SUMMARY

Phase 10 is **GO WITH CONDITIONS**. The proposal is architecturally sound but requires strict invariants to prevent regression to Phase 8 contamination patterns. The root cause analysis confirms the hypothesis: Phase 9's `if (phase9) continue;` at DDX engine line 1298 removes dangerous diagnoses from `bayesianScores` entirely, meaning conditions that were never retrieved by the knowledge graph's symptom-matching are absent from both ranking AND the candidate set. The safety_alerts[] channel detects them but cannot compensate for their absence in the differential output.

---

## PHASE 1: ARCHITECTURE AUDIT

### Verdict: **PARTIALLY VALID**

### Analysis

**1. Separation of Concerns Assessment**

Phase 10 proposes injecting safety-detected conditions into the *candidate set* without modifying *ranking probabilities*. This is a fundamentally different operation from Phase 8's contamination:

| Dimension | Phase 8 (Contaminated) | Phase 9 (Decoupled) | Phase 10 (Proposed) |
|-----------|----------------------|---------------------|---------------------|
| Candidate generation | Safety injects into candidates | Safety excluded from candidates | Safety augments candidate pool |
| Ranking | Safety overrides probabilities | Pure Bayesian | Pure Bayesian (preserved) |
| Slot reservation | 3 must-not-miss slots | None | None |
| Probability override | Yes (injectionProbability) | No | No |

**2. Is this Phase 8 contamination in disguise?**

**No, but with a critical nuance.** Phase 8 contamination had three components:
- **(S1) Candidate injection** — adding diagnoses to bayesianScores ← Phase 10 does this
- **(S1) Probability override** — setting artificial probability values ← Phase 10 must NOT do this
- **(S6/S7) Ranking protection** — slot reservation, probability caps ← Phase 10 must NOT do this

Phase 10 only re-enables S1's candidate presence, not S1's probability override. The diagnosis enters the candidate pool with `probability: 0` or its natural Bayesian posterior (if any). This is the critical architectural boundary.

**3. Coupling Risk**

The coupling is **one-directional and bounded**: safety detection → candidate set. This is acceptable because:
- Safety detection is independent (cluster patterns, vital triggers)
- The candidate set is an *input* to ranking, not an output
- Ranking remains purely Bayesian

**Risk:** If the implementation assigns ANY non-zero probability during injection, it silently becomes Phase 8.

### Architecture Verdict: **PARTIALLY VALID**
- Valid: Candidate augmentation without ranking influence
- Invalid if: Any probability/ranking override is introduced
- Boundary condition: Must use `posterior: 0, prior: 0, likelihood: 0, probability: 0` for injected candidates, letting Bayesian scoring assign natural probability

---

## PHASE 2: FAILURE MODE ANALYSIS

| # | Failure Mode | Severity | Likelihood | Mitigation |
|---|-------------|----------|------------|------------|
| F1 | **False positive safety → candidate pollution** | MEDIUM | HIGH | Safety cluster detection has 8 patterns with `required >= 2` signals. FP rate is bounded by multi-signal gating. However, adding FP candidates dilutes the top-10 output. **Mitigation:** Max 2 safety-injected candidates. Injected candidates that receive `probability: 0` from Bayesian scoring are placed at bottom of ranking. |
| F2 | **Over-expansion → latency explosion** | LOW | LOW | Candidate set grows by at most 2-3 diagnoses. Knowledge graph lookups for labs/meds are already batched by diagnosis_id. Marginal latency increase ~50-100ms. **Mitigation:** Hard cap of 3 safety-augmented candidates. |
| F3 | **Bias toward safety-heavy organ systems** | MEDIUM | MEDIUM | Systems with more cluster detectors (cardiac=2, pulmonary=2, neuro=2) will have more candidates injected. **Mitigation:** Track injection rate per organ system in monitoring_events. Alert if any system exceeds 40% injection rate. |
| F4 | **Ranking dilution** | MEDIUM | HIGH | Adding candidates with `probability: 0` to a top-10 list pushes real candidates to positions 11+. **Mitigation:** Safety-augmented candidates with zero Bayesian support should be appended AFTER the top-10 Bayesian ranking, not mixed in. Use a separate `safety_candidates[]` section or append with clear `source: "safety_augmentation"` tag. |
| F5 | **Hidden feedback loop** | CRITICAL | LOW | If safety-augmented candidates are persisted to learning/calibration tables, they create a self-reinforcing loop: safety detection → candidate presence → future prior increase → permanent ranking contamination. **Mitigation:** Tag all safety-augmented candidates with `injection_source: "safety_augmentation"`. Exclude from calibration/learning pipelines. |
| F6 | **Phantom candidate presence** | MEDIUM | HIGH | A dangerous diagnosis appears in the differential with 0% probability. Clinicians may interpret presence as "the AI considered it" when in reality the Bayesian engine found zero evidence. **Mitigation:** Clear UI labeling: "Safety-flagged — not supported by probabilistic evidence. Present for clinical awareness only." |
| F7 | **Benchmark gaming** | LOW | MEDIUM | Candidate recall metric will improve simply because safety-detected conditions are now in the candidate set, regardless of ranking quality. **Mitigation:** Separate `organic_candidate_recall` (graph-only) from `augmented_candidate_recall` (graph + safety). Track both. |

---

## PHASE 3: CLINICAL SAFETY VALIDATION

### Safety Gain vs Safety Illusion Analysis

**Safety Gain (Real):**
- Dangerous conditions that are ABSENT from the knowledge graph's symptom-matching will now appear in the differential
- This directly addresses the observed failure: "Gold diagnosis missing from candidate set" in adversarial layer
- Clinical workflow benefit: doctor sees the condition listed, even at low probability, triggering consideration

**Safety Illusion (Risk):**
- A diagnosis at 0% probability in position #8 of 10 may create **false reassurance**: "the AI ranked it low, so it's probably not that"
- This is worse than the diagnosis being absent — absence prompts the doctor's own reasoning; low-ranked presence may suppress it
- **This is the single most dangerous failure mode of Phase 10**

**Mitigation for Safety Illusion:**
1. Safety-augmented candidates MUST be visually distinct in UI (different color, badge, separator)
2. They must NOT receive a probability score — display as "Flagged" not "0.1%"
3. The safety_alerts[] channel must remain the PRIMARY notification mechanism
4. Candidate augmentation is SECONDARY — a backup for candidate completeness metrics only

### Over-Alerting Assessment
- Current safety cluster detection uses multi-signal gating (≥2 symptoms + vital triggers)
- Phase 10 does NOT change detection thresholds — it only routes detected conditions differently
- No increase in alert volume expected
- **Verdict: No additional alert fatigue risk**

---

## PHASE 4: BENCHMARK IMPACT SIMULATION

### Current Baseline (from memory — Phase 9 observed)
- Top-1 Accuracy: ~76.7%
- Top-3 Accuracy: ~83.3%
- Candidate Recall: ~90.0%
- Safety Sensitivity: ~73.9%
- Safety Specificity: ~57.1%

### Predicted Phase 10 Impact

| Metric | Layer | Direction | Magnitude | Confidence |
|--------|-------|-----------|-----------|------------|
| **Top-1 Accuracy** | Noisy | No change | ±0% | HIGH — augmentation doesn't change ranking |
| **Top-1 Accuracy** | Adversarial | Slight improvement | +2-5% | MEDIUM — some adversarial golds are safety conditions that will now appear |
| **Top-3 Accuracy** | Ambiguous | No change | ±0% | HIGH |
| **Candidate Recall** | Adversarial | Significant improvement | +10-15% | HIGH — this is the primary target |
| **Candidate Recall** | Noisy | Marginal improvement | +2-5% | MEDIUM |
| **Safety Sensitivity** | All | Improvement | +5-10% | HIGH — safety-detected conditions are guaranteed in candidate set |
| **Safety Specificity** | All | No change | ±0% | HIGH — detection thresholds unchanged |
| **CAS** | Adversarial | Improvement | +0.05-0.1 | MEDIUM — candidate_recall boosts CAS floor from 0 to 0.3 |

### New Failure Types Predicted
1. **Ranking displacement:** In rare cases where a safety-augmented candidate receives moderate Bayesian support, it could displace a true gold diagnosis from top-10
2. **Metric inflation:** Candidate recall improvement may mask underlying knowledge graph coverage gaps that should be fixed at the data level

---

## PHASE 5: INVARIANT DESIGN

### STRICT INVARIANTS (Non-Negotiable)

```
INVARIANT-1: ZERO PROBABILITY OVERRIDE
  Safety-augmented candidates MUST enter bayesianScores with:
    probability: 0
    posterior: 0  
    prior: 0
    likelihood: 0
  They receive natural Bayesian scoring only if the engine's
  existing logic assigns them a score.

INVARIANT-2: MAX AUGMENTATION CAP
  Maximum 3 safety-augmented candidates per run.
  If >3 safety conditions detected, prioritize by:
    1. Severity (critical > high)
    2. Signal count (more trigger signals = higher priority)

INVARIANT-3: NO RANKING PROTECTION
  Safety-augmented candidates receive NO slot reservation.
  They compete purely on Bayesian probability.
  If they score 0, they appear at the bottom.

INVARIANT-4: SOURCE TAGGING
  All augmented candidates MUST carry:
    injection_source: "safety_augmentation"
    augmented_at: timestamp
  This tag must propagate to:
    - benchmark_suite_results
    - ai_decision_ledger
    - monitoring_events

INVARIANT-5: LEARNING EXCLUSION
  Candidates with injection_source: "safety_augmentation"
  MUST be excluded from:
    - Calibration factor computation
    - Prior adjustment pipelines
    - Meta-learning feedback loops

INVARIANT-6: CANDIDATE SET SIZE LIMIT
  Total candidate set (organic + augmented) ≤ 15.
  If organic candidates already ≥ 12, augmentation is skipped.

INVARIANT-7: DEDUPLICATION
  If a safety-detected condition already exists in bayesianScores
  (from normal graph retrieval), do NOT duplicate it.
  Instead, tag the existing entry with must_not_miss: true
  but do NOT modify its probability.

INVARIANT-8: FEATURE FLAG GATING
  Phase 10 MUST be gated behind:
    enable_phase10_candidate_augmentation: boolean (default: false)
  Independent of enable_phase9_safety_decoupling.
  Phase 10 requires Phase 9 to be active.
```

---

## PHASE 6: IMPLEMENTATION STRATEGY

### Rollout Plan

**Stage 1: Shadow Mode (Week 1-2)**
- Implement augmentation logic but DO NOT include augmented candidates in `finalDifferential`
- Log what WOULD have been augmented to `monitoring_events`
- Run v10 benchmark suite in shadow mode
- Compare shadow results vs actual results

**Stage 2: Canary Cases (Week 3)**
- Enable augmentation for adversarial benchmark cases only
- Verify invariants hold
- Confirm no ranking regression on control/noisy layers

**Stage 3: Full Activation (Week 4)**
- Enable feature flag for all cases
- Run full v10 comparison: Phase 8 vs Phase 9 vs Phase 10
- Lock results as immutable baseline

### Dual-Run Comparison Strategy
```
Run 1: phase9 (current baseline)
Run 2: phase10 (candidate augmentation enabled)
Compare: candidate_recall delta, top-1 delta, safety_sensitivity delta
Rollback if: top-1 drops >3% OR safety_specificity drops >5%
```

### Rollback Conditions
1. Top-1 accuracy drops >3% from Phase 9 baseline
2. Safety specificity drops >5%
3. Any invariant violation detected in monitoring_events
4. Latency p95 increases >500ms

### Canary Cases (Use These First)
- ADV-001 (Silent MI in diabetic)
- ADV-005 (Subtle PE, minimal symptoms)
- ADV-010 (Early sepsis, no fever)
- NOISY-015 (Chest pain with anxiety noise)

---

## PHASE 7: GO / NO-GO DECISION

### Verdict: **GO WITH CONDITIONS**

### Reasons for GO:
1. Root cause is confirmed: Phase 9 creates a candidate completeness gap at DDX line 1298
2. The fix is architecturally clean: augment candidates without touching ranking
3. Impact is bounded and measurable
4. Feature flag provides instant rollback

### Conditions (ALL must be met before production activation):
1. All 8 invariants implemented and verified
2. Shadow mode run completed with zero invariant violations
3. v10 benchmark shows candidate_recall improvement ≥5% with top-1 regression <2%
4. Safety-augmented candidates carry source tags in all downstream systems
5. UI displays augmented candidates with distinct visual treatment
6. Learning/calibration pipelines confirmed to exclude augmented candidates

### Blocking Risks:
- **NONE** — all risks are mitigable with invariants
- Implementation risk is LOW if code changes are confined to DDX engine lines 1296-1331

---

## PHASE 8: EXECUTION BLUEPRINT

### Step-by-Step Implementation

**Step 1: Feature Flag** (src/services/feature_flags.ts)
- Add `enable_phase10_candidate_augmentation: boolean` (default: false)
- Add helper: `isCandidateAugmentationEnabled()`

**Step 2: DDX Engine Modification** (supabase/functions/ddx-engine/index.ts)
- Location: Lines 1296-1299 (the `if (phase9) continue;` block)
- Change: Replace skip with conditional augmentation

```typescript
// Phase 9 + Phase 10: Add to candidate set with ZERO probability
if (phase9) {
  if (phase10_augment) {
    const existingIdx = bayesianScores.findIndex(d => d.diagnosis_id === diagInfo.id);
    if (existingIdx < 0 && safetyAugmentedCount < 3) {
      bayesianScores.push({
        diagnosis_id: diagInfo.id,
        diagnosis_name: diagInfo.diagnosis_name,
        icd10_code: diagInfo.icd10_code,
        category: diagInfo.category,
        probability: 0,  // INVARIANT-1: Zero probability
        posterior: 0,
        prior: 0,
        likelihood: 0,
        symptom_coverage: 0,
        supporting_symptoms: info.triggers,
        contradicting_factors: [],
        must_not_miss: true,
        emergency_protocol: row.emergency_protocol,
        guideline_source: row.guideline_source,
        severity_level: row.severity_level,
        injection_source: "safety_augmentation",  // INVARIANT-4
      });
      safetyAugmentedCount++;
    } else if (existingIdx >= 0) {
      // INVARIANT-7: Tag but don't modify probability
      bayesianScores[existingIdx].must_not_miss = true;
    }
  }
  continue;  // Still skip probability override
}
```

**Step 3: Pass Flag Through Pipeline**
- DDX engine request body: add `phase10_augment` boolean
- Read from request at line 263 alongside `phase9`
- Client: `src/services/ddx_engine/client.ts` — pass flag from feature_flags

**Step 4: Monitoring Enhancement**
- Add `safety_augmented_count` to monitoring_events metadata
- Add `augmented_candidates` array to response output

**Step 5: Benchmark Runner Update** (src/services/benchmark_v10/runner.ts)
- Add `V10PipelineMode = "phase8" | "phase9" | "phase10"`
- Phase 10 mode: `phase9: true, phase10_augment: true`

### Code Boundaries — DO NOT TOUCH:
- Bayesian scoring logic (lines 900-1180)
- Competition/suppression rules
- Normalization/softmax
- Final probability assignment
- Common condition ranking protection logic
- Cluster detection patterns (lines 1337-1425)

### Testing Strategy:
1. Unit: Verify injected candidates have `probability: 0`
2. Integration: Run 5 canary adversarial cases, confirm candidate_recall improvement
3. Regression: Run full control layer, confirm zero regression
4. Benchmark: Full v10 comparison (P8 vs P9 vs P10)
5. Invariant: Automated check that no augmented candidate has `probability > 0` at injection time

---

## APPENDIX: ROOT CAUSE TRACE

```
DDX Engine Line 1298-1299:
  // Phase 9: DO NOT inject into ranking — safety_alerts[] handles it
  if (phase9) continue;

Effect:
  - Dangerous diagnosis passes context gate (shouldInject = true)
  - Added to safetyAlerts[] ✓
  - Added to dangerousDiagnosisDetails[] ✓  
  - NOT added to bayesianScores[] ✗ ← THE GAP
  - Therefore NOT in finalDifferential ✗
  - Therefore candidate_recall = false for this condition
  
Phase 10 Fix:
  - Add to bayesianScores[] with probability: 0
  - Let Bayesian engine assign natural score (may remain 0)
  - Appears in finalDifferential only if it earns ranking position
  - candidate_recall = true ✓
  - Ranking integrity preserved ✓
```
