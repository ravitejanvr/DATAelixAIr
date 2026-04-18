# DATAelixAIr — Clinical AI Systems & Data Governance

DATAelixAIr is a clinical productivity assistant for primary-care practitioners. It takes unstructured clinical input — typed text, voice, uploaded documents — and turns it into a structured, auditable clinical reasoning trace, producing explainable diagnostic, investigation and prescription suggestions for the clinician to review.

This repository is public. It contains the architecture, system contracts, validation framework, governance model and working backend that make up the platform. The clinician-facing UI is being developed in parallel and is not the focus of what is documented here.

---

## 1. Background and Design Motivation

The system design is grounded in the practical realities of healthcare data: inputs arrive in inconsistent formats and multiple languages, the same clinical concept is expressed in many different ways, decisions need to be auditable after the fact, and downstream systems expect structured clinical outputs rather than free text. Every architectural choice in this repository — the canonicalisation layer, the strict pipeline, the frozen authority output, the immutable decision ledger — exists to address one of those problems directly.

Two design rules sit underneath everything:

1. **Single Source of Truth.** The Authority Layer produces a frozen `SSAL` object. Nothing downstream is allowed to mutate it.
2. **Canonical-only reasoning.** Raw user strings stop at the ingestion boundary. The reasoning layer only ever sees canonical IDs (aligned to clinical terminologies such as SNOMED).

---

## 2. Scope of Work and Responsibilities

The work captured here covers:

| Area | Where it lives |
|---|---|
| Requirements and clinical context | `DATAelixAIr_V4_MASTER_CONTEXT.md`, `docs/system-architecture.md` §2 |
| System architecture | `ARCHITECTURE.md`, `architecture/V4_ARCHITECTURE.md`, `docs/system-architecture.md` |
| Data flow and lifecycle | `docs/data-flow.md` |
| Validation and data quality | `validation/`, `docs/validation-framework.md` |
| Governance, audit and access control | `docs/governance-compliance.md`, `supabase/` (RLS policies) |
| Inter-module contracts | `contracts/SYSTEM_CONTRACTS.md` |
| Traceability and observability | `docs/governance-compliance.md` §4 |

---

## 3. System Architecture (Summary)

The platform runs as a strict linear pipeline. There are no parallel scoring engines and nothing is allowed to mutate a decision after it has been finalised. Each stage has a defined input contract, a defined output contract and a defined failure mode.

```
Input  →  Canonicalisation  →  Context Builder  →  Question Engine
       →  Reasoning (DDX)   →  Cognitive Layer  →  Completeness Layer
       →  Confidence Engine →  Safety Layer     →  Authority Layer (SSAL)
       →  Explainability    →  Output
```

Full layer-by-layer description: [`docs/system-architecture.md`](docs/system-architecture.md).

---

## 4. Data Workflow (Summary)

```
Input  →  Normalisation  →  Validation  →  Canonical Mapping
       →  Structured Context  →  Reasoning  →  Authority Decision
       →  Persistence (audit + clinical record)  →  Output to clinician
```

End-to-end lifecycle, transformations, persistence boundaries and exception handling are in [`docs/data-flow.md`](docs/data-flow.md).

---

## 5. Validation and Governance

- **Validation framework.** Declarative scenarios in `validation/VALIDATION_SUITE.json`, a pre-implementation checklist in `validation/VALIDATION_FIREWALL.md`, and an executable suite under `src/services/validation_suite/`. See [`docs/validation-framework.md`](docs/validation-framework.md).
- **Governance.** Role-based access control, server-side audit logging, tenant isolation through Row Level Security, and an immutable AI decision ledger. See [`docs/governance-compliance.md`](docs/governance-compliance.md).

Architecture and data-flow diagrams live alongside the docs (or under `assets/` when published as images); the text versions in `docs/` are kept authoritative.

---

## 6. Repository Structure

```
.
├── README.md
├── ARCHITECTURE.md                    Detailed 10-layer architecture reference
├── DATAelixAIr_V4_MASTER_CONTEXT.md   Product context and design intent
│
├── docs/                              Internal system documentation
│   ├── system-architecture.md
│   ├── data-flow.md
│   ├── validation-framework.md
│   └── governance-compliance.md
│
├── architecture/                      Locked architecture specifications
│   └── V4_ARCHITECTURE.md
│
├── contracts/                         Inter-module data and pipeline contracts
│   └── SYSTEM_CONTRACTS.md
│
├── validation/                        Validation framework artefacts
│   ├── VALIDATION_FIREWALL.md
│   └── VALIDATION_SUITE.json
│
├── canonical/                         Canonical terminology mappings
│   └── mappings.ts
│
├── features/                          Feature specification template
│   └── FEATURE_SPEC_TEMPLATE.md
│
├── src/                               Working implementation (TypeScript)
│   ├── services/                      Pipeline layers (canonical, reasoning, safety, …)
│   ├── layers/                        Cross-cutting layer APIs
│   ├── lib/                           Shared utilities (e.g. clinical-context)
│   └── pages/, components/, hooks/    UI surface (under development)
│
├── supabase/                          Backend definition
│   ├── migrations/                    Schema migrations
│   └── functions/                     Server-side functions
│
└── tests/
    ├── cases/
    └── unit/
```

`archive/` and `traces/` retain legacy and runtime-trace material. They are not part of the active system documentation.

---

## 7. Project Status

| Area | Status |
|---|---|
| System architecture and contracts | Defined and documented |
| Canonical layer | Implemented (`src/services/canonical/`) |
| Reasoning, confidence, safety, authority layers | Implemented (`src/services/`) |
| Validation framework | Implemented and runnable |
| Backend (database, RLS, server functions) | Implemented (`supabase/`) |
| Frontend / clinical UI | Under active development |

---

## 8. Reading Order

If you are coming to the system fresh, the documentation is intended to be read in this order:

1. This `README.md`.
2. `docs/system-architecture.md` — what the system is and how it is organised.
3. `docs/data-flow.md` — how data moves through it.
4. `docs/validation-framework.md` — how data quality is enforced.
5. `docs/governance-compliance.md` — how the system is controlled, audited and made traceable.

The code under `src/` and `supabase/` exists as the working realisation of the design; the documents above describe the intent.

---

## My Contribution

This repository reflects my independent work on:

- Analysing healthcare data processing requirements and the operational constraints of primary-care clinics.
- Designing the system workflow, the layered architecture and the inter-module contracts.
- Defining the data validation and quality framework, including the pre-implementation gate and the regression suite.
- Structuring the governance and audit mechanisms, including the access model, tenant isolation and the AI decision ledger.
- Translating clinical and domain requirements into concrete system-level specifications and a working backend.
