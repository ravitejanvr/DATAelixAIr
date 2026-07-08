# DATAelixAIr — Master Engineering Backlog v1.0
**Mode:** Chief Engineer (Architecture Freeze v1.0 in effect)
**Derived from:** Runtime, Terminology, Intake, Pipeline, Memory, Learning, Evolution, Governance, Archaeology, and Adversarial Validation audits.
**Rule:** Integration > Implementation > Validation > Documentation > Technical Debt. No new architecture.

Every task below has been checked against Architecture Freeze v1.0.
**Freeze violations: NONE.** All tasks are integration, consolidation, wiring, validation, or cleanup of components that already exist in the repository.

---

## Legend
- **Category:** INT (Architecture Integration) · IMPL (Implementation) · VAL (Validation) · CE (Clinical Evaluation) · DOC (Documentation) · DEBT (Technical Debt) · FUT (Future)
- **Priority:** P0 (blocks MVP) · P1 (MVP quality) · P2 (post-MVP) · P3 (future)
- **Status:** TODO · IN-PROGRESS · DONE · BLOCKED
- **Effort:** S (<1d) · M (1–3d) · L (3–7d) · XL (>7d)

---

## SECTION A — Architecture Integration (P0 → P1)

### A1. Retire O2 Orchestrator Adapter
- **Category:** INT / DEBT
- **Reason:** Two orchestrators exist. `src/services/clinical_pipeline_orchestrator.ts` is `@deprecated` and only kept for `benchmark_v5`. Freeze mandates a single execution entrypoint (`runClinicalPipeline` → O1).
- **Evidence:** File header `@deprecated DO NOT USE — replaced by clinical_pipeline/orchestrator.ts (O1)`; only remaining consumer is legacy benchmark.
- **Dependencies:** A2 (benchmark migration).
- **Effort:** S
- **Acceptance:** File deleted; no import references remain (`rg "clinical_pipeline_orchestrator"` returns 0); build green; benchmark_v10 passes.
- **Rollback:** Restore from git; re-enable feature flag `enable_new_clinical_pipeline`.
- **Priority:** P0 · **Status:** TODO

### A2. Migrate `benchmark_v5` (and any residual v8/v9 callers) to O1
- **Category:** INT
- **Reason:** Only reason O2 exists. Migrating unblocks A1.
- **Evidence:** O2 header explicitly names benchmark_v5 as sole consumer.
- **Dependencies:** none.
- **Effort:** M
- **Acceptance:** All benchmark runners call `runUnifiedClinicalPipeline` from `@/services/clinical_pipeline/orchestrator`; parity report generated (delta ≤ 1% on shared case set).
- **Rollback:** Keep O2 for one release cycle behind a feature flag.
- **Priority:** P0 · **Status:** TODO

### A3. Consolidate Safety Surfaces (Rule 20)
- **Category:** INT
- **Reason:** Three safety-adjacent modules coexist: `src/services/safety/`, `src/services/guardrail_engine/`, `src/services/oversight_engine/`. Rule 20 = ONE safety system.
- **Evidence:** Directory listing shows all three; validation audit flagged as active drift.
- **Dependencies:** none.
- **Effort:** M
- **Acceptance:** Single canonical safety module invoked by O1 Trust Layer (L7); the other two either deleted or reduced to thin re-exports with `@deprecated` tags; safety contract test suite passes.
- **Rollback:** Re-export shims restore old surfaces without behaviour change.
- **Priority:** P0 · **Status:** TODO

### A4. Enforce `canonicalize()` at Every Intake Boundary
- **Category:** INT
- **Reason:** Three canonicalisation paths exist (`src/services/canonical/`, `canonical/mappings.ts`, adapter-local maps). Canonical Contract requires a single gate before L4.
- **Evidence:** Repo file listing includes both `src/services/canonical/` and top-level `canonical/mappings.ts`.
- **Dependencies:** none (no schema change).
- **Effort:** M
- **Acceptance:** All L1→L2 adapters (`scribe_adapter`, `file_adapter`, `conversation_engine`, `context_engine`) route strings through `src/services/canonical/index.ts`; top-level `canonical/mappings.ts` deleted or merged; `tests/unit/canonical_mapping.test.ts` extended to cover all adapter entrypoints.
- **Rollback:** Restore duplicate maps from git.
- **Priority:** P0 · **Status:** TODO

