# System Architecture

This document describes the components, layers and interactions that make up the DATAelixAIr platform. It covers the backend reasoning pipeline, the data layer and the integration boundaries. The clinician-facing application layer is under active development and is described separately as it stabilises.

---

## 1. Architectural Principles

The system is built around four non-negotiable principles. They exist because clinical inputs are messy, clinical decisions need to be auditable, and the platform has to behave the same way every time it runs.

| Principle | Definition | Consequence |
|---|---|---|
| **Strict Linear Pipeline** | Data flows in one direction through a fixed sequence of stages. | No parallel scoring paths, no shadow logic, no race conditions. |
| **Canonical-Only Reasoning** | Raw input strings are converted to standardised identifiers before reaching the reasoning layer. | The reasoning layer cannot be confused by spelling, language or synonym variation. |
| **Single Source of Truth (SSOT)** | The final decision object is produced once, frozen, and may not be modified. | UI, exports and audit all see identical outputs. |
| **Determinism** | The same input must always produce the same output. | The system is testable, reproducible and defensible. |

These principles are codified in `contracts/SYSTEM_CONTRACTS.md` and `architecture/V4_ARCHITECTURE.md`.

---

## 2. System Context

### 2.1 Users and Stakeholders

- **Primary user:** Clinician in a private primary-care setting.
- **Secondary user:** Clinic administrator (workflow, billing, governance).
- **Internal stakeholders:** Compliance and audit reviewers within the operating clinic.

### 2.2 External Interfaces

- Speech-to-text provider (voice input).
- Text-to-speech provider (multilingual voice output).
- Managed authentication and database service, with row-level isolation enforced server-side.
- Clinical knowledge sources (terminology, guidelines).

### 2.3 Operating Reality

Real-world clinical inputs arrive incomplete, in mixed languages, with inconsistent formatting, and through multiple channels. The architecture is shaped around that fact: every layer is designed to either normalise the input, refuse it cleanly, or carry forward an explicit record of what it did with it.

---

## 3. Layered Architecture

The system is organised into ten layers. Each layer owns one responsibility and exposes a defined contract to its neighbours. The full reference lives in `ARCHITECTURE.md`; the summary is below.

| # | Layer | Responsibility | Implementation |
|---|---|---|---|
| 1 | User Interface | Clinician-facing interaction surface | `src/pages/`, `src/components/` (in progress) |
| 2 | Clinical Workflow | Consultation lifecycle, intake, triage | `src/layers/workflow/` |
| 3 | Multilingual Processing | Language detection, transcript normalisation | `src/layers/multilingual/`, `src/services/canonical/` |
| 4 | Clinical Intelligence | Diagnosis, investigation, treatment reasoning | `src/services/reasoning_engine/`, `src/services/ddx_engine/` |
| 5 | Clinical Safety | Red-flag detection and escalation | `src/services/clinical/`, `src/layers/safety/` |
| 6 | Evidence Retrieval | Guideline lookup and citation | `src/services/guideline_engine/`, `src/layers/evidence/` |
| 7 | Learning | Doctor preferences and signal capture | `src/layers/learning/` |
| 8 | Monitoring | Operational telemetry and metrics | `src/layers/monitoring/` |
| 9 | Governance | Audit logging, compliance, access matrix | `src/layers/governance/`, `supabase/migrations/` |
| 10 | Infrastructure & Security | Storage, backup, availability, offline support | `src/layers/infrastructure/` |

---

## 4. Reasoning Pipeline

The reasoning pipeline is the analytical core of the system. It takes a normalised clinical input and produces a final, explainable decision.

