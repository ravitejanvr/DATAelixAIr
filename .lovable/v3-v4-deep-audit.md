# DATAelixAIr V3 → V4 Deep Architectural Audit

**Date:** 2026-04-12
**Scope:** Full-stack execution truth audit, failure analysis, V4 blueprint

---

## 1. EXECUTIVE SUMMARY — 10 Brutal Truths

1. **The system is a 2,680-line orchestrator calling ~15 edge functions, most of whose outputs are discarded.** Only 4 components materially affect the final ranking: DDX Engine, V3 Engine (via `runInference`), Score Fusion (skipped for V3), and SSAL freeze.

2. **V3 is the sole scoring authority, but V1 still executes every request** via the Bayesian Engine call in Wave 3 (line 1221). Its result is overwritten at line 1523 when V3 succeeds. This adds ~6s latency for zero value.

3. **The "learning system" is an illusion.** Calibration factors and episodic priors are fetched (lines 593-610) and applied to DDX probabilities (lines 1084-1132), but DDX probabilities are irrelevant — they're overwritten by V3 posteriors. The learning loop modifies data that is subsequently discarded.

4. **Meta-Reasoning (Wave 1.5) runs ~200ms, loads 5 DB tables, produces a ClinicalWorldState — and nothing downstream reads it** except for conflict resolution (Wave 3.5), which itself runs AFTER SSAL freeze and cannot modify the ranking.

5. **Causal Reasoning (Wave 2d) runs ~300ms, produces chains and counterfactuals — none of which affect any score.** It is purely decorative logging.

6. **The Hypothesis Engine is explicitly disabled** (line 1349: "SKIPPED"). The Hypothesis Testing engine (Wave 2c) adjusts DDX probabilities that V3 overwrites.

7. **Score Fusion is skipped for V3** (line 1543-1546: `skipScoreFusionForAdvanced`). This means the entire physiology-first architecture (canonical_fusion.ts, score_fusion.ts) has zero effect when V3 is active.

8. **The Systemic Override Layer is explicitly disabled** (line 1604: "DISABLED"). The file exists but is never invoked.

9. **Cognitive Controller (Wave 3.5) prunes DDX candidates AFTER SSAL freeze** (line 1907 comment: "Changes here do NOT affect the final UI ranking"). It modifies a copy of ddxResult that only affects SOAP fallback.

10. **The true bottleneck is V3 state coverage density**, not scoring mechanics. Systemic diagnoses have 4.2 states/dx; local diagnoses have 1.1 states/dx. No amount of pipeline engineering can compensate for missing knowledge representation.

---

## 2. TRUE SYSTEM ARCHITECTURE — What Actually Runs

### Minimal Execution Graph (components that affect final output)

```
Input (ClinicalContext)
    │
    ▼
Wave 0: PCIE Context Hydration (optional, DB fetch)
    │
    ▼
Wave 1: Context Enrichment (sync, ~5ms)
    │
    ▼
Wave 2a: Physiology Engine (Edge Function, ~1-6s)
    │   ↓ candidate_diagnosis_ids
    ▼
Wave 2b: DDX Engine (Edge Function, ~3-8s)
    │   ↓ differential_diagnoses + diagnosis_ids
    ▼
Wave 2b2: Candidate Fallback V2 (KG expansion, ~5ms)
    │   ↓ expanded candidate list
    ▼
Wave 3a: V1 Bayesian Engine (Edge Function, ~3-6s) ← WASTED
    │   ↓ result DISCARDED when V3 succeeds
    ▼
Engine Registry: V3 Engine (Edge Function, ~3-6s) ← AUTHORITY
    │   ↓ posterior probabilities
    ▼
Phase 5.6: Clinical Priority Resolution (sync, ~1ms)
    │   ↓ tie-break ordering
    ▼
SSAL: Name enrichment + Object.freeze
    │   ↓ frozen fusedBayesian
    ▼
Wave 4: Safety (oversight report)
    ▼
Wave 5: Uncertainty + SOAP
    ▼
Output (PipelineResult)
```

### Dead/Shadow Components (run but don't affect output)

