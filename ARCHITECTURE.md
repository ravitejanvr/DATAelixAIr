# DATAelixAIr — System Architecture

## 10-Layer Clinical AI Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: User Interface Layer                               │
│  Marketing site, Clinical workspace, Platform admin, Auth    │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: Clinical Workflow Layer                            │
│  Patient intake, Vitals, Visit tracker, Billing, Prescriptions│
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Multilingual Processing Layer                      │
│  Transcript stabilization, Regional lexicon, Translation     │
├──────────────────────────────────────────────────────────────┤
│  Layer 4: AI Agent Layer                                     │
│  Clinical agent, SOAP generation, Patient data extraction    │
├──────────────────────────────────────────────────────────────┤
│  Layer 5: Safety Controller Layer                            │
│  RxNorm normalization, Drug interactions, Allergy detection  │
├──────────────────────────────────────────────────────────────┤
│  Layer 6: Evidence Retrieval Layer (RAG)                     │
│  PubMed search, Evidence agents, Clinical guidelines         │
├──────────────────────────────────────────────────────────────┤
│  Layer 7: Learning Layer                                     │
│  Doctor favorites, Regional lexicon updates (future: feedback)│
├──────────────────────────────────────────────────────────────┤
│  Layer 8: Continuous Monitoring Layer                         │
│  Audit logs, Usage metrics, Visit tracking analytics         │
├──────────────────────────────────────────────────────────────┤
│  Layer 9: Governance Layer                                   │
│  Pilot approval, Clinic management, Role-based access control│
├──────────────────────────────────────────────────────────────┤
│  Layer 10: Infrastructure & Security Layer                   │
│  Supabase client, RLS policies, Auth context, Consent mgmt  │
└──────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── layers/
│   ├── ui/                          # Layer 1: User Interface
│   │   ├── marketing/               # Landing, Vision, Blog, Privacy, Terms, Contact
│   │   ├── clinical/                # Dashboard, Clinical workspace, ConsultationDetail
│   │   ├── admin/                   # PlatformAdmin
│   │   ├── patient/                 # PatientPortal
│   │   ├── auth/                    # Auth, Onboard, AwaitingApproval, Unauthorized
│   │   └── layouts/                 # Layout, ClinicalLayout, PlatformAdminLayout
│   │
│   ├── workflow/                    # Layer 2: Clinical Workflow
│   │   ├── intake/                  # Patient registration (Patients page)
│   │   ├── vitals/                  # Vitals station
│   │   ├── visit-tracker/           # Live visit tracker
│   │   ├── prescriptions/           # Prescription management
│   │   └── billing/                 # Invoice generation
│   │
│   ├── multilingual/                # Layer 3: Multilingual Processing
│   │   ├── stabilize-transcript/    # Edge function: stabilize-transcript
│   │   ├── translate-clinical/      # Edge function: translate-clinical
│   │   ├── translate-report/        # Edge function: translate-report
│   │   └── patient-explanation/     # Edge function: patient-explanation
│   │
│   ├── ai-agents/                   # Layer 4: AI Agent Layer
│   │   ├── clinical-agent/          # Edge function: clinical-agent
│   │   ├── clinical-soap/           # Edge function: clinical-soap
│   │   └── extract-patient-data/    # Edge function: extract-patient-data
│   │
│   ├── safety/                      # Layer 5: Safety Controller
│   │   └── clinical-safety/         # Edge function: clinical-safety
│   │
│   ├── evidence/                    # Layer 6: Evidence Retrieval (RAG)
│   │   ├── pubmed-search/           # Edge function: pubmed-search
│   │   └── evidence-agents/         # Edge function: evidence-agents
│   │
│   ├── learning/                    # Layer 7: Learning Layer
│   │   └── doctor-favorites/        # Doctor prescription favorites
│   │
│   ├── monitoring/                  # Layer 8: Continuous Monitoring
│   │   ├── audit/                   # Audit logs
│   │   └── metrics/                 # Usage metrics
│   │
│   ├── governance/                  # Layer 9: Governance
│   │   ├── pilot-approval/          # Pilot request flow
│   │   ├── clinic-management/       # Clinic CRUD + workflow config
│   │   └── rbac/                    # Role-based access control
│   │
│   └── infrastructure/              # Layer 10: Infrastructure & Security
│       ├── auth/                    # AuthContext, session management
│       ├── consent/                 # Cookie consent
│       └── supabase/                # Client, types (auto-generated)
│
├── shared/                          # Cross-layer shared utilities
│   ├── types/                       # Shared TypeScript interfaces
│   ├── hooks/                       # Shared React hooks
│   ├── ui/                          # shadcn/ui components
│   └── utils/                       # Utility functions
│
└── assets/                          # Static assets
```

## Layer Interactions

### Data Flow: Clinical Consultation

```
Voice Input (Layer 1: UI)
    │
    ▼
