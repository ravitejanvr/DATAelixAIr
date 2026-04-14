# TERMINOLOGY COVERAGE & BIAS AUDIT — DATAelixAIr V4

**Date:** 2026-04-14  
**Severity:** MEDIUM — System is generalized but has two systematic gaps

---

## PHASE 1 — COVERAGE TEST RESULTS

| Concept | Total Variants | Recognized | Coverage | Consistent | Failures |
|---------|---------------|-----------|----------|-----------|----------|
| Fever | 15 | 12 | **0.80** | ✅ All → FEVER | బుఖార్, జ్వరం, बुखार |
| Cough | 10 | 10 | **1.00** | ⚠️ 3 targets* | None |
| Chest Pain | 9 | 8 | **0.89** | ✅ All → CHEST_PAIN | सीने में दर्द |
| Abdominal Pain | 9 | 8 | **0.89** | ✅ All → ABDOMINAL_PAIN | पेट दर्द |
| Shortness of Breath | 10 | 9 | **0.90** | ✅ All → DYSPNEA | सांस की तकलीफ |
| Vomiting | 7 | 6 | **0.86** | ✅ All → VOMITING | उल्टी |
| Headache | 7 | 6 | **0.86** | ✅ All → HEADACHE | सिर दर्द |
| Dizziness | 8 | 7 | **0.88** | ✅ All → DIZZINESS | चक्कर |
| Weakness | 6 | 5 | **0.83** | ✅ All → WEAKNESS | कमज़ोरी |
| Diarrhea | 8 | 7 | **0.88** | ✅ All → DIARRHEA | दस्त |

*Cough correctly maps "productive cough" → PRODUCTIVE_COUGH, "dry cough" → DRY_COUGH. This is clinically correct differentiation, not a bug.

### KEY FINDING: Failures are 100% Devanagari/Telugu script inputs

Every single failure is a **native script** input (Hindi Devanagari or Telugu). Romanized Hinglish ("bukhar", "pet dard", "chakkar") works perfectly. This is a **systematic gap**, not a term-specific patch.

---

## PHASE 2 — TERM-SPECIFIC HACK DETECTION

### String-based `.includes()` calls in pipeline (11 occurrences)

| File | Line | Pattern | Risk | Context |
|------|------|---------|------|---------|
| `evidenceEngine.ts` | 84 | `n.includes("sepsis")` | **HIGH** | Diagnosis classification — systemic category |
| `evidenceEngine.ts` | 84 | `n.includes("septic")` | **HIGH** | Same block |
| `evidenceEngine.ts` | 84 | `n.includes("sirs")` | **HIGH** | Same block |
| `evidenceEngine.ts` | 85 | `n.includes("myocardial")` | **HIGH** | Cardiac classification |
| `evidenceEngine.ts` | 85 | `n.includes("coronary")` | **HIGH** | Cardiac classification |
| `evidenceEngine.ts` | 85 | `n.includes("heart failure")` | **HIGH** | Cardiac classification |
| `evidenceEngine.ts` | 86 | `n.includes("pneumonia")` | **HIGH** | Infection classification |
| `evidenceEngine.ts` | 87 | `n.includes("pulmonary embolism")` | **HIGH** | PE classification |
| `candidate_fallback.ts` | 215 | `m.includes("lithium")` | **MEDIUM** | Medication signal injection |
| `candidate_fallback_v2.ts` | 212 | `m.includes("lithium")` | **MEDIUM** | Duplicate of above |
| `meta_reasoning/index.ts` | 322-339 | Multiple `.includes()` | **LOW** | Not in core pipeline path |

### Assessment: These are **DIAGNOSIS-LEVEL** string matches, not symptom-level

These `.includes()` calls operate on **diagnosis names** (e.g., "acute myocardial infarction"), not on patient symptom inputs. They classify diagnoses into categories for evidence weighting. While still not ideal, they are:
- Operating on system-generated diagnosis names (from KG), not raw patient input
- Used for broad category classification, not exact matching
- Protected by Set lookups as primary check (`.includes()` is fallback)

**Risk level: MEDIUM** — Should be replaced with a diagnosis classification ontology, but not an immediate safety hazard since diagnosis names come from the knowledge graph, not from patient input.

---

## PHASE 3 — VOCABULARY COVERAGE SCORES