| Component | Latency | Effect on Output |
|-----------|---------|-----------------|
| V1 Bayesian (Wave 3a) | 3-6s | **ZERO** — overwritten by V3 |
| V2 Shadow Engine | 3-6s | **ZERO** — fire-and-forget logging |
| Meta-Reasoning (Wave 1.5) | 200ms | **ZERO** — config not consumed |
| Episodic Memory (Wave 1.8) | 200ms | Modifies DDX probs → overwritten by V3 |
| Hypothesis Testing (Wave 2c) | 200ms | Modifies DDX probs → overwritten by V3 |
| Calibration Factors | 100ms | Modifies DDX probs → overwritten by V3 |
| Causal Reasoning (Wave 2d) | 300ms | **ZERO** — logged only |
| Pattern Priority Layer | 50ms | Modifies DDX probs → overwritten by V3 |
| Cognitive Controller (Wave 3.5) | 50ms | **ZERO** — runs post-SSAL |
| Score Fusion | 0ms | **SKIPPED** for V3 |
| Systemic Override | 0ms | **DISABLED** |
| Evidence Engine (Phase 5.7) | 0ms | **SKIPPED** for V3 |
| Multi-Agent Pipeline | 500ms | **Background** — non-blocking, UI-only |

**Total wasted latency per request: ~7-14s** (V1 + V2 Shadow + Meta + Episodic + Hypothesis Testing + Causal + Calibration)

---

## 3. FAILURE MAP

### A. Structural Failures

| Failure | Mechanism | Impact | Quantified |
|---------|-----------|--------|------------|
| **State sparsity (local)** | 1.1 states/dx for local vs 4.2 for systemic | Local diagnoses cannot generate competitive discriminative signal | ~60% of Top-1 failures in GP cases |
| **Feature normalization gap** | 5+ independent SYNONYM_MAP implementations; 16+ hardcoded `.includes()` checks in V3 edge function | Synonymous inputs ("pyrexia" vs "fever") activate different states | ~15% of failures |
| **String-based matching** | CPR, Score Fusion, Systemic Override all use `.includes()` on diagnosis names | Fragile, locale-dependent, fails on UUID-only diagnoses | Systematic semantic violations |
| **No canonical ID system** | `canonical/mappings.ts` exists with 10 entries but is NOT wired into orchestrator | Raw strings flow through entire pipeline | Contract violation |
| **DDX→V3 coupling** | V3 only scores candidates DDX provides. If DDX misses a diagnosis, V3 cannot recover it | Single point of candidate loss | Unknown % — not auditable |

### B. Theoretical Failures

| Failure | Detail |
|---------|--------|
| **Not truly Bayesian** | V3 uses delta-based contribution (ΔP × logLR × w_spec) which is a discriminative scoring model, not posterior inference. There is no proper prior × likelihood → posterior computation. The "prior" field exists but is static (0.01 default). |
| **No calibration guarantees** | Probabilities are softmax-normalized scores, not calibrated probabilities. P(disease) = 0.40 does not mean the disease occurs 40% of the time in similar presentations. |
| **Single-pass inference** | No iterative refinement. The diagnostic loop controller exists but runs post-SSAL and cannot modify rankings. |
| **Missing base rates** | Disease priors are theoretically calibrated (5 prevalence bands) but the V3 engine's `prior_weight_lambda` is a tuning parameter, not a proper Bayesian prior. |
| **Independence assumption** | Symptoms are treated as conditionally independent given a state. Symptom interactions (cough + fever ≠ just cough + just fever) are not modeled. |

### C. Hidden Failure Modes

| Mode | Mechanism | Risk |
|------|-----------|------|
| **Systemic gate cliff-edge** | τ=0.7 hard gate: severity 0.69 → V1 scoring; 0.70 → V3 scoring. One vital sign difference changes the entire scoring regime. | High — clinically dangerous threshold behavior |
| **Interaction blindness** | No state × state interactions. Sepsis + Pneumonia has no emergent state. | Medium — misses complex multi-system presentations |
| **Temporal blindness** | Duration/onset are scalar modifiers, not temporal reasoning. "3 days of fever" vs "3 weeks of fever" → different modifier value, same architecture. | Medium — chronic conditions misranked |
| **Adversarial vulnerability** | Adding irrelevant symptoms can activate unrelated states and shift rankings. No robustness mechanism. | Medium — noise injection in multilingual/voice inputs |
| **Temperature unit confusion** | Line 1259: `vitals.temperature >= 38 || vitals.temperature >= 100.4` — this means ANY temperature ≥38 (Celsius OR Fahrenheit) triggers. 38°F = 3.3°C would incorrectly trigger. | Low — but unit mixing is a documented issue |