Transcript Stabilization (Layer 3: Multilingual)
    │
    ▼
Doctor Review & Confirmation (Layer 1: UI)
    │
    ▼
Structured Extraction (Layer 4: AI Agents)
    │
    ▼
Safety Controller (Layer 5: Safety)
    │ ├── RxNorm Normalization
    │ ├── Drug Interaction Check
    │ ├── Allergy Detection
    │ └── Dose Sanity Rules
    │
    ▼
SOAP Generation (Layer 4: AI Agents)
    │
    ▼
Evidence Retrieval [optional] (Layer 6: RAG)
    │ ├── PubMed/EuropePMC
    │ ├── OpenFDA Safety
    │ └── Clinical Guidelines
    │
    ▼
Doctor Review & Save (Layer 1: UI)
    │
    ├── Audit Log (Layer 8: Monitoring)
    ├── Translation [optional] (Layer 3: Multilingual)
    └── Learning Update (Layer 7: Learning)
```

### Data Flow: Patient Journey

```
Patient Registration (Layer 2: Workflow/Intake)
    │
    ▼
Visit Check-in (Layer 2: Workflow/Visit Tracker)
    │
    ├── Vitals Recording (Layer 2: Workflow/Vitals)
    │       └── Instant doctor visibility
    │
    ├── Doctor Consultation (Layer 1: UI/Clinical + Layers 3-6)
    │
    ├── Prescription (Layer 2: Workflow/Prescriptions)
    │       └── Safety check (Layer 5)
    │
    └── Billing (Layer 2: Workflow/Billing)
            └── Invoice generation
```

### Access Control Flow

```
Auth Request (Layer 10: Infrastructure)
    │
    ▼
Role Resolution (Layer 9: Governance/RBAC)
    │
    ├── platform_admin → Platform Admin (Layer 1: UI/Admin)
    ├── clinic_admin   → Dashboard (Layer 1: UI/Clinical)
    ├── doctor         → Dashboard (Layer 1: UI/Clinical)
    ├── nurse          → Vitals (Layer 2: Workflow/Vitals)
    ├── receptionist   → Dashboard (Layer 1: UI/Clinical)
    ├── pharmacist     → Prescriptions (Layer 2: Workflow/Prescriptions)
    └── patient        → Patient Portal (Layer 1: UI/Patient)
```

## Database Schema: Visit-Based Timeline Model

All clinical data attaches to a **visit** (patient_visits) rather than documents.

```
                        ┌──────────┐
                        │  clinics │
                        └────┬─────┘
                             │ clinic_id (on every table)
          ┌──────────────────┼──────────────────────┐
          │                  │                       │
    ┌─────┴─────┐    ┌──────┴───────┐       ┌───────┴───────┐
    │ profiles   │    │  patients    │       │ pilot_requests│
    │ (users)    │    │              │       └───────────────┘
    └────────────┘    └──────┬───────┘
                             │ patient_id
                     ┌───────┴───────┐
                     │ patient_visits│  ← CENTRAL ENTITY
                     │   (visits)    │
                     └───────┬───────┘
                             │ visit_id
          ┌──────────┬───────┼───────┬──────────┐
          │          │       │       │          │
    ┌─────┴────┐ ┌───┴───┐ ┌┴─────┐ ┌┴────────┐┌┴──────────┐
    │consult-  │ │vitals │ │Rx    │ │invoices ││lab_orders │
    │ations    │ │       │ │      │ │         ││           │
    │(clinical │ └───────┘ └──────┘ └─────────┘└─────┬─────┘
    │ notes)   │                                     │
    └──────────┘                               ┌─────┴─────┐
                                               │lab_results│
                                               └───────────┘
