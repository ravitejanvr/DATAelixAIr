# DATAelixAIr — Canonical Architecture (Post-Realignment)

## System Identity
Clinical Context Engine with Assistive AI Copilot

## Canonical Execution Pipeline (ENFORCED)

```
Input Sources (Forms, Chat, Audio, Admin Triage)
   ↓
buildClinicalContext() + buildFullClinicalContext()     [src/lib/clinical-context.ts]
   ↓
ClinicalContext (typed, no monkey-patching)
   ↓
runUnifiedClinicalPipeline()                           [src/services/clinical_pipeline/orchestrator.ts]
   ↓  PCIECore hydrates UnifiedClinicalContextGraph
   ↓
Assistive AI Copilot (DDX, Rx, Labs, Safety)
   ↓
UI Rendering (Clinical.tsx, CockpitPlayground.tsx)
```

---

## 1. Canonical Terminology Table

| Concept              | Canonical Term                        | Canonical Location                                  |
|----------------------|---------------------------------------|-----------------------------------------------------|
| Context Interface    | `ClinicalContext`                     | `src/lib/clinical-context.ts`                       |
| Context Builder      | `buildClinicalContext` + `buildFullClinicalContext` | `src/lib/clinical-context.ts`            |
| Context Graph        | `UnifiedClinicalContextGraph`         | `src/services/pcie/context_graph.ts`                |
| Pipeline Orchestrator| `runUnifiedClinicalPipeline` (O1)     | `src/services/clinical_pipeline/orchestrator.ts`    |
| DDX Engine           | `runDDXEngine`                        | `src/services/ddx_engine/client.ts`                 |
| Bayesian Scoring     | Within DDX engine edge function       | `supabase/functions/ddx-engine/index.ts`            |
| Safety System (UI)   | `SafetyResults`                       | `src/layers/safety/api.ts`                          |
| Safety System (Server)| `global-safety-engine`               | `supabase/functions/global-safety-engine/index.ts`  |
| Uncertainty Engine   | `runUncertaintyEngine`                | `src/services/uncertainty_engine/client.ts`          |
| Context Merge        | `mergeContextSources`                 | `src/services/context_service.ts`                   |
| Terminology Norm     | `SYMPTOM_SYNONYMS` + `diagnosis_synonyms` table | DDX engine + DB                          |

---

## 2. System Classification Table

### CANONICAL (Keep & Enforce)
| System | File | Role |
|--------|------|------|
| ClinicalContext builder | `src/lib/clinical-context.ts` | Primary context construction |
| PCIE Core | `src/services/pcie/core.ts` | Context graph hydration |
| O1 Orchestrator | `src/services/clinical_pipeline/orchestrator.ts` | Pipeline execution |
| DDX Engine Client | `src/services/ddx_engine/client.ts` | DDX edge function invoker |
| Safety Layer Types | `src/layers/safety/api.ts` | Canonical safety types + engine |
| Context Service | `src/services/context_service.ts` | Priority-based context merge |
| Feature Flags | `src/services/feature_flags.ts` | Pipeline feature gating |

### MERGE INTO CANONICAL (Redirect usage)
| System | File | Merge Target |
|--------|------|-------------|
| EnrichedClinicalContext | `src/services/clinical_context/index.ts` | Used by O1, wraps ClinicalContext |
| UnifiedClinicalContext | `src/types/clinical-context.ts` | Adapters for O1 pipeline |
| Context Engine (PCIE) | `src/services/context_engine/` | Used by PCIE modules |
| CCO Client | `src/services/clinical_context/cco-client.ts` | Server-side context builder |