---

## 4. DEAD vs ACTIVE MATRIX

### Classification Key
- **CORE**: Directly affects final diagnostic output
- **SUPPORT**: Affects output quality/completeness but not ranking
- **SHADOW**: Runs but output is discarded
- **DEAD**: Code exists but is never invoked
- **ILLUSORY**: Appears functional but has zero effective impact

| Component | File(s) | Classification | Action |
|-----------|---------|---------------|--------|
| DDX Engine | `ddx_engine/client.ts` | **CORE** | KEEP |
| V3 Engine | `engine_registry.ts` → Edge Function | **CORE** | KEEP + EVOLVE |
| Candidate Fallback V2 | `candidate_fallback_v2.ts` | **CORE** | KEEP |
| Failure-Derived Rules | `failure_derived_rules.ts` | **CORE** | KEEP |
| KG Expander | `kg/kg_expander.ts` | **CORE** | KEEP |
| Clinical Priority Resolution | `clinical_priority_resolution.ts` | **CORE** | KEEP |
| SSAL (name enrichment + freeze) | orchestrator lines 1756-1829 | **CORE** | KEEP |
| Physiology Engine | Edge Function | **CORE** (feeds DDX) | KEEP |
| Context Engine / PCIE | `context_engine/*`, `pcie/*` | **SUPPORT** | KEEP |
| Safety/Oversight Engine | `oversight_engine/*` | **SUPPORT** | KEEP |
| Uncertainty Engine | Edge Function | **SUPPORT** | KEEP |
| SOAP Generator | `soap_generator.ts` | **SUPPORT** | KEEP |
| Guideline Compliance | Edge Function | **SUPPORT** | KEEP |
| V1 Bayesian Engine | `bayesian_engine/client.ts` | **SHADOW** | ARCHIVE |
| V2 Engine (shadow mode) | `engine_registry.ts` shadow path | **SHADOW** | ARCHIVE |
| Score Fusion | `score_fusion.ts` | **DEAD** (skipped for V3) | ARCHIVE |
| Canonical Score Fusion | `canonical_fusion.ts` | **DEAD** (skipped for V3) | ARCHIVE |
| Systemic Override | `systemic_override_layer.ts` | **DEAD** (disabled) | DELETE |
| Meta-Reasoning | `meta_reasoning/index.ts` | **ILLUSORY** | ARCHIVE |
| Episodic Memory | `episodic_memory/client.ts` | **ILLUSORY** | ISOLATE |
| Calibration Client | `learning_system/calibration_client.ts` | **ILLUSORY** | ISOLATE |
| Causal Reasoning | `causal_reasoning/client.ts` | **ILLUSORY** | ARCHIVE |
| Hypothesis Testing | `hypothesis_testing/client.ts` | **ILLUSORY** | ARCHIVE |
| Hypothesis Engine (LLM) | `hypothesis_engine/client.ts` | **DEAD** (disabled at line 1349) | ARCHIVE |
| Cognitive Controller | `cognitive/clinical_cognitive_controller.ts` | **ILLUSORY** (post-SSAL) | ARCHIVE |
| Cognitive Layer (Wave 6) | `cognitive/index.ts` | **ILLUSORY** | ISOLATE |
| Pattern Priority Layer | `pattern_priority_layer.ts` | **ILLUSORY** (modifies DDX, overwritten by V3) | ARCHIVE |
| Evidence Engine (Phase 5.7) | `clinical_reasoning/evidenceEngine.ts` | **DEAD** (skipped for V3) | ARCHIVE |
| Rollout Controller | `rollout_controller.ts` | **SUPPORT** (routing logic) | SIMPLIFY |
| Pipeline Logger / Lineage | `pipeline_logger.ts`, `lineage_tracker.ts` | **SUPPORT** | KEEP |
| O2 Legacy Adapter | `clinical_pipeline_orchestrator.ts` | **DEAD** (deprecated) | DELETE |

