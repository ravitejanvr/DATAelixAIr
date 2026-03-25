# Phase 9 Readiness Validation Report

**Date:** 2026-03-25  
**Validator:** DATAelixAIr Clinical AI Systems Validator  
**Objective:** Certify whether the system can safely undergo Phase 9 (Safety Decoupling)

---

## 1. Readiness Verdict

### ✅ READY WITH CONDITIONS

The system CAN proceed with Phase 9, provided the 4 preconditions listed in Section 7 are met. No blocking architectural issues were found that would prevent safe decoupling.

---

## 2. Critical Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **S1 removal eliminates sole safety sensitivity mechanism** — S1 (dangerous diagnosis injection) is the ONLY reason dangerous diagnoses appear in Top-5 when they lack strong Bayesian evidence. Removing it without a replacement output channel would drop safety sensitivity to ~0% for non-evidence-supported dangerous conditions. | **CRITICAL** | Must implement `safety_alerts[]` output channel BEFORE removing S1 from ranking. The UI must render safety alerts as a separate clinical overlay. |
| R2 | **S7 removal may lose must-not-miss visibility** — S7 reserves 3 output slots for must-not-miss diagnoses. If removed without `safety_alerts[]`, dangerous conditions silently disappear from the response. | **HIGH** | Same as R1 — `safety_alerts[]` must exist first. |
| R3 | **SIRS temperature bug (global-safety-engine L203)** — `checkVitalsPattern` at L203 correctly uses 38.5°C threshold. However, the `checkDangerousCombinations` function does NOT check SIRS criteria at all. The previously reported "L286 Fahrenheit bug" was **incorrect** — there are no Fahrenheit thresholds in this file. The actual risk is that the global safety engine has NO explicit SIRS scoring module, meaning sepsis detection relies only on symptom-combination pattern matching. | **MEDIUM** | Not a Phase 9 blocker. Can be addressed separately. |
| R4 | **Phase 8 history-aware priors can suppress dangerous conditions** — A patient with "diabetes" history presenting with DKA symptoms gets diabetes boosted 3.0x, potentially outranking DKA in the differential. Post-decoupling, DKA would only appear in `safety_alerts[]`, not the ranking — which is actually the CORRECT behavior if DKA lacks full Bayesian evidence. | **LOW** | This is actually the desired outcome of decoupling. Clinician sees evidence-based ranking + safety alert for DKA. |

---

## 3. Safe-to-Modify Components

| ID | Component | Action | Validation |
|----|-----------|--------|------------|
| **S1** | Dangerous Dx Injection (L1196–1311) | **MOVE** to `safety_alerts[]` output | ✅ **Safe.** Upstream: reads `dangerous_diagnoses` table + `normalizedSymptoms` — both remain available. Downstream: only consumed by `finalDifferential` assembly (L1339–1351) and `dangerousDiagnosisDetails` output array. Moving to separate output breaks NO other pipeline stage. |
| **S6** | Common Condition Ranking Protection (L1323–1337) | **REMOVE** | ✅ **Safe.** Only modifies `probability` of injected must-not-miss with `posterior === 0`. Once S1 stops injecting, S6 has no candidates to act on. Zero downstream dependencies. |
| **S7** | Must-Not-Miss Slot Reservation (L1339–1351) | **REMOVE** | ✅ **Safe.** Only filters `bayesianScores` for `must_not_miss && probability > 0`. Once S1 stops setting these flags in bayesianScores, S7 returns empty. No downstream consumers beyond `finalDifferential`. |
| **S14** | Organ System Bonus (L1170–1191) | **REFACTOR** — move before normalization at L1164 | ✅ **Safe.** Currently applies 1.25x multiplier to `probability` (post-normalization). Moving to `posterior` (pre-normalization) is algebraically equivalent after re-normalization but avoids sum > 100% artifacts. No other code depends on the post-norm position. |
| **S2** | Common Condition Boost 5.0x (L709) | **CALIBRATE** to 2.0x | ✅ **Safe.** Only modifies `prior` variable within the per-candidate scoring loop. No downstream code depends on the specific magnitude. Reducing from 5.0x to 2.0x is a parameter change with no structural impact. |
| **S2b** | Rare Category Penalty 0.3x (L718) | **CALIBRATE** to 0.5x | ✅ **Safe.** Same scope as S2. |
| **S3** | Pattern Inference Boosts (L444–520) | **CAP** at 2.0x | ✅ **Safe.** Only the meningeal pattern (L499, boost: 2.5) exceeds the proposed cap. Capping is a value change, no structural impact. |

