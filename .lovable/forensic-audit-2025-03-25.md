# SYSTEM FORENSIC ARCHITECTURE AUDIT — Post-Reset (2026-03-25)
**Method**: Execution path tracing, import analysis, runtime flow verification  
**Verdict**: **B — Hybrid (Context wrapper over DDX core)**  
**Alignment Score**: **26/100**

---

## PART 0 — SYSTEM OBJECTIVE VALIDATION

### What is ACTUALLY being built (based on execution):
A **DDX-powered clinical copilot** with a context assembly layer. The system collects patient data from UI → builds a `ClinicalContext` flat object → passes it to a 2000-line orchestrator → which extracts fields into a flat payload for the DDX edge function → then post-processes DDX output through 10+ downstream engines.

### TRUE primary output:
DDX differential diagnoses list + medications + labs + safety alerts + SOAP note.

### REAL core layer driving value:
The **DDX edge function** (`supabase/functions/ddx-engine/`) is the reasoning backbone. The context layer assembles data but does not drive inference.

### Intended vs Reality:
| Aspect | Intended | Reality |
|--------|----------|---------|
| Core | UnifiedClinicalContextGraph | ClinicalContext (flat DTO) |
| Flow | Ingestion → Context Engine → Copilot | UI → flat context → orchestrator → flat DDX payload |
| Context ownership | Context Engine owns truth | DDX engine performs its own normalization & safety |

**Verdict: DDX-FIRST with context assembly wrapper.**

---

## PART 1 — REAL EXECUTION TRACE

### Production consultation flow (Clinical.tsx):

```
STEP 1 → Clinical.tsx::runFullPipeline()
  INPUT: UI state (selectedSymptoms[], vitals, patient record)
  TRANSFORM: buildClinicalContext() → ClinicalContext (flat object)
  OUTPUT: ClinicalContext

STEP 2 → Clinical.tsx::buildFullClinicalContext()
  INPUT: ClinicalContext + UIContextOverrides
  TRANSFORM: Typed merge of symptoms, onset, severity, etc.
  OUTPUT: ClinicalContext (enriched, still flat)

STEP 3 → orchestrator.ts::runUnifiedClinicalPipeline()
  INPUT: PipelineInput { clinical_context: ClinicalContext }
  TRANSFORM: extractSymptoms(), buildVitals() → flat arrays
  OUTPUT: PipelineResult

  STEP 3.0 → Wave 0: PCIE fetch (getPatientContext)
    - Fetches clinical_context_objects row from DB
    - Converts via fromPCIEContext() → UnifiedClinicalContext
    - ⚠️ MUTATES input ClinicalContext via (cc as any).field = value
    - Fields: chief_complaint, medical_history, allergies, medications, risk_factors, family_history

  STEP 3.1 → Wave 1: buildEnrichedContext()
    INPUT: ClinicalContext
    OUTPUT: EnrichedClinicalContext (wraps ClinicalContext, adds visit metadata)

  STEP 3.15 → Wave 1.5: runMetaReasoning()
    INPUT: { symptoms[], vitals{}, history[], medications[], allergies[], chief_complaint }
    OUTPUT: MetaReasoningOutput (world state, organ systems, hypotheses)

  STEP 3.18 → Wave 1.8: Episodic Memory resolve
    INPUT: { patient_id, doctor_id, clinic_id, symptoms, chief_complaint }
    OUTPUT: EpisodicMemoryResult
    ⚠️ MUTATES ctx via (ctx as any).risk_flags = [...]

  STEP 3.2 → Wave 2: DDX Engine (CRITICAL)
    INPUT: runDDXEngine({
      symptoms: string[],           // ← FLAT extracted array
      vitals: { temperature, spo2, pulse, bp },  // ← FLAT
      age, sex,                      // ← individual fields
      medical_history, medications, allergies,  // ← arrays
      onset_pattern: (ctx as any).onset_pattern,  // ← via as any
      severity: (ctx as any).severity,
      body_location: (ctx as any).body_location,
      family_history: (ctx as any).family_history,
      physiological_context: physioPayload,
    })
    OUTPUT: DDXResult (diagnoses, labs, meds, safety_alerts, reasoning_traces)

  STEP 3.2b → Wave 2b: Evidence Retrieval
  STEP 3.2c → Wave 2c: Hypothesis Testing (adjusts DDX probabilities)
  STEP 3.2d → Wave 2d: Causal Reasoning
  STEP 3.3 → Wave 3: Bayesian + Guidelines + Hypotheses (parallel)
  STEP 3.35 → Wave 3.5: Conflict Resolution
  STEP 3.36 → Wave 3.6: Diagnostic Loop (iterative refinement)
  STEP 3.4 → Wave 4: Safety Evaluation (Oversight Engine)
  STEP 3.5 → Wave 5: Uncertainty + Hybrid Reasoning + SOAP
  STEP 3.6 → Wave 6: Cognitive Layer (fire-and-forget)

STEP 4 → Clinical.tsx receives PipelineResult
  - Extracts DDX diagnoses, labs, meds, safety into UI state
  - ClinicalCopilot component renders results
```