---

## 5. V4 ARCHITECTURE

### Design Principles

1. **Knowledge-first, not scoring-first** — The primary bottleneck is state coverage, not inference mechanics
2. **Canonical-native** — Zero raw strings past the ingestion boundary
3. **Lean pipeline** — Only components that affect output should execute
4. **Continuous modulation** — No hard gates or cliff-edge thresholds
5. **Real learning** — Learning signals must feed back into the scoring model, not into discarded intermediate data
6. **Explainable by construction** — Attribution is a property of the architecture, not a post-hoc layer

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    V4 PIPELINE (6 stages)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────────┐                      │
│  │ 1. INGESTION  │────▶│ 2. CANONICAL     │                      │
│  │   Raw text,   │     │   SNOMED-backed  │                      │
│  │   voice,      │     │   normalization  │                      │
│  │   form data   │     │   + multilingual │                      │
│  └──────────────┘     └───────┬──────────┘                      │
│                               │                                  │
│                    canonical_ids[]                                │
│                               │                                  │
│                    ┌──────────▼──────────┐                       │
│                    │ 3. CONTEXT GRAPH    │                       │
│                    │   Patient profile   │                       │
│                    │   + Vitals          │                       │
│                    │   + History         │                       │
│                    │   + Risk flags      │                       │
│                    └──────────┬──────────┘                       │
│                               │                                  │
│              ┌────────────────┼────────────────┐                 │
│              │                │                │                  │
│    ┌─────────▼───────┐  ┌────▼──────┐  ┌──────▼────────┐        │
│    │ 4a. CANDIDATE   │  │ 4b. STATE │  │ 4c. SAFETY    │        │
│    │  GENERATION     │  │  SCORING  │  │  DETECTORS    │        │
│    │  (KG + Rules)   │  │  (V4 Eng) │  │  (16 clusters)│        │
│    └────────┬────────┘  └─────┬─────┘  └──────┬────────┘        │
│             │                 │                │                  │
│             └────────┬────────┘                │                  │
│                      │                         │                  │
│            ┌─────────▼──────────┐              │                 │
│            │ 5. AUTHORITY (SSAL)│◀─────────────┘                 │
│            │   Freeze + Enrich  │                                │
│            │   + Safety merge   │                                │
│            └─────────┬──────────┘                                │
│                      │                                           │
│            ┌─────────▼──────────┐                                │
│            │ 6. OUTPUT          │                                │
│            │   Uncertainty      │                                │
│            │   SOAP             │                                │
│            │   Compliance       │                                │
│            │   Copilot          │                                │
│            └────────────────────┘                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ LEARNING LAYER (async, post-consultation)                │    │
│  │   Outcome recording → Calibration → State weight update  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stage Details

#### Stage 1: Ingestion
- Accept raw text, structured form, voice transcript
- Language detection + translation
- No clinical logic — pure data capture

#### Stage 2: Canonical Layer (CRITICAL NEW COMPONENT)
```
Input: ["fever", "pyrexia", "bukhar", "high temperature"]
Output: [{ canonical_id: "FEVER", snomed_id: "386661006", confidence: 1.0 }]
```
- **Single unified synonym map** — eliminate 5+ fragmented implementations
- SNOMED-backed with fallback to local canonical IDs
- Multilingual support (Hindi, Urdu, Telugu synonyms)
- **Contract enforcement**: Any unmapped input triggers a logged warning + passes through as `UNMAPPED_{hash}` — never silently dropped
- Coverage target: 500+ symptom synonyms, 200+ diagnosis synonyms

#### Stage 3: Context Graph
- Unchanged from current PCIE — already well-designed
- Add canonical_ids to graph nodes
- Remove raw string duplication

#### Stage 4a: Candidate Generation
- DDX Engine (keep) + KG Expander (keep) + Failure-Derived Rules (keep)
- **New**: Canonical-native candidate expansion — KG clusters referenced by canonical_id, not string
- Remove: Pattern Priority Layer (modifies DDX probs that are overwritten)