```
INPUT (text / voice / file)
   │
   ▼
┌──────────────────────────────────────────────┐
│ 1. Ingestion                                 │  Captures raw input.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 2. Canonicalisation                          │  Maps free text → canonical IDs.
│    src/services/canonical/                   │  Single unified synonym map.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 3. Context Builder                           │  Assembles structured patient state.
│    src/lib/clinical-context.ts               │  No raw strings beyond this point.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 4. Question Engine                           │  Detects missing fields and generates
│    src/services/question_engine/             │  the next clinically useful question.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 5. Differential Diagnosis (DDX)              │  Generates ranked diagnostic candidates
│    src/services/ddx_engine/                  │  using canonical IDs only.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 6. Cognitive Layer (advisory)                │  Hypothesis expansion, counterfactual
│    src/services/cognitive/                   │  reasoning, evidence-gap detection.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 7. Completeness Layer                        │  Detects missing tests, missed red-flag
│    src/services/completeness/                │  combinations, required questions.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 8. Confidence Engine                         │  Quantifies uncertainty (entropy of
│    src/services/confidence/                  │  candidate spread, data sufficiency).
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 9. Safety Layer                              │  High-risk condition detection,
│    src/layers/safety/                        │  vital-sign triggers, escalation.
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 10. Authority Layer → SSAL                   │  Final decision; resolution order:
│     src/services/authority/                  │  Reasoning → Safety → Confidence → Rank.
│                                              │  Output is frozen (immutable).
└──────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────┐
│ 11. Explainability                           │  Why this diagnosis, why not others,
│     src/services/explainability/             │  contributing features, confidence.
└──────────────────────────────────────────────┘
   │
   ▼
OUTPUT (structured report for clinician review)
```

---

## 5. Component Responsibilities

### 5.1 Canonicalisation (`src/services/canonical/`)
Converts free-text input into language-agnostic canonical features. Handles synonym resolution, language detection, and exposes the public surface (`canonicalize`, `resolveCanonicalId`, `getCanonicalEntry`). This is the only module permitted to define a synonym map; allowing others to do so is what produced silent drift in earlier iterations.

### 5.2 Context Builder (`src/lib/clinical-context.ts`)
Builds the typed `ClinicalContext` object that every downstream stage consumes. It exists specifically to stop ad-hoc property attachment ("monkey-patching"), which had previously made it impossible to reason about what a downstream layer was actually receiving.

### 5.3 Reasoning / DDX (`src/services/ddx_engine/`, `src/services/reasoning_engine/`)
Generates ranked differential diagnoses. Operates exclusively on canonical IDs. No string matching. No LLM-based diagnosis.

### 5.4 Safety (`src/layers/safety/`, `src/services/clinical/`)
Independent safety layer. It can flag, but it cannot silently rewrite, the reasoning output. Safety findings surface through the Authority Layer.

### 5.5 Confidence (`src/services/confidence/`)
Calculates uncertainty using the entropy of the diagnostic spread combined with a data-sufficiency score. The Authority Layer uses this to decide whether to ask further questions or present a result.

### 5.6 Authority / SSAL (`src/services/authority/`)
The single decision-maker. Combines reasoning, safety and confidence into one frozen output. It replaces earlier patterns such as score fusion, systemic override and shadow engines, all of which were removed because they made outcomes non-deterministic.

### 5.7 Explainability (`src/services/explainability/`)
Produces "why this" and "why not that" explanations from the same data structures used to compute the decision. Explanation must equal computation — this is enforced by the Explainability Contract.

---

## 6. Data Layer

The persistence layer is defined under `supabase/`. It is structured around three concerns:

| Concern | Mechanism |
|---|---|
| **Tenant isolation** | Row Level Security policies scoped by `clinic_id`. |
| **Role separation** | Roles stored in a dedicated `user_roles` table; never on the user/profile record. |
| **Auditability** | Append-only `audit_logs` and `ai_decision_ledger` tables, written server-side. |

Every data-modifying operation is expected to traverse a server-side function or a policy-protected table. Client code is never trusted to assert role, clinic membership or ownership.

---

## 7. Cross-Cutting Concerns

- **Determinism.** Reasoning layers contain no randomness. The validation suite (`src/services/validation_suite/`) verifies this by running scenarios twice and asserting identical results.
- **Traceability.** Every run records canonical mapping, activated states, contributions and final scores. See `contracts/SYSTEM_CONTRACTS.md` §7.
- **Failure handling.** The system fails fast. Invalid inputs, unmapped terms or contract violations stop execution rather than silently degrading.

---

## 8. Architectural Constraints

To keep the system reviewable and safe, the following are explicitly prohibited by the architecture:

- No raw strings in the reasoning layer.
- No layer skipping or parallel pipelines.
- No mutation of the `SSAL` output.
- No LLM-based final diagnosis or scoring override.
- No client-side authority for roles, permissions or tenant scope.

These are contracts, not guidelines. Violations are treated as system failures.
