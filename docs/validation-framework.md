# Validation Framework

**Document purpose:** Define how the platform protects data quality, enforces correctness and handles exceptions. Written for review by stakeholders concerned with assurance, quality and risk.

---

## 1. Objectives

The validation framework exists to satisfy four assurance objectives:

1. **Correctness.** The system produces the right output for known inputs.
2. **Determinism.** The system produces the same output every time for the same input.
3. **Safety.** The system does not silently degrade in the presence of bad or partial input.
4. **Traceability.** Every validation outcome is recorded and can be reviewed.

These objectives map directly to the System Contracts (`contracts/SYSTEM_CONTRACTS.md`), specifically the Validation Contract, the Determinism Contract and the Traceability Contract.

---

## 2. Three-Tier Validation Model

The framework operates at three tiers. Each tier addresses a different class of risk.

### Tier 1 — Pre-Implementation Validation (Design-Time)

**Artefact:** `validation/VALIDATION_FIREWALL.md`

A mandatory checklist applied before any new feature is built. Any "yes" answer halts the work.

| Check | Purpose |
|---|---|
| Does it violate a canonical contract? | Prevent introduction of raw-string logic. |
| Does it introduce raw strings? | Preserve the canonical-only reasoning principle. |
| Can input → output be traced clearly? | Preserve auditability. |
| Can test cases be written? | Prevent untestable behaviour. |
| If wrong, does it break reasoning? | Identify safety-critical changes before they are coded. |

This tier is a **governance gate**, not a code-level check. It exists so that architectural integrity is defended before implementation begins.

### Tier 2 — Input Validation (Run-Time)

Applied to every clinical input as it enters the pipeline. Implemented across the canonicalisation and context-builder stages.

| Check | Failure handling |
|---|---|
| Required fields present | Stop and request the missing field via the Question Engine. |
| Vital-sign ranges plausible | Stop and surface a structured error to the clinician. |
| Language detected successfully | Stop and request clarification. |
| All terms map to canonical IDs | Log unmapped terms; flag for clinician confirmation. |

The policy is **fail fast**: a bad input never reaches the reasoning layer.

### Tier 3 — Output Validation (Regression Suite)

**Artefacts:**
- `validation/VALIDATION_SUITE.json` — declarative scenarios.
- `src/services/validation_suite/` — executable runner and test types.

A scenario specifies an input and the expected behaviour:

```json
{
  "case_id": "sepsis_01",
  "input": {
    "symptoms": ["fever", "tachycardia"],
    "vitals": { "bp": "90/60" }
  },
  "expected_top1": "SEPSIS",
  "expected_in_top3": ["SEPSIS", "PNEUMONIA"],
  "notes": "classic systemic case"
}
```

The runner asserts:

- The top-ranked diagnosis matches the expected outcome.
- The expected diagnoses appear within the top-N candidate set.
- Safety flags fire when expected and only when expected.
- Identical inputs produce identical outputs (determinism check).

---

## 3. Data Quality Checks

The framework enforces six categories of data quality, each tied to a specific stage of the pipeline.

| Category | Stage | Mechanism |
|---|---|---|
| **Schema conformance** | Input | Typed inputs at module boundaries; rejection of malformed payloads. |
| **Range plausibility** | Input | Bounded checks on vitals, ages, durations. |
| **Language integrity** | Normalisation | Detected language is recorded and locked for the session. |
| **Terminology resolution** | Canonicalisation | Every term must resolve to a canonical ID, or be flagged. |
| **Logical consistency** | Reasoning | Conflict-resolution rules between mutually exclusive clinical states. |
| **Output completeness** | Authority | Confidence engine flags low-data results before they are returned. |

---

## 4. Exception Handling Policy

The system never returns a "best guess" silently. Every exception is either:

- **Surfaced** to the clinician as a structured message, or
- **Logged** to the audit trail with sufficient detail for later review.

The decision tree is:

```
Bad input?  ─── yes ──► Stop, request clarification, log.
            └── no  ──► Proceed.

Mapping failure?  ─── yes ──► Flag term, continue with degraded confidence, log.
                  └── no  ──► Proceed.

Reasoning produces nothing?  ─── yes ──► Return "insufficient context"; do not fabricate.
                              └── no  ──► Continue.

Safety trigger fires?  ─── yes ──► Surface alert; ensure it appears in the SSAL.
                       └── no  ──► Continue.
```

---

## 5. Determinism Guarantee

Reasoning layers may not contain non-deterministic operations (no randomness, no time-dependent branching, no uncached external calls). The validation suite includes determinism tests that run the same scenario twice and assert byte-identical results.

---

## 6. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Business Analyst / System Owner | Define and maintain validation scenarios; review failures. |
| Engineering | Implement run-time checks at each pipeline stage. |
| Governance / Compliance | Audit the trace records produced by the validation runs. |
| Clinician | Review surfaced exceptions and confirm or override flagged terms. |

---

## 7. How to Run the Validation Suite

The executable suite lives at `src/services/validation_suite/`. It exposes:

- `runValidationSuite(...)` — runs all declared scenarios.
- `runPerturbationSuite(...)` — runs a stress harness that varies inputs to test robustness.

A reviewer does not need to execute the suite to assess the design. The presence of a declarative scenario file (`VALIDATION_SUITE.json`), a runner module, a perturbation harness and a pre-build checklist together demonstrate that validation is treated as a first-class concern, not an afterthought.

---

## 8. Summary of Assurance Posture

| Question | Answer |
|---|---|
| Is bad input rejected before it can affect clinical reasoning? | Yes — Tier 2. |
| Is system behaviour reproducible? | Yes — determinism contract + suite. |
| Is every validation outcome recorded? | Yes — traceability contract. |
| Is there a gate that prevents architecturally unsafe features from being built? | Yes — Tier 1 (Validation Firewall). |
| Is there an executable regression suite? | Yes — `src/services/validation_suite/`. |