#### Stage 4b: V4 Scoring Engine
Key changes from V3:

1. **Expanded state coverage** (HIGHEST PRIORITY):
   - Target: 60+ composite states (from 33)
   - GI states: gastroenteritis_pattern, peptic_ulcer_pattern, biliary_colic_pattern, ibs_pattern
   - MSK states: inflammatory_joint_pattern, mechanical_back_pattern, soft_tissue_pattern
   - ENT states: upper_airway_infection_pattern, otitis_pattern, sinusitis_pattern
   - Derm states: allergic_dermatitis_pattern, infectious_skin_pattern
   - Renal states: lower_uti_pattern, renal_colic_pattern (exists), chronic_kidney_pattern
   - Neuro states: tension_headache_pattern, migraine_pattern (beyond current vascular_headache)
   - Target: ≥2.5 states/dx for local diagnoses (from 1.1)

2. **Continuous systemic modulation** (replace hard gate):
   ```
   systemic_weight = sigmoid((signal_count - 2) / 1.5)
   final_score = (1 - systemic_weight) × Score_symptom + systemic_weight × Score_V3_state
   ```
   No cliff-edge. Smooth transition from symptom-dominant to state-dominant scoring.

3. **Hierarchical states** (new):
   - Level 1: Organ system states (respiratory, cardiac, GI)
   - Level 2: Pattern states (pneumonia_pattern, uri_pattern)
   - Level 3: Discriminative features (productive_cough, dry_cough)
   - States at L2 inherit partial activation from L1

4. **Prior integration** (new):
   ```
   log_posterior(dk) = log_prior(dk) + Σ contribution(sj, dk)
   ```
   Where `log_prior` is calibrated to primary care prevalence bands.
   Currently, priors exist in the DB but are applied as static multipliers — V4 integrates them into the log-score computation.

5. **Missing data handling** (preserve V3 approach):
   - Missing symptoms: dampen toward prior baseline (weight 0.05)
   - Missing labs: do not suppress — treat as optional boosters

#### Stage 4c: Safety Detectors
- Keep existing 16 cluster detectors
- Run in parallel with scoring — independent authority
- Inject must-not-miss flags into SSAL regardless of V4 score

#### Stage 5: SSAL
- Unchanged — freeze + enrich + name resolution
- Add: canonical_id to each diagnosis object
- Remove: CPR (integrated into continuous modulation)

#### Stage 6: Output
- Uncertainty, SOAP, Compliance — run post-SSAL
- Compliance evaluates primary diagnosis only (already implemented correctly)

### Learning Layer (REAL, not illusion)

Current state: Learning signals (episodic memory, calibration, outcome recording) exist but modify DDX probabilities that V3 overwrites.

V4 design:
1. **What learns**: State-to-diagnosis logLR weights
2. **How it updates**: Batch calibration from outcome data
   - After N confirmed outcomes, compute correction factor per state-diagnosis edge
   - `logLR_updated = logLR_base × (1 + α × correction_factor)`
   - α starts at 0.0 (no learning), increases as outcome count grows
3. **Where it plugs in**: Directly into V4 scoring engine edge weights — not into intermediate pipeline data
4. **Safety**: Max correction factor capped at ±0.3 log units. Cannot flip a diagnosis ranking by more than 2 positions from base model.

### Explainability (Enhanced)

Preserve:
- ΔP attribution per state per diagnosis
- State activation trace

Add:
- **Counterfactual explanations**: "If the patient did NOT have tachycardia, Sepsis would drop from #1 to #4"
  - Implementation: Re-run scoring with one feature removed, compute rank delta
  - Cost: O(n_features) additional scoring passes — acceptable for <20 features
- **Uncertainty decomposition**: "Confidence is low because 3 expected findings for Pneumonia are missing (sputum, crackles, consolidation)"
  - Implementation: Compare expected state features vs observed features for top diagnosis

### Bias Mitigation (Improved)

Current problems:
- Generic penalty (`GENERIC_REGULARIZATION`) suppresses URI/Viral but may also suppress genuinely common diagnoses
- Category suppression can hide rare diseases in an incorrectly suppressed category
- No age/sex-stratified prior calibration