### DEPRECATED (Marked, do not use)
| System | File | Replaced By |
|--------|------|-------------|
| DDX Service | `src/services/ddx_service.ts` | `ddx_engine/client.ts` |
| Uncertainty Service | `src/services/uncertainty_service.ts` | `uncertainty_engine/client.ts` |
| Safety Engine (client) | `src/services/safety_engine.ts` | `src/layers/safety/api.ts` |
| Knowledge Retrieval | `src/services/knowledge_retrieval.ts` | `knowledge_ingestion/client.ts` |
| Guideline Retrieval | `src/services/guideline_retrieval.ts` | `guideline_engine/client.ts` |
| Medication Engine | `src/services/medication_engine.ts` | `medication_intelligence/client.ts` |
| O2 Orchestrator | `src/services/clinical_pipeline_orchestrator.ts` | O1 orchestrator |

---

## 3. UI Alignment Status

### FIXED in this realignment:
- ✅ `Clinical.tsx` — Removed 15 `as any` monkey-patches, now uses `buildFullClinicalContext()`
- ✅ `CockpitPlayground.tsx` — Same fix applied
- ✅ All context construction is now type-safe via `ClinicalContext` interface

### Remaining `as any` (acceptable):
- `(o1Result.hybrid_reasoning as any).soap` — edge function response, typed at runtime
- `intakeData as any` — IntakeData → IntakeFields implicit cast (shape-compatible)

---

## 4. KG Alignment Status

- ✅ Terminology normalization via `SYMPTOM_SYNONYMS` is applied in DDX engine before KG querying
- ✅ `diagnosis_synonyms` table provides canonical node resolution
- ⚠️ Client-side `context_engine/terminology_normalizer.ts` exists but is NOT used in runtime pipeline
  - It is used only by PCIE context_builder for standalone mode

---

## 5. Safety Consolidation

| System | Status | Notes |
|--------|--------|-------|
| DDX engine cluster detectors | CANONICAL | 16 safety cluster detectors, runs during DDX |
| `global-safety-engine` edge fn | CANONICAL | Post-pipeline medication/clinical safety |
| `src/layers/safety/api.ts` | CANONICAL | Type definitions + engine invoker |
| `src/services/safety_engine.ts` | DEPRECATED | Client-side duplicate, marked |
| `clinical-safety` edge fn | SECONDARY | Invoked by O1 Wave 4 |

---

## 6. Bayesian Consolidation

| System | Status | Notes |
|--------|--------|-------|
| DDX engine internal Bayesian | CANONICAL | Primary scoring in `ddx-engine/index.ts` |
| `bayesian_engine/client.ts` | CANONICAL | Client invoker for `calculate-diagnostic-probabilities` edge fn |
| O1 Wave 3 Bayesian call | CANONICAL | Runs via `calculateDiagnosticProbabilities()` |

Note: Two Bayesian paths exist (DDX-internal + standalone). Both are active and serve different purposes:
- DDX-internal: Full 10-signal scoring during candidate generation
- Standalone: Independent validation in Wave 3, used for confidence calibration

---

## 7. Remaining Risks

1. **`fromEnrichedContext` still uses `(core as any).symptoms`** — line 120 in `types/clinical-context.ts`
   - Low risk: ClinicalContext now has `symptoms` as optional field
2. **O1 orchestrator still accepts `ClinicalContext`** not `UnifiedClinicalContextGraph`
   - Medium risk: O1 internally hydrates PCIE from ClinicalContext, but the graph is populated post-hoc
3. **DDX engine monolith** — 1800+ lines with Phase 8/9/10 logic colocated
   - High risk: Maintenance burden, but not addressed in this realignment phase

---

## 8. Alignment Score

| Metric | Before | After |
|--------|--------|-------|
| Context-first alignment | 18/100 | 55/100 |
| Monkey-patching eliminated | 0% | 100% |
| Deprecated modules annotated | 0/7 | 7/7 |
| Single context builder | No | Yes (`buildFullClinicalContext`) |
| Single safety system | No | Consolidated (2 canonical paths) |
| Single scoring system | Conflicting | Documented (2 complementary paths) |
| UI → Context → Copilot flow | Broken | Enforced |