### Key findings:
1. `buildClinicalContext()` is STILL used (line 589 for reactive state, line 696 for pipeline)
2. `buildFullClinicalContext()` IS used to merge UI overrides (line 703) ✅
3. `UnifiedClinicalContextGraph` is populated AFTER pipeline runs (lines 1846-1938) — POST-HOC recording, NOT input
4. DDX receives a FLAT extracted payload, not any context graph
5. 199 `as any` casts in orchestrator.ts confirm type system is not enforced

---

## PART 2 — SOURCE OF TRUTH IDENTIFICATION

### Context Building
| Implementation | Status | Called From |
|---|---|---|
| `buildClinicalContext()` (lib/clinical-context.ts) | **ACTIVE** | Clinical.tsx (2×), CockpitPlayground.tsx |
| `buildFullClinicalContext()` (lib/clinical-context.ts) | **ACTIVE** | Clinical.tsx, CockpitPlayground.tsx |
| `buildEnrichedContext()` (services/clinical_context/) | **ACTIVE** | orchestrator.ts Wave 1 |
| `buildPatientContextObject()` (context_engine/context_builder.ts) | **DEAD** | No callers |
| `build-clinical-context` edge function | **SHADOW** | Only from meta-orchestrator edge fn |
| `generate-patient-context` edge function | **SHADOW** | No client-side callers |
| `mergeContextSources()` (services/context_service.ts) | **SHADOW** | Only PipelineSimulation.tsx |
| `fromPCIEContext()` (types/clinical-context.ts) | **ACTIVE** | orchestrator.ts Wave 0 |

**Single source of truth?** NO — 3 active builders, 3 shadow builders.

### Terminology Normalization
| Implementation | Status |
|---|---|
| `normalizeWithTrace()` (context_engine/terminology_normalizer.ts) | TEST ONLY (benchmark v8/v9) |
| DDX engine internal normalization | **ACTIVE** (production) |

### Safety Logic
| Implementation | Status |
|---|---|
| DDX engine internal (16 cluster detectors) | **ACTIVE** (production) |
| Oversight Engine (orchestrator Wave 4) | **ACTIVE** (post-DDX) |
| `clinical-safety` edge function | **DEAD** |
| `global-safety-engine` edge function | **DEAD** |
| `safety_engine.ts` | **DEAD** (type-only import in soap_generator.ts) |

### Bayesian Scoring
| Implementation | Status |
|---|---|
| DDX engine internal Bayesian | **ACTIVE** (primary scorer) |
| `calculate-diagnostic-probabilities` edge fn | **ACTIVE** (secondary, Wave 3) |

### Knowledge Graph Access
| Implementation | Status |
|---|---|
| DDX engine (direct DB queries) | **ACTIVE** |
| `knowledge_cache.ts` (preindexed) | **ACTIVE** (Wave 2) |
| `query-clinical-graph` edge function | **SHADOW** |
| `clinical-knowledge` edge function | **SHADOW** |

---

## PART 3 — DUPLICATION & DRIFT ANALYSIS

| Duplication | Files | Risk |
|---|---|---|
| Context builders (3 active) | clinical-context.ts, clinical_context/, context_engine/ | **HIGH** |
| Safety engines (2 active) | DDX internal + Oversight Engine | **HIGH** |
| Bayesian scoring (2 active) | DDX internal + calculate-diagnostic-probabilities | **MEDIUM** |
| Terminology normalization (2 paths) | DDX internal + terminology_normalizer | **HIGH** |
| Synonym maps (2 duplicated) | benchmark_v9/runner + benchmark_v10/runner | **LOW** |
| Organ system detection (2) | orchestrator::detectDominantOrganSystem + DDX internal | **MEDIUM** |
| Context mutation patterns | Wave 0/1.8 mutate `as any` vs buildFullClinicalContext | **HIGH** |

---

## PART 4 — SHADOW & UNUSED SYSTEM DETECTION

| Component | Status | Evidence | Safe to remove? |
|---|---|---|---|
| `services/ddx_service.ts` | DEAD | Deprecated, type import only | YES* |
| `services/safety_engine.ts` | DEAD | Deprecated, type import only | YES* |
| `services/guideline_retrieval.ts` | DEAD | Deprecated | YES |
| `services/medication_engine.ts` | DEAD | Deprecated | YES |
| `services/knowledge_retrieval.ts` | DEAD | Deprecated | YES |
| `services/uncertainty_service.ts` | DEAD | Deprecated | YES |
| `services/clinical_pipeline_orchestrator.ts` (O2) | SHADOW | Only PipelineSimulation.tsx | YES* |
| `services/pipeline_validation/runner.ts` | DEAD | No importers | YES |
| `services/context_engine/context_builder.ts` | DEAD | No callers | YES |
| `services/world_model/index.ts` | DEAD | No importers | YES |
| `services/multi_agent/` | SHADOW | Imported by orchestrator only | NO |
| `supabase/functions/clinical-safety/` | DEAD | No client callers | YES |
| `supabase/functions/global-safety-engine/` | DEAD | No client callers | YES |
| `supabase/functions/meta-orchestrator/` | SHADOW | No client callers | YES |
| `supabase/functions/build-clinical-context/` | SHADOW | Only meta-orchestrator | YES |
| `supabase/functions/generate-patient-context/` | SHADOW | No client callers | YES |
| `supabase/functions/query-clinical-graph/` | SHADOW | No client callers | YES |
| `pages/PipelineSimulation.tsx` | SHADOW | Uses O2 legacy | Deprecate |