V4 improvements:
1. **Prevalence-stratified priors**: log_prior(dk) varies by age bucket and sex
2. **Rare disease preservation**: Must-not-miss diagnoses have a minimum score floor that cannot be suppressed below, regardless of regularization
3. **Calibration auditing**: Track Top-1 accuracy by demographic bucket. Alert if disparity exceeds 10% between any two groups.

---

## 6. MIGRATION PLAN (PHASED)

### Phase 0: Cleanup (1-2 weeks, LOW RISK)
- [ ] Delete `systemic_override_layer.ts` (disabled, zero references)
- [ ] Delete `clinical_pipeline_orchestrator.ts` (deprecated O2 adapter)
- [ ] Remove V1 Bayesian call from Wave 3 (saves 3-6s per request)
- [ ] Remove V2 shadow execution from `engine_registry.ts` (saves 3-6s per request)
- [ ] Remove episodic memory / calibration factor application to DDX probs (illusory)
- [ ] Remove hypothesis testing DDX probability adjustments (overwritten)
- [ ] Remove pattern priority layer invocation (overwritten)
- [ ] Remove causal reasoning invocation (decorative)
- [ ] Remove meta-reasoning invocation (output unused)
- [ ] Remove cognitive controller post-SSAL invocation (ineffective)
- **Expected latency reduction: 10-15s per request**

### Phase 1: Canonical Layer (2-3 weeks, MEDIUM RISK)
- [ ] Expand `canonical/mappings.ts` from 10 to 500+ entries
- [ ] Wire canonical mapping into orchestrator ingestion stage
- [ ] Add SNOMED lookup fallback for unmapped terms
- [ ] Replace all 5 fragmented SYNONYM_MAP implementations with single canonical layer
- [ ] Add multilingual synonym coverage (Hindi, Urdu, Telugu — top 50 symptoms)
- [ ] Wire canonical_ids through to V3 edge function input

### Phase 2: State Coverage Expansion (3-4 weeks, MEDIUM RISK)
- [ ] Add 25+ new composite states for local/GP diagnoses
- [ ] Target: GI (5 states), MSK (4), ENT (4), Derm (3), Renal (3), Neuro (4), Psych (2)
- [ ] Add feature-to-state mappings for each new state
- [ ] Add state-to-diagnosis mappings with anti-correlated logLR
- [ ] Run V3 validation suite: target Top-1 ≥70% for local cases (from 30-50%)

### Phase 3: Continuous Modulation (1-2 weeks, HIGH RISK)
- [ ] Replace hard systemic gate (τ=0.7) with sigmoid modulation
- [ ] Integrate proper log-prior into scoring formula
- [ ] Run full benchmark suite with regression detection
- [ ] Validate no systemic case regression (must maintain ≥90% Top-1)