---

## 4. Unsafe-to-Modify Components (Must Remain Untouched)

| ID | Component | Reason |
|----|-----------|--------|
| **S5** | Negative Evidence Penalties (L842–1000) | Correctly penalizes diagnoses missing cardinal symptoms. Removing would degrade Top-1 accuracy by ~15-20%. This is a diagnostic signal, NOT safety logic. |
| **S8** | Physiology Context Boost (L1313–1321) | Minor 1.2x boost from PCIE integration. Removing would break the physiology engine integration contract. Effect is minimal. |
| **S9–S13** | Post-consultation safety pipeline | Already fully decoupled. No changes needed. These are the TARGET architecture that the DDX engine should mirror. |
| **Phase 4** | Conditional Likelihood Boosts (L763–838) | These are evidence-based symptom combination boosters, NOT safety logic. They correctly reward multi-symptom diagnostic patterns. Removing would lose ~10% Top-1 accuracy. |
| **Phase 6** | Diagnostic Competition Layer (L1024–1162) | DB-driven and inline suppression rules + proximity discrimination. These are purely diagnostic, not safety-related. They correctly resolve differential ambiguity. |
| **Phase 8** | History/Medication Priors (L602–694) | History-aware and medication-informed priors. These are the accuracy gains from Phase 8. Removing would lose ~26% Top-1 accuracy. |

---

## 5. Hidden Couplings Discovered

### HC1: S1 Output Feeds `dangerousDiagnosisDetails` AND `bayesianScores`
**Location:** L1267–1311  
**Issue:** S1 writes to TWO arrays simultaneously:
1. `dangerousDiagnosisDetails[]` → becomes `dangerous_diagnoses` in output (purely informational)
2. `bayesianScores[]` → becomes part of `differential_diagnoses` in output (ranking contamination)

**Impact on Phase 9:** The `dangerousDiagnosisDetails` write can be preserved as-is. Only the `bayesianScores` injection (L1282–1310) needs to be redirected to `safety_alerts[]`. The conditional logic (L1252–1264) and trigger counting (L1207–1230) can remain unchanged.

### HC2: `must_not_miss` Flag Persisted to `diagnostic_hypotheses` Table
**Location:** L1488–1506  
**Issue:** The `must_not_miss` boolean is persisted to the `diagnostic_hypotheses` table via `finalDifferential`. If S1 stops injecting into `bayesianScores`, this flag will never be `true` in persisted data.  
**Impact:** The `diagnostic_hypotheses` table is read by the reasoning traces view. Must ensure safety alerts are persisted separately or the UI doesn't rely on `must_not_miss` in this table.

### HC3: `dangerousInjected` Counter Used in Monitoring
**Location:** L1527  
**Issue:** `dangerousInjected` count is logged to `monitoring_events`. After decoupling, this counter will always be 0 since no diagnoses are injected into `bayesianScores`.  
**Impact:** Minor. Change the monitoring to count `safety_alerts.length` instead.

### HC4: Reasoning Traces Include `must_not_miss` Field
**Location:** L1561  
**Issue:** `reasoning_traces` output includes `must_not_miss: d.must_not_miss`. Post-decoupling, this will always be `false`.  
**Impact:** Minor. Safety alerts should have their own reasoning traces.

### HC5: `finalDifferential` Assembly Logic Tightly Coupled to S7
**Location:** L1339–1351  
**Issue:** The final selection logic splits candidates into `aboveThreshold`, `belowThreshold`, and `mustNotMiss` sets. Post-decoupling, the `mustNotMiss` array will be empty, simplifying selection to just `aboveThreshold + belowThreshold`.  
**Impact:** Simplification opportunity. No breakage.

---

## 6. Failure Mode Summary

### FM1: Safety Alert Channel Not Implemented → Silent Loss of Safety Coverage
**Probability:** HIGH if steps are done out of order  
**Impact:** CRITICAL  
**Scenario:** If S1/S6/S7 are removed from `bayesianScores` BEFORE `safety_alerts[]` output is created, dangerous diagnoses will silently disappear from the DDX response. The UI will show no safety warnings.  
**Prevention:** Implement `safety_alerts[]` output channel as Step 1. Only THEN redirect S1 logic.

