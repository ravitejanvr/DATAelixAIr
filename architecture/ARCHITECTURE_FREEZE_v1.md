# DATAelixAIr — Architecture Freeze v1.0

**Status:** FROZEN as of 2026-07-08.
**Authority:** Chief Engineer + workspace rules (`workspace-knowledge`).
**Companion:** `.lovable/execution-backlog-v1.md` (execution work items).

Any change that would alter a frozen layer, contract, or rule requires
explicit escalation. Ordinary work is INTEGRATION / IMPLEMENTATION /
VALIDATION / DOCUMENTATION / TECHNICAL DEBT — never new architecture.

---

## 1. The Only Execution Entrypoint

```
runUnifiedClinicalPipeline(input) → PipelineResult
```

Path: `src/services/clinical_pipeline/orchestrator.ts` (**O1**).

- UI, benchmarks, simulation pages, and tests all call O1.
- No parallel pipeline. No bypass. No post-SSAL mutation.
- The legacy O2 delegation adapter has been co-located inside
  `src/services/benchmark_v8/` as a temporary translation shim for the
  benchmark's `ClinicalPipelineResult` shape. It is `@deprecated` and
  slated for full removal once benchmark_v8 consumes O1's
  `PipelineResult` natively.

The single-entrypoint invariant is enforced by
`src/tests/contract/single_entrypoint.test.ts` (Section 5, C1).

---

## 2. The 11 Layers (L1 → L11)

| Layer | Name                                | Responsibility                                                       |
| ----- | ----------------------------------- | -------------------------------------------------------------------- |
| L1    | Intake Adapters                      | scribe / file / conversation / context — raw modality boundary       |
| L2    | Canonical Contract Gate              | `canonicalize()` — strings → CanonicalFeature[]                      |
| L3    | Session Context Manager (SSOT)       | fuse structured scribe + LLM extraction into one live state          |
| L4    | Unified Clinical Context             | patient snapshot, comorbidities, vitals, labs, timeline               |
| L5    | Candidate Generation                 | DDX candidate pool from KG + composite states                        |
| L6    | Bayesian Reasoning (V3)              | prior calibration, evidence deltas, competition, top-K truncation    |
| L7    | Trust / Safety Layer                 | `analyzeSafety()` on canonical features + vitals + guardrails         |
| L8    | Authority / Confidence Resolution    | fusedBayesian → **SSAL** (frozen state, single source of truth)      |
| L9    | Clinical Memory (read-only inbound)  | episodic recall injected as pre-Bayesian context contributor only    |
| L10   | Narrative / SOAP / Explanation       | LLM-generated *from* SSAL; may not alter probabilities                |
| L11   | Oversight / Audit                    | event bus, safety score, immutable audit trail                        |

**SSAL (L8) is the only source of truth downstream.** No component
past L8 may mutate probabilities, DDX order, or safety flags.

---

## 3. The 7 System Contracts

1. **Canonical Contract** — no raw clinical strings past L2. All
   modules under `ddx_engine / bayesian_engine / kg / physiology_engine
   / authority` receive only canonical IDs.
2. **Single Entrypoint Contract** — `runUnifiedClinicalPipeline` is
   the only ignition path.
3. **Determinism Contract** — same input → byte-identical SSAL.
4. **LLM Boundary Contract** — LLMs may only structure or explain.
   They may never score, rank, override, or diagnose.
5. **Authority Contract** — SSAL is immutable after L8. Read-only
   downstream.
6. **Safety Consolidation Contract** — one safety facade
   (`src/services/safety/`); guardrail_engine and oversight_engine
   are `@deprecated` re-export shims that forward to it.
7. **Traceability Contract** — every run emits input, canonical
   mapping, context snapshot, states, scores, and output through
   `pipeline_trace.ts`.

---

## 4. Frozen Rules (from workspace guidelines)

The following workspace rules are non-negotiable and encoded in this
freeze:

- **Rule 2** — Only `runClinicalPipeline`/`runUnifiedClinicalPipeline`.
- **Rule 3** — Input → Canonical → Context → DDX → V3 → CPR → SSAL → Output.
- **Rule 6** — No dead code.
- **Rule 7** — No duplication of scoring / normalization / safety / signals.
- **Rule 8** — p95 total latency ≤ 3 s.
- **Rule 9** — LLMs never diagnose or override scoring.
- **Rule 12** — Determinism guaranteed.
- **Rule 13** — Fail-fast on ambiguous / incomplete input.
- **Rule 20** — ONE safety system.
- **Rule 21** — Canonical IDs only, no string logic.

---

## 5. Enforcement

| Contract              | Enforcement mechanism                                      |
| --------------------- | ---------------------------------------------------------- |
| Single Entrypoint     | `src/tests/contract/single_entrypoint.test.ts`             |
| Canonical Contract    | Backlog C2 (planned AST/lint rule)                         |
| Determinism           | Backlog C3 (planned regression harness)                    |
| Latency Budget        | Backlog C5 (planned CI benchmark)                          |
| Safety Consolidation  | `src/services/safety/facade.ts` — canonical import surface |
| Traceability          | `src/services/pipeline_trace.ts` + `lineage_tracker.ts`     |

---

## 6. What Is Explicitly NOT Frozen

- Terminology data content (releases can be promoted / rolled back).
- Knowledge Graph bindings (backlog A7 will bind KG strings to SNOMED).
- Guideline content (backlog B3 will formalise release lifecycle).
- Learning capture UI wiring (backlog A6).
- Episodic memory read-only re-enablement (backlog A5).

These evolve through their existing versioning mechanisms. Their
*execution surface* stays frozen — new versions flow through the
same 11 layers and 7 contracts.

---

## 7. Escalation

If any acceptance criterion in `.lovable/execution-backlog-v1.md`
cannot be met without changing a frozen layer or contract, STOP and
escalate. Do not silently rebuild around it.

---

*Cross-references:* `.lovable/execution-backlog-v1.md`,
`src/services/clinical_pipeline/orchestrator.ts`,
`src/services/safety/facade.ts`,
`src/tests/contract/single_entrypoint.test.ts`.