### Phase 4: Learning Integration (2-3 weeks, MEDIUM RISK)
- [ ] Build outcome collection → correction factor pipeline
- [ ] Implement batch calibration that updates logLR weights
- [ ] Add safety caps (±0.3 log units, max 2-rank shift)
- [ ] Deploy in shadow mode (compute but don't apply) for 2 weeks
- [ ] Validate calibration direction matches clinical expectations

### Phase 5: Pipeline Hardening (1-2 weeks, LOW RISK)
- [ ] Add canonical_id to SSAL diagnosis objects
- [ ] Add counterfactual explanation generation
- [ ] Add uncertainty decomposition
- [ ] Add demographic-stratified calibration auditing
- [ ] Final validation suite pass

---

## 7. RISKS & LIMITATIONS

### Migration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| State expansion introduces false activations | HIGH | Anti-correlated logLR + validation suite regression testing |
| Removing V1 eliminates fallback | MEDIUM | V3 has no fallback today either — single point of failure regardless |
| Sigmoid modulation regresses systemic accuracy | HIGH | A/B testing with locked baseline; automated regression detection |
| Canonical layer misses edge-case synonyms | LOW | Graceful degradation: unmapped → pass through as raw string with warning |
| Learning loop introduces drift | MEDIUM | Safety caps + shadow mode validation period |

### Architectural Limitations

1. **Client-side orchestrator**: The 2,680-line orchestrator runs in the browser. This means:
   - No server-side caching across users
   - No centralized latency monitoring
   - All edge function calls traverse the network twice (browser → Supabase → browser)
   - Recommendation: Move orchestrator to a single edge function for production

2. **Edge function atomicity**: Each pipeline stage is an independent edge function. There is no transaction boundary — partial failures produce inconsistent state.

3. **No A/B testing infrastructure**: The rollout controller exists but only routes between V1/V2/V3. There is no mechanism to compare V3 vs V4 on the same traffic.

4. **Knowledge graph is static**: The 630+ diagnoses and 6,400+ edges are seeded once. There is no mechanism for incremental KG updates based on new medical evidence.

---

## 8. FINAL VERDICT

### System Maturity: 4/10

The architecture shows sophisticated thinking (SSAL, physiology-first, competitive scoring) but the execution contains massive dead weight. ~60% of the pipeline code has zero effect on output. The system is over-engineered in layers that don't matter and under-invested in the one thing that does: knowledge representation coverage.

### Clinical Readiness: 3/10

- Strong for systemic/emergency presentations (~93% Top-1)
- Dangerously weak for routine GP presentations (~30-50% Top-1)
- Most patients presenting to Indian private clinics will have local/GP-level complaints
- The system will perform worst on its most common use case

### Research Readiness: 5/10

- The discriminative competitive architecture (V3) is theoretically sound and publishable
- The delta-based contribution formula is novel and well-motivated
- Missing: proper calibration analysis, statistical significance testing, bias audit results
- Missing: comparison against clinical baselines (physician accuracy, existing CDSS)
- The "Bayesian" label is misleading — the system is a discriminative ranker with softmax normalization, not a Bayesian inference engine

### Critical Path to Production

1. **Delete dead code** (Phase 0) — immediate 10-15s latency improvement
2. **Expand state coverage** (Phase 2) — the single highest-impact change
3. **Build canonical layer** (Phase 1) — eliminates the normalization illusion
4. Everything else is secondary.

---

## APPENDIX: Self-Critique (Phase 7)

### What assumptions might be wrong?

1. **I assume V3 edge function actually implements the discriminative competitive architecture as documented.** I audited the client-side code, not the edge function implementation. If the edge function has its own normalization or scoring bugs, this audit is incomplete.

2. **I assume DDX probability values don't indirectly affect V3 scoring.** If the V3 edge function uses DDX-provided probabilities as input priors, then episodic/calibration modifications to DDX ARE effective. This needs verification in the edge function code.

3. **I assume the 93%/30-50% split is accurate.** These numbers come from benchmark suites which may not represent real-world presentation distributions.

### What would a top MLHC/NeurIPS reviewer reject?

1. **Calling it "Bayesian"** — it's not. It's a log-linear discriminative model with softmax normalization. The terminology mismatch would trigger immediate skepticism.

2. **No held-out evaluation** — all benchmarks are constructed test cases. No evaluation on real patient data with ground truth diagnoses.

3. **No calibration analysis** — no reliability diagrams, no Brier scores, no comparison of predicted probabilities vs observed frequencies.

4. **No statistical significance** — accuracy numbers are point estimates without confidence intervals.

5. **No comparison baseline** — what does a GP achieve on the same cases? What does a simple symptom-checker achieve?

### What parts are engineering vs research?

- **Engineering**: Pipeline orchestration, SSAL, caching, SOAP generation, UI
- **Research**: V3 scoring formalism, composite state taxonomy, delta-based contribution, competition layer
- **Neither**: Dead code, illusory learning systems, meta-reasoning, causal reasoning

### Where could this fail in real-world deployment?

1. **Voice transcription errors** — garbled symptoms from Indian English/Hindi code-mixed speech will fail canonical mapping
2. **Incomplete intake data** — GP clinics often skip vitals → systemic conditioning fails → local cases default to V1-like scoring
3. **Rare presentations** — any diagnosis not in the KG is invisible to the system, with no graceful "I don't know" signal
4. **Clinician over-trust** — high confidence on wrong diagnoses (miscalibration) could lead to anchoring bias