### A5. Re-enable Episodic Memory as READ-ONLY Context Contributor
- **Category:** INT
- **Reason:** `src/services/episodic_memory/client.ts` exists and is fully implemented but stubbed in `cognitive/index.ts` because it previously mutated DDX probabilities post-SSAL. Freeze permits it as a pre-Bayesian **read-only context contributor**.
- **Evidence:** Archived `archive/v3_legacy/episodic_memory_client.ts` MANIFEST notes "DDX probability mods overwritten by V3"; live `src/services/episodic_memory/client.ts` still present.
- **Dependencies:** A4.
- **Effort:** M
- **Acceptance:** Episodic recall injected into L4 Unified Clinical Context **before** L6 candidate generation; contract test proves no post-SSAL mutation; feature flag `enable_episodic_readonly` default OFF.
- **Rollback:** Toggle feature flag off.
- **Priority:** P1 · **Status:** TODO

### A6. Wire Orphaned Learning Capture APIs to UI
- **Category:** INT
- **Reason:** `src/services/learning_system/` and edge function `capture-learning` exist but UI never calls the diagnosis/treatment/safety-override capture functions. Human-in-the-loop principle is unenforceable without signal capture.
- **Evidence:** `learning_system/client.ts` exports capture APIs; grep for call sites in `src/components/` and `src/pages/` returns only doctor-favorites/style paths.
- **Dependencies:** none.
- **Effort:** M
- **Acceptance:** `SafetyOverrideDialog`, `ConsultationReport` edit path, and DDX correction UI all invoke corresponding learning-capture APIs; rows land in learning tables with correct RLS scoping.
- **Rollback:** Remove call sites; capture APIs remain dormant.
- **Priority:** P1 · **Status:** TODO

### A7. Bind Knowledge Graph strings to Terminology codes
- **Category:** INT
- **Reason:** KG in `src/services/kg/` and `clinical/knowledge/canonical_disease_profiles.ts` uses hard-coded names. Terminology Platform v1.0 is frozen and exposes `terminology_canonicalize` / `terminology_lookup` RPCs.
- **Evidence:** Existing RPCs listed under db-functions; KG files present.
- **Dependencies:** Terminology v1.0 (DONE), A4.
- **Effort:** L
- **Acceptance:** Every KG symptom/finding/diagnosis carries a SNOMED code; a migration script + one-off admin job produces the binding table; runtime resolution goes through `terminology_lookup`; parity benchmark within 2% of pre-binding scores.
- **Rollback:** Keep string-based fallback path behind feature flag.
- **Priority:** P1 · **Status:** TODO

---

## SECTION B — Implementation (P1 → P2)

### B1. Replace `file_adapter` PDF stub with real parser (pdf.js)
- **Category:** IMPL
- **Reason:** L1 modality gap; file uploads are the primary intake path for lab reports.
- **Evidence:** `src/services/file_adapter/index.ts` currently returns stubbed content.
- **Dependencies:** A4.
- **Effort:** M
- **Acceptance:** PDF & image (OCR via existing pipeline) inputs produce normalized text that flows through canonicalize → context builder; unit test on 5 representative lab PDFs.
- **Rollback:** Revert to stub; feature flag `enable_file_parser`.
- **Priority:** P1 · **Status:** TODO

### B2. Follow-up Outcome Capture UI → `outcome_feedback`
- **Category:** IMPL
- **Reason:** Table/schema exists; no writer path. Required for L9 Clinical Memory closure and future clinical evaluation.
- **Evidence:** Learning capture tables present; no UI writer in components.
- **Dependencies:** A6.
- **Effort:** M
- **Acceptance:** Follow-up form on ConsultationDetail writes outcome + correctness label with RLS enforced; admin dashboard shows aggregate.
- **Rollback:** Hide UI; table remains.
- **Priority:** P1 · **Status:** TODO