| Concept | Coverage | Risk Level |
|---------|----------|-----------|
| Cough | 1.00 | ✅ NONE |
| Shortness of Breath | 0.90 | ✅ LOW |
| Chest Pain | 0.89 | ✅ LOW |
| Abdominal Pain | 0.89 | ✅ LOW |
| Dizziness | 0.88 | ✅ LOW |
| Diarrhea | 0.88 | ✅ LOW |
| Vomiting | 0.86 | ✅ LOW |
| Headache | 0.86 | ✅ LOW |
| Weakness | 0.83 | ⚠️ LOW-MEDIUM |
| Fever | 0.80 | ⚠️ MEDIUM |

**Average coverage: 0.88** — GOOD for romanized inputs, but 0% for native Devanagari/Telugu script.

---

## PHASE 4 — SYSTEMIC RISK ANALYSIS

### Risk 1: Native Script Gap (HIGH)
- **All 10 concepts** fail on Devanagari (Hindi) script inputs
- **All tested concepts** fail on Telugu script inputs  
- Romanized Hinglish works perfectly (bukhar, pet dard, chakkar, etc.)
- **Impact:** Any patient or clinician typing in native Hindi/Telugu script will have symptoms silently dropped

### Risk 2: Diagnosis Classification Fragility (MEDIUM)
- `evidenceEngine.ts` classifies diagnoses using 13 hardcoded `.includes()` patterns
- If a diagnosis name from KG doesn't contain these substrings, it won't get proper evidence weighting
- Example: "AMI" won't match `n.includes("myocardial")` — but it IS in the `CARDIAC_DIAGNOSES` Set

### Risk 3: No Single-Keyword-Only Concepts (LOW)
- Every concept has at least 5 recognized variants
- No concept relies on a single keyword — this is GOOD

---

## PHASE 5 — ROOT CAUSE ANALYSIS

### Why native script fails:
1. The canonical normalizer's `SYNONYM_INDEX` contains only **romanized** entries
2. No Devanagari synonyms (बुखार, पेट दर्द, etc.) are in the CANONICAL_MAP
3. No Telugu synonyms (జ్వరం, etc.) are in the CANONICAL_MAP
4. The `detectLanguage()` function correctly detects Hindi/Telugu script, but the `CODE_MIXED_MAP` only handles **romanized** Hinglish, not native script
5. The system was designed for **voice input** (ElevenLabs STT outputs romanized text), so native script was never needed — but text input from clinicians could include it

### Why diagnosis classification uses strings:
- Historical V3 design — diagnosis names come from KG as strings
- No diagnosis-level canonical ID system exists (only symptom-level)
- The Set-based lookup is the primary mechanism; `.includes()` is a safety net for variant names

---

## PHASE 6 — FIX STRATEGY

### Fix 1: Add Native Script Synonyms to Canonical Map (LOW EFFORT, HIGH IMPACT)
Add Devanagari and Telugu entries to existing CANONICAL_MAP entries:
```
FEVER: { synonyms: [...existing, "बुखार", "జ్వరం", "காய்ச்சல்"] }
```
This requires ~100 additions across 10 core concepts. No architectural change needed.

### Fix 2: Diagnosis Classification Ontology (MEDIUM EFFORT)
Replace `.includes()` diagnosis classification with a structured lookup:
```typescript
const DIAGNOSIS_CATEGORIES: Record<string, DiagnosisCategory> = {
  "sepsis": { systemic: true, infection: true },
  "acute myocardial infarction": { cardiac: true },
  // ...mapped from KG
};
```

### Fix 3: DO NOT add more `.includes()` checks
The canonical normalizer architecture is correct. The gap is data (missing synonyms), not logic.

---

## VERDICT

| Metric | Score |
|--------|-------|
| Generalization | ✅ **GOOD** — All concepts handled uniformly via canonical normalizer |
| Term-specific patches | ⚠️ **11 diagnosis-level** `.includes()` (not symptom-level) |
| Romanized multilingual | ✅ **GOOD** — Hinglish works for all 10 concepts |
| Native script | ❌ **MISSING** — 0% coverage for Devanagari/Telugu |
| Consistency | ✅ **GOOD** — All variants map to same canonical ID |
| Architecture | ✅ **CORRECT** — Single normalizer, no term-specific branching |

**The system is NOT fever-biased.** It is uniformly generalized across all clinical terms. The gaps are:
1. Native Indic script synonyms (data gap, not architectural)
2. Diagnosis-level string matching in evidence engine (design debt)
