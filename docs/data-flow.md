# Data Flow

This document describes the end-to-end lifecycle of clinical data within the platform — from initial capture through validation, processing, persistence and output.

---

## 1. Lifecycle Overview

Clinical data passes through six logical stages. Each stage transforms the data into a more structured, more validated and more explainable form.

```
   ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌────────────┐   ┌───────────┐   ┌─────────┐
   │ 1. INPUT │ → │ 2. NORMALISE │ → │ 3. VALIDATE│ → │ 4. CANONICAL│ → │ 5. REASON │ → │ 6. OUTPUT│
   └──────────┘   └──────────────┘   └────────────┘   └────────────┘   └───────────┘   └─────────┘
                                                                                │
                                                                                ▼
                                                                       ┌──────────────────┐
                                                                       │ 7. PERSISTENCE   │
                                                                       │ (audit + record) │
                                                                       └──────────────────┘
```

The shape of this pipeline is a direct response to the operating reality: clinical input arrives in inconsistent formats and multiple languages, and downstream consumers (records, audit, exports) need a single, structured representation they can rely on.

---

## 2. Stage-by-Stage Description

### Stage 1 — Input Capture

| Aspect | Description |
|---|---|
| Sources | Typed text, voice (speech-to-text), uploaded clinical documents (PDF, lab reports). |
| Languages | English plus Hindi, Telugu and Tamil, including native scripts. |
| Boundary | Inputs are accepted only via authenticated sessions. |
| Contract | Raw input is treated as untrusted and unstructured. |

### Stage 2 — Normalisation

| Aspect | Description |
|---|---|
| Goal | Convert free-form input into a uniform internal representation. |
| Operations | Lower-casing, whitespace cleanup, language detection, transliteration where applicable. |
| Implementation | `src/services/canonical/normalizer.ts`, multilingual processing layer. |
| Output | Normalised text plus detected language code. |

### Stage 3 — Validation

| Aspect | Description |
|---|---|
| Goal | Reject malformed, ambiguous or unsafe input before it reaches the reasoning layer. |
| Checks | Required-field presence, value-range checks (e.g. vital signs), language-detection success, canonical-mapping success. |
| Failure mode | Fail fast — execution stops with a structured error rather than producing a degraded result. |
| Reference | `docs/validation-framework.md`. |

### Stage 4 — Canonical Mapping

| Aspect | Description |
|---|---|
| Goal | Replace human-language symptoms and signs with standardised identifiers (canonical IDs aligned to clinical terminologies such as SNOMED). |
| Why it matters | The reasoning layer must not depend on spelling, synonym or language. After this stage, all logic operates on IDs. |
| Implementation | `src/services/canonical/`, `canonical/mappings.ts`. |
| Output | A typed `ClinicalContext` containing canonical features, vitals, history and metadata. |

### Stage 5 — Reasoning

| Aspect | Description |
|---|---|
| Goal | Produce a ranked differential diagnosis, recommended investigations, safety flags and a confidence score. |
| Inputs | The canonical `ClinicalContext` only. |
| Sub-stages | Differential generation → cognitive expansion (advisory) → completeness check → confidence calculation → safety evaluation → authority resolution. |
| Output | A frozen `SSAL` (Single Source of Authority Layer) object. |
| Constraint | The output of this stage cannot be modified by any subsequent stage. |

### Stage 6 — Output

| Aspect | Description |
|---|---|
| Goal | Present the SSAL to the clinician in a reviewable, explainable form. |
| Forms | Structured report, clinician-facing explanation ("why this / why not that"), optional voice output. |
| Constraint | The clinician retains final authority. AI output is positioned as assistance, not as a final medical decision. |

### Stage 7 — Persistence

Persistence runs in parallel with the output stage but is logically separate.

| Aspect | Description |
|---|---|
| What is stored | Canonical input, derived context, reasoning trace, final SSAL, safety flags, clinician actions. |
| Where it is stored | Database tables governed by Row Level Security and tenant scoping. |
| Audit copy | A second, append-only copy is written to `audit_logs` and `ai_decision_ledger`. |
| Retention | Governed by clinic-level configuration (see `docs/governance-compliance.md`). |

---

## 3. Data Contracts Between Stages

Each transition between stages is governed by an explicit contract. A stage may only emit data that conforms to the contract its consumer expects.

| Transition | Contract |
|---|---|
| Input → Normalise | Raw bytes / strings; no schema. |
| Normalise → Validate | Normalised text + language code. |
| Validate → Canonical | Validated, well-formed input or a structured error. |
| Canonical → Reason | `ClinicalContext` with canonical IDs only — no raw strings. |
| Reason → Output | A frozen `SSAL` object. |
| Reason → Persistence | The same `SSAL` plus a full reasoning trace. |

These contracts are formalised in `contracts/SYSTEM_CONTRACTS.md`.

---

## 4. Exception Handling

The system uses a fail-fast policy. The table below summarises how each class of failure is handled.

| Failure class | Example | Handling |
|---|---|---|
| Input failure | Empty transcript, unsupported language. | Reject at validation; surface a structured error. |
| Normalisation failure | Cannot detect language. | Stop; request clarification from the user. |
| Canonical-mapping failure | A symptom cannot be resolved to a canonical ID. | Log the unmapped term; either prompt the clinician or exclude with explicit annotation. |
| Reasoning failure | Insufficient data to produce any candidate. | Return an explicit "insufficient context" result; do not invent diagnoses. |
| System failure | Downstream service unavailable. | Return a controlled error; do not silently produce a partial result. |

---

## 5. Traceability Across the Lifecycle

Every clinical run produces a trace record containing:

- The canonical mapping that was applied.
- The activated clinical states.
- The contributions of each feature to the final ranking.
- The final SSAL.
- The clinician's subsequent action (accept, edit, override).

This trace is the basis for governance reviews, model improvement and incident investigation. See `docs/governance-compliance.md` §4 for how traces are protected and accessed.

---

## 6. Boundaries the Data Will Not Cross

- Raw user strings do not enter the reasoning layer.
- Client-side code does not assert tenant scope or user role.
- AI output does not bypass the clinician.
- Persisted data does not leave the tenant boundary defined by `clinic_id`.