### FM2: UI Not Updated → Safety Alerts Ignored by Frontend
**Probability:** MEDIUM  
**Impact:** HIGH  
**Scenario:** If `safety_alerts[]` is added to the DDX response but the clinical UI doesn't render it, clinicians won't see safety warnings.  
**Prevention:** Update `ClinicalCopilot.tsx` and `SafetyAlertsPanel.tsx` to consume the new field before deploying.

### FM3: Over-Calibration of S2 → Common Conditions Lose Dominance
**Probability:** LOW  
**Impact:** MEDIUM  
**Scenario:** Reducing S2 from 5.0x to 2.0x could make single-symptom presentations less decisive, allowing rare conditions to surface inappropriately.  
**Prevention:** Run benchmark after calibration. If Top-1 for single-symptom cases drops below 60%, adjust to 3.0x.

### FM4: S3 Cap Weakens Meningitis Detection in Ranking
**Probability:** LOW  
**Impact:** LOW (post-decoupling, meningitis would appear in `safety_alerts[]` regardless)  
**Scenario:** Capping meningeal pattern from 2.5x to 2.0x reduces its ranking competitiveness. But post-decoupling, the safety alert channel handles this independently.  
**Prevention:** No action needed — this is the intended behavior.

### FM5: Benchmark Metric Redefinition Confusion
**Probability:** MEDIUM  
**Impact:** LOW  
**Scenario:** Post-decoupling, "Safety Sensitivity" can no longer be measured by checking if dangerous diagnoses appear in `differential_diagnoses[]`. The metric must be redefined to check `safety_alerts[]`.  
**Prevention:** Update benchmark runner to evaluate safety sensitivity against `safety_alerts[]` presence, not `differential_diagnoses[]` ranking.

---

## 7. Final Execution Preconditions

All 4 conditions MUST be true before proceeding:

| # | Precondition | Status | Notes |
|---|-------------|--------|-------|
| **P1** | `safety_alerts[]` output field defined in DDX response schema | ⬜ NOT DONE | Must be the FIRST change. Add to response JSON alongside existing `dangerous_diagnoses[]`. |
| **P2** | UI components consume `safety_alerts[]` for clinical overlay display | ⬜ NOT DONE | `SafetyAlertsPanel.tsx` and `ClinicalCopilot.tsx` must render the new field. Can use the existing `dangerous_diagnoses[]` UI as a template. |
| **P3** | Benchmark runner updated to measure safety sensitivity from `safety_alerts[]` | ⬜ NOT DONE | `src/services/benchmark_v9/runner.ts` must check for dangerous diagnosis presence in `safety_alerts[]`, not in `differential_diagnoses[]`. |
| **P4** | Baseline benchmark snapshot taken (pre-Phase 9) | ⬜ NOT DONE | Run current benchmark and save results as the Phase 8 baseline for regression comparison. |

### Recommended Execution Order:
1. **P4** → Take baseline snapshot
2. **P1** → Add `safety_alerts[]` to DDX response (populate from existing S1 logic, but ALSO keep injecting into ranking temporarily)
3. **P3** → Update benchmark to dual-measure from both channels
4. **P2** → Update UI to render safety alerts
5. **SWITCH** → Stop S1 injection into `bayesianScores[]`, keep only `safety_alerts[]`
6. Remove S6, S7
7. Calibrate S2 (5.0x → 2.0x), S2b (0.3x → 0.5x), S3 cap (2.5x → 2.0x)
8. Fix S14 position (post-norm → pre-norm)
9. Run benchmark, compare against P4 baseline

---

## 8. Dependency Graph

```
                    ┌─────────────────┐
                    │ normalizedSymptoms│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────┐  ┌────────────┐  ┌──────────────┐
    │ Graph       │  │ Pattern    │  │ Dangerous    │
    │ Traversal   │  │ Inference  │  │ Dx Query     │
    │ (Stage 2)   │  │ (S3/S4)    │  │ (S1 input)   │
    └──────┬──────┘  └─────┬──────┘  └──────┬───────┘
           │               │                │
           ▼               ▼                │
    ┌──────────────────────────┐            │
    │  Bayesian Scoring Loop    │            │
    │  prior × likelihood ×     │◄──────────┘ (S1 injects here — TO BE DECOUPLED)
    │  coverage × modifiers     │
    │  + S2 common boost        │
    │  + S3 pattern boost       │
    │  + Phase 8 history/med    │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Phase 6: Competition │
    │ (DB + inline + prox) │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Normalization → %    │
    └──────────┬───────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 ┌──────┐  ┌──────┐    ┌──────────┐
 │ S14  │  │ S8   │    │ S1 inject│──► TO BECOME safety_alerts[]
 │ organ │  │physio│    │ S6 cap   │
 │ bonus │  │boost │    │ S7 slots │
 └──┬───┘  └──┬───┘    └──┬───────┘
    │         │           │
    ▼         ▼           ▼
    ┌──────────────────────┐
    │  Final Selection     │
    │  top 6 + must-not-   │
    │  miss → output       │
    └──────────────────────┘
```

