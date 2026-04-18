# DATAelixAIr — Clinical AI Systems & Data Governance Repository

**Author / Role:** AI Healthcare Systems & Data Governance Lead
**Repository purpose:** Structured demonstration of systems analysis, data workflow design, validation engineering, and governance thinking applied to a multilingual clinical decision-support platform.

---

## 1. Project Overview

DATAelixAIr is a clinical productivity assistant intended for use by primary-care practitioners. It converts unstructured clinical input (typed text, voice, uploaded documents) into a structured, auditable clinical reasoning trace, and produces explainable diagnostic, investigation and prescription suggestions for clinician review.

This repository is published as a **systems portfolio**. It is not a marketing site and is not intended to demonstrate UI craft. The objective is to make the **architecture, data flow, validation logic and governance posture** legible to a non-technical reviewer assessing professional capability.

The repository contains:

- A formally specified **layered architecture** (10 layers, documented in `ARCHITECTURE.md` and `docs/system-architecture.md`).
- A set of **system contracts** that constrain how data may flow between layers (`contracts/SYSTEM_CONTRACTS.md`).
- A **validation framework** with declarative test scenarios and a validation firewall checklist (`validation/`).
- A working **TypeScript implementation** of the canonical, reasoning, safety, confidence and authority layers (`src/services/`).
- A **backend definition** (database schema, edge functions and migrations) under `supabase/`.

The user interface is currently under active development and is intentionally **not** the focus of this repository.

---

## 2. Defined Role and Scope of Work

The work in this repository corresponds to the following ICT Business Analyst responsibilities:

| Responsibility | Where it is evidenced |
|---|---|
| Requirements capture and stakeholder context | `DATAelixAIr_V4_MASTER_CONTEXT.md`, `docs/system-architecture.md` §2 |
| System architecture design | `ARCHITECTURE.md`, `architecture/V4_ARCHITECTURE.md`, `docs/system-architecture.md` |
| Data flow and lifecycle modelling | `docs/data-flow.md` |
| Data validation and quality assurance design | `validation/`, `docs/validation-framework.md` |
| Governance, auditability and compliance design | `docs/governance-compliance.md`, `supabase/` (RLS policies) |
| Contract-first / interface-first specification | `contracts/SYSTEM_CONTRACTS.md` |
| Traceability and observability design | `docs/governance-compliance.md` §4 |

---

## 3. System Architecture (Summary)

The platform is organised as a **strict linear pipeline** with no parallel scoring engines and no post-finalisation mutation. Each stage has a defined input contract, defined output contract, and defined failure mode.

```
Input  →  Canonicalisation  →  Context Builder  →  Question Engine
       →  Reasoning (DDX)   →  Cognitive Layer  →  Completeness Layer
       →  Confidence Engine →  Safety Layer     →  Authority Layer (SSAL)
       →  Explainability    →  Output
```

Two principles govern the design:

1. **Single Source of Truth** — the Authority Layer produces a frozen `SSAL` object that downstream consumers must not modify.
2. **Canonical-only reasoning** — raw user strings are forbidden beyond the ingestion boundary; the reasoning layer operates exclusively on canonical IDs (e.g. SNOMED-aligned identifiers).

A complete description of layers, components and interactions is in [`docs/system-architecture.md`](docs/system-architecture.md).

---

## 4. Data Workflow (Summary)

```
Input  →  Normalisation  →  Validation  →  Canonical Mapping
       →  Structured Context  →  Reasoning  →  Authority Decision
       →  Persistence (audit + clinical record)  →  Output to clinician
```

End-to-end data lifecycle, transformation steps, persistence boundaries and exception handling are documented in [`docs/data-flow.md`](docs/data-flow.md).

---

## 5. Validation and Governance Emphasis

- **Validation Framework** — Declarative scenarios in `validation/VALIDATION_SUITE.json`, a pre-implementation checklist in `validation/VALIDATION_FIREWALL.md`, and an executable suite under `src/services/validation_suite/`. See [`docs/validation-framework.md`](docs/validation-framework.md).
- **Governance & Compliance** — Role-based access control, server-side audit logging, tenant isolation via Row Level Security, and an immutable AI decision ledger. See [`docs/governance-compliance.md`](docs/governance-compliance.md).

---

## 6. Repository Structure

```
.
├── README.md                          ← This file
├── ARCHITECTURE.md                    ← Detailed 10-layer architecture reference
├── DATAelixAIr_V4_MASTER_CONTEXT.md   ← Product context and design intent
│
├── docs/                              ← Assessment-ready documentation suite
│   ├── system-architecture.md
│   ├── data-flow.md
│   ├── validation-framework.md
│   └── governance-compliance.md
│
├── architecture/                      ← Locked architecture specifications
│   └── V4_ARCHITECTURE.md
│
├── contracts/                         ← System-level data and pipeline contracts
│   └── SYSTEM_CONTRACTS.md
│
├── validation/                        ← Validation framework artefacts
│   ├── VALIDATION_FIREWALL.md         ← Pre-build validation checklist
│   └── VALIDATION_SUITE.json          ← Declarative test scenarios
│
├── canonical/                         ← Canonical terminology mappings
│   └── mappings.ts
│
├── features/                          ← Feature specification template
│   └── FEATURE_SPEC_TEMPLATE.md
│
├── src/                               ← Working implementation (TypeScript)
│   ├── services/                      ← Pipeline layers (canonical, reasoning, safety, …)
│   ├── layers/                        ← Cross-cutting layer APIs
│   ├── lib/                           ← Shared utilities (e.g. clinical-context)
│   └── pages/, components/, hooks/    ← UI surface (under development)
│
├── supabase/                          ← Backend definition
│   ├── migrations/                    ← Schema migrations (audit-controlled)
│   └── functions/                     ← Server-side functions
│
└── tests/                             ← Test cases and unit tests
    ├── cases/
    └── unit/
```

The folders `archive/` and `traces/` retain legacy and runtime-trace material. They are **not** required to understand the system and are excluded from the assessment narrative.

---

## 7. Project Status

| Area | Status |
|---|---|
| System architecture and contracts | Defined and documented |
| Canonical layer | Implemented (`src/services/canonical/`) |
| Reasoning, confidence, safety, authority layers | Implemented (`src/services/`) |
| Validation framework | Implemented and runnable |
| Backend (database, RLS, functions) | Implemented (`supabase/`) |
| Frontend / clinical UI | **Under active development — not in scope for this assessment** |

---

## 8. How to Read This Repository

A reviewer who is not a developer is encouraged to read in this order:

1. This `README.md`
2. `docs/system-architecture.md` — what the system is and how it is organised
3. `docs/data-flow.md` — how data moves through the system
4. `docs/validation-framework.md` — how data quality is enforced
5. `docs/governance-compliance.md` — how the system is controlled, audited and made traceable

Code under `src/` and `supabase/` is provided as evidence that the documented design is realised in working software, not as the primary artefact for review.