*After fixing soap_generator.ts imports

---

## PART 5 — KNOWLEDGE GRAPH UTILIZATION

### Tables actively used by DDX engine:
- `symptoms`, `diagnoses`, `symptom_likelihoods`, `dangerous_diagnoses`, `diagnosis_synonyms`, `syndrome_clusters`, `anatomical_systems`

**Is KG the real reasoning backbone?** YES — but tightly coupled to DDX, not to context engine.

---

## PART 6 — BENCHMARK FORENSICS

| Suite | Calls Orchestrator? | Uses Context Engine? | Tests Production Path? |
|---|---|---|---|
| v8 (via pipeline_trace.ts) | YES | YES | **YES** (most representative) |
| v9 (30 cases) | **NO** — calls DDX directly | NO | **NO** |
| v10 (120 cases) | **NO** — calls DDX directly | NO | **NO** |

**Why benchmark results may NOT reflect production:**
1. v9/v10 skip: physiology, episodic memory, calibration, causal reasoning, hypothesis testing
2. v9/v10 skip: organ-system weighting, oversight safety
3. v9/v10 use own SYNONYM_MAP (potentially divergent from DB)
4. Production has context mutations (Wave 0, 1.8) that alter DDX input

---

## PART 7 — ARCHITECTURE MISALIGNMENT SCORING

| Dimension | Score | Evidence |
|---|---|---|
| Context-first alignment | 25/100 | Context assembled but DDX ignores it; UCCG is post-hoc |
| Single source of truth | 20/100 | 3 context builders, 2 safety, 2 Bayesian, 2 normalization |
| Duplication level (inverse) | 25/100 | Extensive across context, safety, scoring |
| Data flow correctness | 30/100 | UI→context works; orchestrator mutates via `as any` |
| Maintainability | 20/100 | 2012-line orchestrator, 199 `as any` casts |
| Safety consistency | 35/100 | 2 active systems, DDX dominates |

**OVERALL: 26/100**

---

## PART 8 — CORE ARCHITECTURE TRUTH

1. **TRUE core = DDX edge function.** It performs normalization, KG queries, Bayesian scoring, and safety detection.
2. **If Context Engine removed** → DDX still works. Impact: LOW.
3. **If DDX Engine removed** → No diagnoses, labs, meds, safety. Impact: CATASTROPHIC.

---

## PART 9 — CONTEXT SHIFT IMPACT ANALYSIS

### "DDX consumes UnifiedClinicalContextGraph directly"

| Dimension | Impact |
|---|---|
| Accuracy | Potentially IMPROVED (more context signals) |
| Recall | Neutral to improved |
| Safety | IMPROVED (confidence-gated alerts) |
| Explainability | IMPROVED (provenance available) |
| Latency | Negligible (~1ms serialization) |
| Complexity | HIGH initial cost (DDX refactor + benchmark migration) |

---

## PART 10 — SAFE REALIGNMENT PLAN

### Phase 1 — Type Safety (LOW RISK)
- Extend `ClinicalContext` to include family_history, onset_pattern, severity, body_location, exam_findings
- Replace `(ctx as any)` mutations with spread pattern
- Delete 6 dead service files
- Fix soap_generator.ts imports
- Rollback: revert type extension

### Phase 2 — Orchestrator Modularization (LOW-MEDIUM RISK)
- Extract waves into `clinical_pipeline/waves/wave_X.ts`
- Each wave: pure function, immutable context
- Rollback: keep original behind feature flag

### Phase 3 — Context-Native DDX (MEDIUM RISK)
- DDX accepts EITHER legacy flat OR context graph (dual input)
- Feature flag `ddx_context_native`
- Migrate benchmarks to optionally use context input
- Rollback: flag off → legacy

### Phase 4 — Cleanup (LOW RISK)
- Remove shadow edge functions
- Remove dead modules
- Consolidate synonym maps
- Rollback: re-add from git

---

## PART 11 — SUMMARY

### Top 5 Immediate Fixes (Highest ROI)
1. Extend ClinicalContext type → eliminates ~150 `as any` casts
2. Replace ctx mutations with immutable updates
3. Delete 6 dead service files
4. Fix soap_generator.ts imports to canonical types
5. Align benchmarks v9/v10 to use orchestrator

### Top 5 Risks If No Action
1. Type safety erosion (199 `as any` growing)
2. Benchmark divergence (v9/v10 test different system than production)
3. Safety fragmentation (DDX + Oversight may conflict)
4. Developer confusion (3 context builders, 6 deprecated files)
5. Maintainability collapse (2012-line orchestrator)
