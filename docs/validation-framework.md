# Validation Framework

This document describes how the platform protects data quality, enforces correctness and handles exceptions across the pipeline.

---

## 1. Objectives

The validation framework exists to satisfy four practical goals:

1. **Correctness.** The system produces the right output for known inputs.
2. **Determinism.** The same input produces the same output, every time.
3. **Safety.** The system does not silently degrade in the presence of bad or partial input.
4. **Traceability.** Every validation outcome is recorded and can be reviewed later.

These map directly to the System Contracts (`contracts/SYSTEM_CONTRACTS.md`) — specifically the Validation, Determinism and Traceability contracts.

---

## 2. Three-Tier Validation Model

Validation runs at three tiers. Each tier addresses a different class of risk.

### Tier 1 — Pre-Implementation Validation (design-time)

**Artefact:** `validation/VALIDATION_FIREWALL.md`

A checklist applied before any new feature is built. A "yes" answer to any of these halts the work.

| Check | Purpose |
|---|---|
| Does it violate a canonical contract? | Prevent introduction of raw-string logic. |
| Does it introduce raw strings? | Preserve the canonical-only reasoning principle. |
| Can input → output be traced clearly? | Preserve auditability. |
| Can test cases be written? | Prevent untestable behaviour. |
| If wrong, does it break reasoning? | Identify safety-critical changes before they are coded. |

This tier is an architectural gate, not a code-level check. It exists because most of the failures we have had to fix retroactively were avoidable at design time.

### Tier 2 — Input Validation (run-time)

Applied to every clinical input as it enters the pipeline. Implemented across canonicalisation and the context builder.

| Check | Failure handling |
|---|---|
| Required fields present | Stop and request the missing field via the Question Engine. |
| Vital-sign ranges plausible | Stop and surface a structured error to the clinician. |
| Language detected successfully | Stop and request clarification. |
| All terms map to canonical IDs | Log unmapped terms; flag for clinician confirmation. |

The policy is fail fast: bad input never reaches the reasoning layer.

### Tier 3 — Output Validation (regression suite)

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

The runner asserts that:

- The top-ranked diagnosis matches the expected outcome.
- The expected diagnoses appear within the top-N candidate set.
- Safety flags fire when expected, and only when expected.
- Identical inputs produce identical outputs.

---

## 3. Data Quality Checks

The framework enforces six categories of data quality, each tied to a specific stage.

| Category | Stage | Mechanism |
|---|---|---|
| **Schema conformance** | Input | Typed inputs at module boundaries; malformed payloads rejected. |
| **Range plausibility** | Input | Bounded checks on vitals, ages, durations. |
| **Language integrity** | Normalisation | Detected language is recorded and locked for the session. |
| **Terminology resolution** | Canonicalisation | Every term resolves to a canonical ID, or it is flagged. |
| **Logical consistency** | Reasoning | Conflict-resolution rules between mutually exclusive clinical states. |
| **Output completeness** | Authority | Confidence engine flags low-data results before they are returned. |

---

## 4. Exception Handling Policy

The system never returns a "best guess" silently. Every exception is either surfaced to the clinician as a structured message, or logged to the audit trail with enough detail to review it later.

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

Reasoning layers may not contain non-deterministic operations: no randomness, no time-dependent branching, no uncached external calls. The validation suite includes determinism tests that run the same scenario twice and assert byte-identical results.

---

## 6. Ownership

| Function | Responsibility |
|---|---|
| System design | Define and maintain validation scenarios; review failures. |
| Engineering | Implement run-time checks at each pipeline stage. |
| Governance | Audit the trace records produced by validation runs. |
| Clinician | Review surfaced exceptions and confirm or override flagged terms. |

---

## 7. Running the Validation Suite

The executable suite lives at `src/services/validation_suite/`. It exposes:

- `runValidationSuite(...)` — runs all declared scenarios.
- `runPerturbationSuite(...)` — varies inputs to stress-test robustness.

The presence of a declarative scenario file (`VALIDATION_SUITE.json`), a runner module, a perturbation harness and the pre-build checklist together make validation a first-class concern in the development cycle rather than an afterthought.

---

## 8. Assurance Posture

| Question | Answer |
|---|---|
| Is bad input rejected before it can affect clinical reasoning? | Yes — Tier 2. |
| Is system behaviour reproducible? | Yes — determinism contract plus the suite. |
| Is every validation outcome recorded? | Yes — traceability contract. |
| Is there a gate that prevents architecturally unsafe features from being built? | Yes — Tier 1 (Validation Firewall). |
| Is there an executable regression suite? | Yes — `src/services/validation_suite/`. |