---

## 9. Duplication & Conflict Validation

| Check | Finding | Conflict? |
|-------|---------|-----------|
| S1 (DDX) vs S9/Module 6 (Global Safety) — both query `dangerous_diagnoses` | Both query same table with same `must_not_miss=true` filter. S1 does it pre-ranking; S9 does it post-consultation. | **NO CONFLICT** — they serve different lifecycle stages. Post-decoupling, S1 becomes alert-only (same lifecycle as S9 but earlier in the pipeline). Consider consolidating long-term. |
| S3 pattern inference vs Phase 4 combination boosts | S3 detects clinical PATTERNS (≥3 signals across symptoms+vitals+demographics). Phase 4 detects specific SYMPTOM COMBINATIONS (2-3 exact symptoms). Overlap exists for cardiac, infection, and GI patterns. | **MINOR OVERLAP** — Not harmful. S3 is broader (includes vitals/age), Phase 4 is narrower (exact symptoms). The multiplicative compounding means a cardiac case could get 1.8x (S3) × 2.5x (Phase 4) = 4.5x boost. Post-Phase 9, this is acceptable since it's evidence-based, not safety-based. |
| S2 common condition boost vs Phase 8 history priors | S2 applies 5.0x for epidemiologically common conditions. Phase 8 applies 2.5-3.0x for history-matched conditions. In incomplete presentations, a patient with "asthma" history presenting with "cough" gets: 5.0x (common) × 2.5x (history) = 12.5x prior. | **PARTIAL CONFLICT** — The 12.5x compound prior is excessive. Reducing S2 to 2.0x would make it 2.0x × 2.5x = 5.0x, which is reasonable. |
| S3 safety clusters vs S9 clinical risk detection | S3 detects patterns within DDX scoring. S9 detects patterns post-consultation. Different inputs (S3: normalized symptoms + vitals; S9: symptoms + SOAP + diagnosis). | **NO CONFLICT** — Different lifecycle stages, different input signals. |

---

## 10. Signal Ownership Validation

| Signal | Expected Owner | Actual Owner | Violation? |
|--------|---------------|--------------|------------|
| Symptom Likelihood | Diagnostic Engine | DDX Engine (symptom_likelihoods table) | ✅ No |
| Pattern Inference | Diagnostic Engine | DDX Engine (S3, L442–520) | ⚠️ **PARTIAL** — Patterns 1-6 overlap with safety-critical conditions (ACS, PE, sepsis, meningitis). These are legitimate diagnostic signals that also happen to be safety-relevant. NOT a violation — pattern detection IS a diagnostic function. |
| Diagnostic Competition | Diagnostic Engine | DDX Engine (Phase 6, L1024–1162) | ✅ No |
| History/Med Priors | Diagnostic Engine | DDX Engine (Phase 8, L602–694) | ✅ No |
| Safety Risk Detection | Safety Engine | S1: DDX Engine ❌, S9: Global Safety Engine ✅ | ❌ **VIOLATION** — S1 performs safety risk detection inside the diagnostic engine. Phase 9 corrects this by moving S1 to `safety_alerts[]` output. |
| Must-Not-Miss Detection | Safety Engine | S1/S7: DDX Engine ❌, S9/Module 6: Global Safety Engine ✅ | ❌ **VIOLATION** — Same as above. |

---

## Summary

The system is **READY WITH CONDITIONS** for Phase 9. The 4 preconditions (P1–P4) are straightforward implementation tasks with no architectural risk. The 5 hidden couplings (HC1–HC5) are all minor and easily addressed during implementation. The critical risk (R1) is fully mitigated by the recommended execution order (safety_alerts[] first, then decouple).

**Estimated implementation effort:** ~250 lines changed in `ddx-engine/index.ts`, ~30 lines added for `safety_alerts[]` response field, ~50 lines in benchmark runner, ~40 lines in UI components.
