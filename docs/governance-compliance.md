# Governance and Compliance

This document describes how the platform achieves auditability, data control, traceability and access governance.

---

## 1. Governance Posture

The platform treats clinical data and AI-assisted decisions as regulated artefacts. Three commitments shape every design decision:

1. **The clinician is always the final authority.** AI output is presented as assistance — reviewable, editable, overridable.
2. **Every action that touches clinical data is recorded.** The record is server-generated, append-only and tamper-resistant.
3. **Tenant data does not cross tenant boundaries.** Isolation is enforced in the database, not in the application layer.

These commitments exist because clinical environments need decisions to be reconstructable months or years after the fact, and because clinical data must never be visible to a clinic that did not create it.

---

## 2. Access Control Model

### 2.1 Role-Based Access Control (RBAC)

Roles are stored in a dedicated `user_roles` table, separate from the user or profile record. This separation is intentional: storing the role on the profile would allow a profile-mutation flaw to escalate privileges.

| Concern | Decision |
|---|---|
| Where roles are stored | Dedicated `user_roles` table. |
| Who may assign roles | Server-side functions only. New users receive a hard-coded default role via a database trigger. |
| How role checks are performed | Through a `SECURITY DEFINER` function (`has_role`) used inside Row Level Security policies. |
| What the client may assert | Nothing. The client never asserts role, clinic membership or ownership. |

### 2.2 Three-Layer Trust Architecture

| Layer | Purpose |
|---|---|
| Identity | Authenticated user identity (email or phone OTP, plus managed OAuth where applicable). |
| Clinic | Verified membership in a specific clinic; recorded server-side. |
| Role | Role within that clinic (clinician, administrator, platform admin). |

A request without all three is rejected.

---

## 3. Tenant Isolation

Tenant isolation is enforced through Row Level Security (RLS) on every clinical table. Policies scope reads and writes by `clinic_id` and validate the requesting user's membership through `has_role`.

| Mechanism | Purpose |
|---|---|
| `clinic_id` column on every clinical table | Provide a deterministic isolation key. |
| RLS policies on every clinical table | Enforce isolation in the database, not in application code. |
| Server-side functions for cross-cutting operations | Stop client code from assembling cross-tenant queries. |
| Realtime subscriptions scoped per clinic | Prevent cross-clinic event leakage. |

Even a fully compromised client cannot read another clinic's data, because the database itself refuses the query.

---

## 4. Auditability and Traceability

### 4.1 What is recorded

The platform maintains two append-only stores:

| Store | Purpose |
|---|---|
| `audit_logs` | Operational events: sign-in, role changes, data exports, configuration changes. |
| `ai_decision_ledger` | Every AI-assisted clinical output, the clinician's action on it, and the supporting evidence reference. |

### 4.2 What each AI ledger entry contains

- The AI output and its type (diagnosis, prescription, investigation).
- Confidence score and model version.
- The clinician's action (accepted, edited, overridden).
- The reason for any override.
- A reference to the supporting evidence or guideline.
- The safety status at the time of the decision.

### 4.3 Properties of the audit trail

- **Server-generated.** Clients cannot author audit entries directly.
- **Append-only.** Entries cannot be modified after creation.
- **Scoped.** Each entry is tied to a `clinic_id` and is governed by the same RLS policies as clinical data.
- **Reviewable.** Entries are queryable by governance roles for compliance review.

### 4.4 Reasoning Traceability

Beyond the audit ledger, every reasoning run records:

- The canonical mapping that was applied.
- The clinical states that were activated.
- The contribution of each feature to the final score.
- The final, frozen SSAL output.

This satisfies the Traceability Contract (`contracts/SYSTEM_CONTRACTS.md` §7) and supports incident investigation, model improvement and external review.

---

## 5. Data Control

| Concern | Control |
|---|---|
| Storage of clinical artefacts | Tenant-scoped buckets; ownership enforced server-side. |
| Public file access | Disallowed by default for clinical artefacts. |
| Configuration changes | Logged in `audit_logs`. |
| Model version pinning | Recorded on each AI ledger entry to support reproducibility. |
| Data export | Performed via controlled server-side functions; the export action is itself audited. |

---

## 6. AI Governance

The platform applies four explicit constraints to AI behaviour:

| Constraint | Implication |
|---|---|
| AI does not produce final diagnoses autonomously. | The clinician retains decision authority. |
| AI output is structured, not free-form. | Output can be parsed, validated and audited. |
| AI scoring cannot override the deterministic reasoning layer. | Determinism and explainability are preserved. |
| AI explanations must equal the underlying computation. | No post-hoc rationalisation of decisions. |

These constraints are codified in the Explainability Contract and the Authority Contract.

---

## 7. Compliance-Adjacent Practices

The platform is positioned as a clinical productivity assistant, not as a regulated medical device, at its current stage. The following practices are nonetheless adopted to keep regulatory pathways open:

- Server-side audit of all AI decisions and clinician actions.
- Immutable decision ledger that allows past consultations to be reconstructed.
- Tenant isolation suitable for multi-clinic deployment.
- Explicit model-version recording on every AI output.
- Bias-monitoring data structures (`bias_metrics`) to support fairness reviews.
- A pre-implementation governance gate (the Validation Firewall) to prevent unsafe features from being built in the first place.

---

## 8. Operational Ownership

| Function | Governance responsibility |
|---|---|
| Platform Administrator | Owns the role matrix, tenant configuration and audit access. |
| Clinic Administrator | Owns clinic-level configuration, member assignments and workflow controls. |
| Clinician | Reviews, accepts or overrides AI outputs; overrides are audited. |
| Compliance Reviewer | Reviews `audit_logs` and `ai_decision_ledger` entries; investigates anomalies. |
| Engineering | Implements and tests the controls described above. |

---

## 9. Summary

| Question | Answer |
|---|---|
| Can a user see another clinic's data? | No — enforced at the database via RLS. |
| Can a user elevate their own role? | No — roles live in a separate table written only by server-side logic. |
| Is every AI-assisted decision recorded? | Yes — `ai_decision_ledger`, append-only. |
| Is the reasoning behind a decision reconstructable later? | Yes — canonical mapping, activated states, contributions and SSAL are all stored. |
| Does the clinician retain authority? | Yes — by design and by contract. |
| Are configuration and access changes audited? | Yes — `audit_logs`. |
