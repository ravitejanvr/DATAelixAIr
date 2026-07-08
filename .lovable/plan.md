
# Execution Plan — Backlog v1.0, MVP Slice (P0 only)

The backlog in `.lovable/execution-backlog-v1.md` totals ~20 tasks (some XL, weeks of work — e.g. D1 case curation, D2 clinical pilot). I will not attempt all of it in one turn. The backlog itself defines the MVP:

> **MVP = A1, A2, A3, A4, C1, E1.**

I'll execute exactly that P0 slice in dependency order. Everything P1/P2/P3 (episodic memory re-wire, KG↔terminology binding, PDF parser, outcome capture UI, pilot cases, clinical evaluation, docs beyond freeze) stays TODO — call out separately when you want the next slice.

## Scope (this turn)

### E1 — Publish `ARCHITECTURE_FREEZE_v1.md` (P0, S)
New doc at `architecture/ARCHITECTURE_FREEZE_v1.md`. Codifies the 11 layers, 7 system contracts, and the workspace rules that are now frozen. References backlog v1.0.

### A2 — Migrate benchmark_v8 + PipelineSimulation off O2 → O1 (P0, M)
Callers of the deprecated `clinical_pipeline_orchestrator` (O2):
- `src/services/benchmark_v8/runner.ts` + `types.ts`
- `src/pages/PipelineSimulation.tsx`
- `src/services/pipeline_trace.ts` (trace producer — verify it targets O1 only)
- `src/pages/GPBenchmarkDashboard.tsx` (via v5 references)

Repoint each to `runUnifiedClinicalPipeline` from `@/services/clinical_pipeline/orchestrator`. Preserve existing input/output shapes with a thin adapter inside the caller if the SSAL shape differs from what the benchmark UI expects. No changes to O1 itself.

### A1 — Delete O2 (P0, S)
After A2 lands with no remaining imports: delete `src/services/clinical_pipeline_orchestrator.ts`. Verify `rg "clinical_pipeline_orchestrator" src/` returns 0 hits outside `archive/`.

### A3 — Consolidate safety surfaces (P0, M)
Three modules today: `safety/`, `guardrail_engine/`, `oversight_engine/`. Pick `src/services/safety/` as the canonical surface (already invoked from the O1 Trust Layer). Convert `guardrail_engine/client.ts` and `oversight_engine/{client,index}.ts` to thin `@deprecated` re-exports that forward to `safety/`. No behaviour change; single import surface.

### A4 — Single canonicalize() gate at every intake boundary (P0, M)
Adapters that ingest raw strings must route through `src/services/canonical/index.ts` before handing data to L4+:
- `scribe_adapter` (LLM extraction)
- `file_adapter`
- `conversation_engine`
- `context_engine`

Delete/merge the top-level `canonical/mappings.ts` into `src/services/canonical/`. Any adapter-local maps become re-exports of the canonical module.

### C1 — Single-entrypoint contract test (P0, S)
Add `tests/contract/single_entrypoint.test.ts` (or extend an existing contract test file) that greps the source tree and fails if any import of `clinical_pipeline_orchestrator` exists outside `archive/`. Wire into the existing test runner.

## Order of execution

```
E1  (doc, independent)
A3  (safety consolidation, independent)
A4  (canonical gate, independent)
A2  (benchmark migration)
A1  (delete O2)  ← gated on A2
C1  (contract test) ← gated on A1
```

## Out of scope this turn

A5, A6, A7, B1–B3, C2–C5, D1–D3, E2–E3, F1–F3, G1–G4. These need their own scoped turns (some — D1, D2 — require clinical data + real pilot partners, which I can't do from code).

## Risk / rollback

- Each step is independently revertible via git.
- A2 migration keeps input/output parity — if the benchmark UI or PipelineSimulation page renders differently after the switch, we roll back A2+A1 only; A3/A4/E1/C1 are independent.
- A3 uses re-export shims, so any missed caller keeps working.
- No schema/migration changes; no edge function deploys required by this slice.

## Verification before I stop

- `rg "clinical_pipeline_orchestrator" src/` returns 0 (excluding archive).
- Contract test passes.
- Type-check green.
- `src/services/safety/` is the only surface exporting `runSafetyEvaluation` (or equivalent) directly; other two are re-export shims.
- Every intake adapter's L1→L2 path calls `canonicalize()` from `src/services/canonical`.
- `architecture/ARCHITECTURE_FREEZE_v1.md` committed.

Approve to proceed with this P0 slice, or tell me to broaden/narrow the scope.
