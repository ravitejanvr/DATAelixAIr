# System Architecture

**Document purpose:** Provide a non-developer reviewer with a complete, formal description of the system's components, layers and interactions.

**Scope:** Backend reasoning pipeline, data layer, and integration boundaries. The user-facing application layer is under development and is excluded from this document.

---

## 1. Architectural Principles

The system is engineered around four non-negotiable principles. Each principle exists to make the system **predictable, auditable and safe** for use in a clinical setting.

| Principle | Definition | Consequence |
|---|---|---|
| **Strict Linear Pipeline** | Data flows in one direction through a fixed sequence of stages. | No parallel scoring paths, no shadow logic, no race conditions. |
| **Canonical-Only Reasoning** | Raw input strings are converted to standardised identifiers before reaching the reasoning layer. | The reasoning layer cannot be confused by spelling, language or synonym variation. |
| **Single Source of Truth (SSOT)** | The final decision object is produced once, frozen, and may not be modified. | Downstream consumers (UI, exports, audit) all see identical outputs. |
| **Determinism** | The same input must always produce the same output. | The system is testable, reproducible and defensible. |

These principles are codified in `contracts/SYSTEM_CONTRACTS.md` and `architecture/V4_ARCHITECTURE.md`.

---

## 2. System Context

### 2.1 Stakeholders

- **Primary user:** Clinician in a private primary-care setting.
- **Secondary user:** Clinic administrator (workflow, billing, governance).
- **System governance:** Compliance and audit reviewers.

### 2.2 External Interfaces

- Speech-to-text provider (voice input).
- Text-to-speech provider (multilingual voice output).
- Managed authentication and database service (server-side, with row-level isolation).
- Clinical knowledge sources (terminology, guidelines).

---

## 3. Layered Architecture

The system is organised into **ten layers**. Each layer has a single responsibility and a defined contract with its neighbours. The full reference is in `ARCHITECTURE.md`; a summary is given here.

| # | Layer | Responsibility | Implementation reference |
|---|---|---|---|
| 1 | User Interface | Clinician-facing interaction surface | `src/pages/`, `src/components/` (under development) |
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

## 4. Reasoning Pipeline (Layers 3–9 in execution order)

The reasoning pipeline is the analytical core of the system. It converts a normalised clinical input into a final, explainable decision.

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
Converts free-text inputs into language-agnostic canonical features. Provides synonym resolution, language detection, and the public API surface (`canonicalize`, `resolveCanonicalId`, `getCanonicalEntry`). This is the **only** module permitted to define a synonym map.

### 5.2 Context Builder (`src/lib/clinical-context.ts`)
Constructs the typed `ClinicalContext` object that all downstream stages consume. Eliminates ad-hoc property attachment ("monkey-patching") and is the structural enforcement of the SSOT principle at the input boundary.

### 5.3 Reasoning / DDX (`src/services/ddx_engine/`, `src/services/reasoning_engine/`)
Generates ranked differential diagnoses. Operates exclusively on canonical IDs. No string matching, no LLM-based diagnosis.

### 5.4 Safety (`src/layers/safety/`, `src/services/clinical/`)
Independent safety layer that may flag, but cannot silently rewrite, the reasoning output. Safety findings are surfaced through the Authority Layer.

### 5.5 Confidence (`src/services/confidence/`)
Calculates uncertainty using entropy of the diagnostic spread and a data-sufficiency score. Used by the Authority Layer to decide whether to ask further questions or present a result.

### 5.6 Authority / SSAL (`src/services/authority/`)
The single decision-maker. Combines reasoning, safety and confidence into one frozen output. **Replaces** legacy patterns such as score fusion, systemic override and shadow engines.

### 5.7 Explainability (`src/services/explainability/`)
Produces "why this" and "why not that" explanations from the same data structures used to compute the decision. Explanation must equal computation (Explainability Contract).

---

## 6. Data Layer

The persistence layer is defined in `supabase/`. It is structured around three concerns:

| Concern | Mechanism |
|---|---|
| **Tenant isolation** | Row Level Security policies scoped by `clinic_id`. |
| **Role separation** | Roles stored in a dedicated `user_roles` table; never on the user/profile record. |
| **Auditability** | Append-only `audit_logs` and `ai_decision_ledger` tables, written server-side. |

Every data-modifying operation is expected to traverse a server-side function or a policy-protected table. Client code is never trusted to assert role, clinic membership or ownership.

---

## 7. Cross-Cutting Concerns

- **Determinism:** Reasoning layers must not contain randomness. Verified by validation suite (`src/services/validation_suite/`).
- **Traceability:** Every run records canonical mapping, activated states, contributions and final scores (`contracts/SYSTEM_CONTRACTS.md` §7).
- **Failure handling:** The system follows a fail-fast policy. Invalid inputs, missing canonical mappings or contract violations stop execution rather than silently degrading.

---

## 8. Architectural Constraints (What the System Will Not Do)

To keep the system reviewable and safe, the following are explicitly prohibited by the architecture:

- No raw strings in the reasoning layer.
- No layer skipping or parallel pipelines.
- No mutation of the `SSAL` output.
- No LLM-based final diagnosis or scoring override.
- No client-side authority for roles, permissions or tenant scope.

These constraints are enforced as **contracts**, not as guidelines. Violations are treated as system failures.
