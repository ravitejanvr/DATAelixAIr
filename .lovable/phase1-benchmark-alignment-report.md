# Phase 1 — Benchmark Alignment Report

## Date: 2026-03-25

## Changes Made

### Architecture Change
Both benchmark runners (v9 and v10) now route through the **production orchestrator** (`runUnifiedClinicalPipeline`) instead of calling DDX/Physiology/Bayesian engines directly.

### Execution Path Comparison

**OLD (v9):**
```
BenchmarkCase → normalizeWithTrace() → [Physiology ‖ DDX] (direct) → Bayesian (direct) → CognitiveController (direct) → Safety (local clusters) → Ranking
```

**NEW (v9):**
```
BenchmarkCase → v9CaseToPipelineInput() → ClinicalContext → runUnifiedClinicalPipeline() → PipelineResult → Extract metrics
```

**OLD (v10):**
```
BenchmarkCaseV10 → mapCaseToDDXInput() → runDDXEngine() (direct) → Extract metrics
```

**NEW (v10):**
```
BenchmarkCaseV10 → v10CaseToPipelineInput() → ClinicalContext → runUnifiedClinicalPipeline() → PipelineResult → Extract metrics
```

### New Shared Modules
- `src/services/benchmark_shared/case_to_context.ts` — Adapters converting v9/v10 cases to canonical `ClinicalContext`
- `src/services/benchmark_shared/diagnosis_matching.ts` — Unified synonym map (merged v9+v10, eliminates drift)

## Expected Metric Differences

### Why Results WILL Differ

| Factor | Old Path | New Path (Orchestrator) | Impact |
|--------|----------|------------------------|--------|
| **Organ-System Weighting** | Not applied | Applied (cardiovascular=1.4x, etc.) | Ranking changes for multi-system cases |
| **Physiology → DDX feeding** | v9: parallel (no feed), v10: none | Sequential: physiology feeds DDX candidate IDs | Better recall for physiology-linked conditions |
| **Context Enrichment** | None (raw symptoms) | Wave 1 enrichment + meta-reasoning | Better context completeness → different DDX input |
| **Episodic Memory** | Not used | Wave 1.8 risk flag injection | Additional risk signals for repeat patterns |
| **Causal Reasoning** | Not used | Wave 2d causal chains | May adjust candidate probabilities |
| **Conflict Resolution** | Not applied | Wave 3.5 resolves DDX vs Bayesian conflicts | Ranking adjustments |
| **Diagnostic Loop** | Not applied | Wave 3.6 iterative refinement if low confidence | May add/re-rank candidates |
| **Oversight Engine** | v9: local clusters only, v10: none | Wave 4 full safety evaluation | More safety signals, potentially higher sensitivity |
| **Cognitive Pruning** | v9: direct controller call, v10: none | Integrated into pipeline (not separately traced) | Different pruning behavior |
| **PCIE Hydration** | Not used | Skipped for `bench-` visits (by design) | No difference |
| **Normalization** | v9: applied pre-DDX, v10: none | Orchestrator's extractSymptoms() | Slight normalization differences |

### Expected Direction of Changes

1. **Accuracy (Top-1/3/5)**: May shift ±5-10% due to organ-system weighting and conflict resolution
2. **Candidate Recall**: Likely IMPROVED — physiology feeding provides additional candidate IDs
3. **Safety Sensitivity**: Likely IMPROVED — oversight engine adds production safety layer
4. **Safety Specificity**: May DECREASE — more safety signals = more potential false positives  
5. **Latency**: Will INCREASE — full pipeline (8+ edge function calls) vs 1-3 direct calls
6. **Clinical Acceptability**: Should be similar or improved due to richer context

### Root Cause Categories for Differences

1. **Pipeline enrichment** — Orchestrator adds context the old path never had
2. **Weighting adjustments** — Organ-system and conflict resolution change rankings
3. **Safety layer expansion** — Oversight engine detects conditions the old path missed
4. **Latency overhead** — Full pipeline is inherently slower than direct calls

## Validation Plan

To validate these changes:
1. Run v9 suite once with new path, compare against last persisted run
2. Run v10 suite once with new path, compare against last persisted run
3. Investigate any regression >5% in Top-3 accuracy
4. Investigate any regression >10% in safety sensitivity
5. Accept latency increase as expected (full pipeline cost)

## Rollback Strategy

Revert `src/services/benchmark_v9/runner.ts` and `src/services/benchmark_v10/runner.ts` to previous versions (git history). Shared modules in `benchmark_shared/` can remain as they have no other dependents.
