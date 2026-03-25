# BASELINE SNAPSHOT — Pre-Realignment (2026-03-25)

## 1. Production Execution Path

```
Clinical.tsx
  → buildClinicalContext(patient, vitals, intake)           [lib/clinical-context.ts:91]
  → buildFullClinicalContext(base, UIOverrides)              [lib/clinical-context.ts:168]
  → runUnifiedClinicalPipeline({ clinical_context, ... })    [orchestrator.ts:419]
    → Wave 0: PCIE fetch → MUTATES ctx via (cc as any)       [orchestrator.ts:500-520]
    → Wave 1: buildEnrichedContext(ctx)                       [orchestrator.ts:584]
    → Wave 1.5: runMetaReasoning(flat extracted)              [orchestrator.ts:641]
    → Wave 1.8: episodicMemory → MUTATES ctx.risk_flags       [orchestrator.ts:691-703]
    → Wave 2a: generatePhysiologicalContext(flat)             [orchestrator.ts:736]
    → Wave 2b: runDDXEngine(FLAT PAYLOAD)                     [orchestrator.ts:780-798]
    → Wave 2b+: Evidence, Hypothesis Testing, Causal          [orchestrator.ts:~850+]
    → Wave 3: Bayesian + Guidelines + Hypotheses              [orchestrator.ts:~950+]
    → Wave 3.5: Conflict Resolution                           [orchestrator.ts:~1100+]
    → Wave 3.6: Diagnostic Loop                               [orchestrator.ts:~1200+]
    → Wave 4: Safety Evaluation (Oversight Engine)            [orchestrator.ts:~1400+]
    → Wave 5: Uncertainty + SOAP                              [orchestrator.ts:~1500+]
    → Wave 6: Cognitive Layer (fire-and-forget)               [orchestrator.ts:~1700+]
```

## 2. DDX Input Schema (Production — orchestrator.ts:780-798)

```typescript
runDDXEngine({
  symptoms: string[],                    // extractSymptoms(ctx) — flat array
  vitals: {
    temperature: number | null,
    spo2: number | null,
    pulse: number | null,
    bp: string | undefined,             // "120/80" format
  },
  age: number | null,                   // ctx.patient_age
  sex: string | null,                   // ctx.patient_sex
  medical_history: string[],            // ctx.medical_history
  current_medications: string[],        // ctx.current_medications
  allergies: string[],                  // ctx.allergies
  visit_id: string | null,
  clinic_id: string | null,
  physiological_context: {              // from Wave 2a physiology engine
    candidate_diagnosis_ids: string[],
    affected_systems: string[],
    physiological_states: Array<{ state: string; confidence: number; system: string }>,
  } | undefined,
  onset_pattern: string | null,         // (ctx as any).onset_pattern
  severity: string | null,             // (ctx as any).severity
  body_location: string | null,        // (ctx as any).body_location
  risk_factors: string[],              // ctx.risk_factors
  duration: string | null,             // ctx.symptom_duration
  family_history: string[],            // (ctx as any).family_history
})
```

## 3. Context Mutation Sites (as any)

### Wave 0 — PCIE Hydration (orchestrator.ts:501-520)
- `(cc as any).chief_complaint = unifiedContext.chief_complaint`
- `(cc as any).medical_history = unifiedContext.medical_history`
- `(cc as any).allergies = unifiedContext.allergies`
- `(cc as any).current_medications = unifiedContext.current_medications`
- `(cc as any).risk_factors = unifiedContext.risk_factors`
- `(cc as any).family_history = unifiedContext.family_history`

NOTE: chief_complaint, medical_history, allergies, current_medications are ALREADY on ClinicalContext type.
These use `as any` unnecessarily — they can be assigned directly.

### Wave 1.8 — Episodic Memory (orchestrator.ts:691-703)
- `(ctx as any).risk_flags = [...existing, ...longitudinal_risk_signals]`
- `(ctx as any).risk_flags = [...existing, ...seasonal_alerts]`

NOTE: risk_flags IS on ClinicalContext (optional). Can be assigned directly.

### DDX Invocation (orchestrator.ts:792-797) — READ ONLY
- `(ctx as any).onset_pattern` — reads field not on type
- `(ctx as any).severity` — reads field not on type
- `(ctx as any).body_location` — reads field not on type
- `(ctx as any).family_history` — reads field not on type

NOTE: onset_pattern, severity, body_location, family_history ARE on ClinicalContext (optional).
These `as any` casts are UNNECESSARY — the fields exist on the type.

### Other reads throughout:
- `(ctx as any).patient_id` — NOT on ClinicalContext (used for episodic memory)
- `(ctx as any).doctor_id` — NOT on ClinicalContext (used for episodic memory)

## 4. ClinicalContext Type — Current vs Required

### Already on type (as optional):
- `symptoms?: string[]`
- `associated_symptoms?: string[]`
- `risk_flags?: string[]`
- `risk_factors?: string[]`
- `onset_pattern?: string`
- `severity?: string`
- `body_location?: string`
- `blood_sugar?: number | null`
- `family_history?: string[]`
- `exam_findings?: string[]`

### Missing from type (used via as any):
- `patient_id?: string | null` — needed by episodic memory
- `doctor_id?: string | null` — needed by episodic memory

### Unnecessary `as any` casts (field exists on type):
The majority of the 199 `as any` casts are reading/writing fields that
ALREADY EXIST on `ClinicalContext`. They are unnecessary and can be removed.

## 5. Benchmark Paths (v9/v10 — NOT through orchestrator)

### v9 (runner.ts):
```
BenchmarkCase → normalizeWithTrace() → [Physiology || DDX] → Bayesian → Cognitive → Safety
```
- Calls runDDXEngine() DIRECTLY with flat payload
- Does NOT use orchestrator
- Does NOT use buildClinicalContext/buildFullClinicalContext
- Has own SYNONYM_MAP (80 entries)
- Has own SAFETY_CLUSTERS (8 clusters)

### v10 (runner.ts):
```
BenchmarkCaseV10 → mapCaseToDDXInput() → runDDXEngine()
```
- Calls runDDXEngine() DIRECTLY with flat payload
- Does NOT use orchestrator
- Does NOT use Physiology, Bayesian, Cognitive, or Wave 3+ logic
- Has own SYNONYM_MAP (69 entries, DIVERGENT from v9)

## 6. System Health Check Definition

A valid system health check = sending this test payload through production path:
```typescript
buildFullClinicalContext(
  buildClinicalContext(
    { age: 45, gender: "male", medical_history: [], allergies: [], current_medications: [] },
    { bp_systolic: 130, bp_diastolic: 85, pulse: 88, temperature: 38.5, spo2: 96, respiratory_rate: 20, weight_kg: 75, height_cm: 170 },
    { chief_complaint: "Fever and cough for 3 days" }
  ),
  { symptoms: ["Fever", "Cough", "Body ache"], duration: "3 days", severity: "Moderate" }
)
```

Expected: DDX returns diagnoses, no runtime errors, pipeline completes all waves.