### B3. Formalise Guideline Versioning aligned with Terminology release lifecycle
- **Category:** IMPL / DOC
- **Reason:** Governance principle "Version-controlled" & release discipline (Rule 17/31). Guidelines currently promoted ad-hoc.
- **Evidence:** `guideline_engine/` present; no release table analogous to `terminology.releases`.
- **Dependencies:** none.
- **Effort:** M
- **Acceptance:** `guideline_releases` table with active_release_id; admin promotion RPC modeled on `terminology_rollback_release`; docs in `docs/`.
- **Rollback:** Keep existing static guideline set.
- **Priority:** P2 · **Status:** TODO

---

## SECTION C — Validation (P0 → P1)

### C1. Single-Entrypoint Contract Test
- **Category:** VAL
- **Reason:** Enforces workspace Rule 2 (`runClinicalPipeline` is the only entrypoint) and Rule 19 (benchmark parity).
- **Evidence:** Two orchestrators still coexist.
- **Dependencies:** A1, A2.
- **Effort:** S
- **Acceptance:** CI test greps for forbidden imports (`clinical_pipeline_orchestrator` outside archive); fails build if found.
- **Priority:** P0 · **Status:** TODO

### C2. Canonical Contract Guard
- **Category:** VAL
- **Reason:** Rule 21 — no string logic after ingestion.
- **Evidence:** Multiple string-based paths still traceable in `ddx_engine`, `kg`.
- **Dependencies:** A4, A7.
- **Effort:** M
- **Acceptance:** Lint/AST rule (or targeted test) ensures modules under `src/services/{ddx_engine,bayesian_engine,kg,physiology_engine,authority}` never receive raw string symptoms.
- **Priority:** P1 · **Status:** TODO

### C3. Determinism Regression Suite
- **Category:** VAL
- **Reason:** Determinism Contract; adversarial validation flagged it as unproven end-to-end.
- **Evidence:** `validation_suite/` exists; no dedicated determinism harness.
- **Dependencies:** A1.
- **Effort:** M
- **Acceptance:** Same input × N runs → byte-identical SSAL objects; harness added to `validation_suite/runner.ts`.
- **Priority:** P1 · **Status:** TODO

### C4. Perturbation / Robustness Suite Baseline
- **Category:** VAL
- **Reason:** `perturbation_harness.ts` exists; no published baseline.
- **Evidence:** `src/services/validation_suite/index.ts` exports `runPerturbationSuite`.
- **Dependencies:** A4.
- **Effort:** M
- **Acceptance:** Baseline report committed under `.lovable/` and referenced from `docs/validation-framework.md`.
- **Priority:** P1 · **Status:** TODO

### C5. Latency Budget Enforcement (<3s)
- **Category:** VAL
- **Reason:** Rule 8; must be measured continuously.
- **Evidence:** `pipeline_trace.ts` and `wave_latencies` in O1.
- **Dependencies:** A1.
- **Effort:** S
- **Acceptance:** CI benchmark run asserts p95 total ≤ 3000ms on the standard case set.
- **Priority:** P1 · **Status:** TODO

---

## SECTION D — Clinical Evaluation (P1 → P2)

### D1. Pilot Case Set Curation (n≥100 primary care)
- **Category:** CE
- **Reason:** Blocks Methods & Clinical publications and any external claims.
- **Evidence:** Only synthetic v3/v8/v9/v10 benchmark cases exist.
- **Dependencies:** none.
- **Effort:** XL
- **Acceptance:** ≥100 de-identified primary-care cases with adjudicated ground truth stored under `tests/cases/`.
- **Priority:** P1 · **Status:** TODO

### D2. Clinician-in-the-Loop Pilot (private clinic, India)
- **Category:** CE
- **Reason:** Product knowledge — Phase 1 target market; MVP validation gate.
- **Evidence:** Project knowledge (`project-knowledge`) prioritises Indian private clinics.
- **Dependencies:** A5, A6, B2, D1.
- **Effort:** XL
- **Acceptance:** ≥1 clinic, ≥4 weeks, weekly override-rate and outcome-agreement report.
- **Priority:** P2 · **Status:** TODO