```

### Core Entities

| Entity | Table | Key Relationships |
|--------|-------|-------------------|
| Clinic | `clinics` | Top-level tenant; all tables reference `clinic_id` |
| User | `profiles` + `user_roles` | `user_id` → auth.users; `clinic_id` → clinics |
| Patient | `patients` | `doctor_id`, `clinic_id`, `patient_user_id` |
| Visit | `patient_visits` | `patient_id`, `clinic_id`; central timeline entity |
| Clinical Notes | `consultations` | `visit_id`, `patient_id`, `doctor_id`, `clinic_id` |
| Vitals | `vitals` | `visit_id`, `patient_id`, `clinic_id`, `recorded_by` |
| Prescriptions | `prescriptions` | `visit_id`, `consultation_id`, `patient_id`, `clinic_id` |
| Lab Orders | `lab_orders` | `visit_id`, `patient_id`, `clinic_id`, `doctor_id` |
| Lab Results | `lab_results` | `lab_order_id`, `visit_id`, `patient_id`, `clinic_id` |
| Invoices | `invoices` | `visit_id`, `patient_id`, `clinic_id`, `consultation_id` |
| Audit Logs | `audit_logs` | `actor_id`, `event_type`, `target_type`, `target_id` |

### Performance Indexes

All foreign key columns and frequently queried columns are indexed:
- `patient_visits`: clinic_id, patient_id, status, check_in_time DESC
- `consultations`: visit_id, patient_id, doctor_id, clinic_id, status, created_at DESC
- `prescriptions`: visit_id, patient_id, consultation_id, clinic_id
- `vitals`: visit_id, patient_id, clinic_id, created_at DESC
- `lab_orders`: visit_id, patient_id, clinic_id, doctor_id, status
- `lab_results`: lab_order_id, visit_id, patient_id
- `patients`: clinic_id, doctor_id, phone, patient_user_id
- `audit_logs`: actor_id, event_type, created_at DESC

### Visit-Based Query Pattern

```sql
-- Get complete clinical timeline for a patient visit
SELECT v.*, 
  c.soap_subjective, c.soap_objective, c.soap_assessment, c.soap_plan,
  vt.bp_systolic, vt.bp_diastolic, vt.pulse,
  p.drug_name, p.dosage,
  lo.test_name, lo.status as lab_status
FROM patient_visits v
LEFT JOIN consultations c ON c.visit_id = v.id
LEFT JOIN vitals vt ON vt.visit_id = v.id
LEFT JOIN prescriptions p ON p.visit_id = v.id
LEFT JOIN lab_orders lo ON lo.visit_id = v.id
WHERE v.patient_id = $1 AND v.clinic_id = $2
ORDER BY v.check_in_time DESC;
```

## Multi-Clinic SaaS Isolation

Every clinical table includes a mandatory `clinic_id` column.
RLS policies enforce: `clinic_id = (SELECT clinic_id FROM profiles WHERE user_id = auth.uid())`

```
Clinic A ──┐
            ├── Shared Infrastructure (Layer 10)
Clinic B ──┤   ├── Auth (shared)
            │   ├── Supabase (shared)
Clinic C ──┘   └── RLS Isolation (per clinic_id)
                    ├── patients
                    ├── patient_visits
                    ├── consultations
                    ├── prescriptions
                    ├── vitals
                    ├── lab_orders
                    ├── lab_results
                    └── invoices
```

## Design Principles

1. **Patient Safety First**: Safety Controller (Layer 5) is mandatory before any clinical output
2. **Human-in-the-Loop**: Every AI output requires doctor review before persistence
3. **Auditability**: All mutations logged via Layer 8 monitoring
4. **Clinic Isolation**: RLS + clinic_id on every clinical table
5. **Minimal PHI**: Only Name, Age, Gender, Phone stored
6. **Layer Independence**: Each layer can evolve without affecting others
7. **Conservative AI**: No autonomous clinical decisions, no hallucinated citations

## Edge Functions by Layer

| Layer | Edge Function | Purpose |
|-------|--------------|---------|
| 3 - Multilingual | stabilize-transcript | Clean up raw transcripts |
| 3 - Multilingual | translate-clinical | Medical text translation |
| 3 - Multilingual | translate-report | Report translation (Hindi/Telugu) |
| 3 - Multilingual | patient-explanation | Patient-friendly summaries |
| 4 - AI Agents | clinical-agent | RAG clinical assessment |
| 4 - AI Agents | clinical-soap | SOAP note generation |
| 4 - AI Agents | extract-patient-data | Structured clinical extraction |
| 5 - Safety | clinical-safety | Drug safety validation |
| 6 - Evidence | pubmed-search | PubMed article search |
| 6 - Evidence | evidence-agents | Multi-source evidence retrieval |
| 10 - Infrastructure | elevenlabs-scribe-token | Audio transcription token |
| 10 - Infrastructure | air-quality | Environmental health data |
| 10 - Infrastructure | places-search | Clinic location search |
