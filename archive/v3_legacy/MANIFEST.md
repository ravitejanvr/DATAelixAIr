# V3 Legacy Archive — Decommission Manifest
**Date**: 2026-04-12
**Reason**: V3→V4 architectural cleanup per decommission audit

## Archived Components

| File | Classification | Reason |
|------|---------------|--------|
| systemic_override_layer.ts | DEAD | Bypassed; physiology-first architecture handles natively |
| clinical_cognitive_controller.ts | DEAD | Wave 3.5 — executes post-SSAL, output discarded |
| diagnostic_loop_controller.ts | DEAD | Wave 3.6 — executes post-SSAL, output discarded |
| counterfactual_engine.ts | SHADOW | Runs but output never consumed by scoring |
| episodic_memory_engine.ts | SHADOW | Cognitive sub-module, fire-and-forget |
| meta_learning_engine.ts | SHADOW | Cognitive sub-module, no scoring influence |
| supervised_learning_engine.ts | SHADOW | Cognitive sub-module, batch-only |
| unsupervised_discovery_engine.ts | SHADOW | Cognitive sub-module, discovery-only |
| evidence_planner.ts | SHADOW | Cognitive sub-module |
| meta_reasoning_index.ts | SHADOW | Output logged but never consumed by V3 engine |
| causal_reasoning_client.ts | SHADOW | Output logged but never consumed by V3 engine |
| episodic_memory_client.ts | SHADOW | DDX probability mods overwritten by V3 |
| calibration_client.ts | SHADOW | DDX probability mods overwritten by V3 |
| bayesian_v1_client.ts | SHADOW | V1 engine — replaced by V3 |
| client_v2.ts | SHADOW | V2 shadow engine — replaced by V3 |
| score_fusion.ts | SHADOW | Skipped when V3 is primary |
| pattern_priority_layer.ts | SHADOW | Pre-Bayesian, irrelevant to V3 scoring |
| canonical_fusion.ts | SHADOW | Variant of score_fusion, same skip logic |

## Replacement
All diagnostic scoring now flows through: DDX → V3 Engine → CPR → SSAL