### D3. Bias & Fairness Monitoring Baseline
- **Category:** CE / DOC
- **Reason:** `ethics/api.ts` defines dimensions but no baseline captured.
- **Evidence:** `BIAS_MONITORING_DIMENSIONS` present, empty reports.
- **Dependencies:** D1.
- **Effort:** M
- **Acceptance:** First bias report committed.
- **Priority:** P2 · **Status:** TODO

---

## SECTION E — Documentation

### E1. Publish `ARCHITECTURE_FREEZE_v1.md`
- **Category:** DOC
- **Reason:** Codify the 11 layers, contracts, and rules that are now frozen.
- **Evidence:** `V4_ARCHITECTURE.md`, `contracts/SYSTEM_CONTRACTS.md`, this backlog.
- **Dependencies:** none.
- **Effort:** S
- **Acceptance:** New file at `architecture/ARCHITECTURE_FREEZE_v1.md` referencing this backlog.
- **Priority:** P0 · **Status:** TODO

### E2. Update `docs/data-flow.md` to L1→L11 model
- **Category:** DOC
- **Effort:** S · **Priority:** P1 · **Status:** TODO

### E3. Governance Runbook: Knowledge Promotion
- **Category:** DOC
- **Reason:** Consistent promotion flow for terminology, KG bindings, and guidelines.
- **Dependencies:** A7, B3.
- **Effort:** S · **Priority:** P2 · **Status:** TODO

---

## SECTION F — Technical Debt

### F1. Delete Dead Cognitive Modules re-exported from `src/services/cognitive/`
- **Category:** DEBT
- **Reason:** Rule 6 (no dead code). `clinical_cognitive_controller.ts` mirrors archived file.
- **Evidence:** Present in both `src/services/cognitive/` and `archive/v3_legacy/`.
- **Effort:** S · **Priority:** P1 · **Status:** TODO

### F2. Prune Duplicate DDX Fallbacks
- **Category:** DEBT
- **Reason:** `candidate_fallback.ts` and `candidate_fallback_v2.ts` coexist; Rule 7 (no duplication).
- **Effort:** S · **Priority:** P2 · **Status:** TODO

### F3. Retire `bayesian_engine/client.ts` vs `client_v3.ts` ambiguity
- **Category:** DEBT
- **Effort:** S · **Priority:** P2 · **Status:** TODO

---

## SECTION G — Future (P3, explicitly deferred)

- G1. FHIR ingestion adapter (L1)
- G2. Wearables adapter (L1)
- G3. Autonomous continual learning — **BLOCKED by design philosophy (no online learning in runtime).** Retain as capture-only.
- G4. Multi-clinic aggregate analytics dashboard — deferred per Rule 34 until workflow adoption validated.

---

## Dependency-Ordered Execution Sequence (auto-unlock)

```
E1 ──┐
     ├─► A2 ─► A1 ─► C1 ─► C3 ─► C5
A3 ──┤
A4 ──┼─► C2 ─► A7 ─► B3 ─► E3
     │
     ├─► A5 ┐
     ├─► A6 ┼─► B2 ─► D1 ─► D2 ─► D3
     └─► B1 ┘
```

Rule: on completion of any node, the next unblocked node with the highest priority (P0 > P1 > P2) becomes IN-PROGRESS. Re-evaluate this backlog after each milestone (A-block completion, C-block completion, first pilot week). Do **not** revisit architecture unless a specific task's Acceptance criteria cannot be met without changing a frozen layer — in which case, stop and escalate.

---

## MVP Definition (derived, not invented)

**MVP = Architecture Freeze v1.0 executed end-to-end.** Concretely, all P0 tasks complete:
A1, A2, A3, A4, C1, E1. This yields: one orchestrator, one safety surface, one canonicalisation gate, one entrypoint contract test, and the freeze document published. Everything else is MVP-quality (P1) or post-MVP.
