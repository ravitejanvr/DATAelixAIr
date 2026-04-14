# V4 ARCHITECTURE — FINAL LOCKED

## Pipeline (Strict Linear — No Parallel Paths)

```
PATIENT INPUT (Voice / Text / File)
        ↓
INGESTION LAYER
  - Speech-to-text (multilingual)
  - Text normalization
  - File parsing
        ↓
CANONICALIZATION LAYER ← FOUNDATION
  - Language detection (EN/HI/TE/TA)
  - Synonym normalization (SINGLE unified map)
  - SNOMED CT mapping
  - Output: CanonicalFeature[] (language-agnostic)
        ↓
CONTEXT BUILDER (SSOT)
  - Structured clinical state
  - Symptoms as IDs, not strings
  - Vitals, history, labs
        ↓
QUESTION ENGINE (Interaction Loop)
  - Missing field detection
  - Symptom-protocol-driven questions
  - Minimum viable context gate
        ↓
DDX ENGINE (Candidate Generation)
  - Operates on canonical IDs only
  - No string matching
        ↓
V3 REASONING ENGINE (CORE — UNTOUCHED)
  - Preserved scoring logic
  - Structured inputs only
        ↓
COGNITIVE LAYER (Plug-in — Non-dominant)
  1. Hypothesis Expander (must-not-miss)
  2. Counterfactual Reasoning
  3. Evidence Gap Detector
  ⚠️ Cannot override V3
        ↓
COMPLETENESS LAYER (Safety Critical)
  - Red flag detection (canonical ID combos)
  - Missing tests identification
  - Required questions
        ↓
CONFIDENCE ENGINE (Uncertainty Model)
  - Shannon entropy of DDX spread
  - Data sufficiency scoring
  - Conflict detection
        ↓
SAFETY LAYER
  - High-risk condition detection
  - Vital-sign triggers
  - Escalation flags
        ↓
AUTHORITY LAYER (Final Decision)
  - V3 output + Safety + Confidence + Cognitive
  - Resolution: V3 → Safety → Confidence → Rank
  - REPLACES: score fusion, systemic override, shadow engines
        ↓
SSAL (Finalization — FROZEN)
  - Object.freeze()
  - No mutation beyond this point
        ↓
EXPLAINABILITY LAYER
  - Why this diagnosis?
  - Why NOT others?
  - Contributing features
  - Confidence breakdown
        ↓
OUTPUT LAYER
  - Text / Voice / Structured Report
```

## Module Structure

```
src/services/
  canonical/          ← SINGLE synonym map, language detection
    types.ts
    normalizer.ts
    index.ts
  pipeline/           ← Master orchestrator + unified types
    types.ts
    index.ts
  question_engine/    ← Dynamic follow-up questions
    index.ts
  cognitive/          ← Non-dominant intelligence plug-ins
    v4_cognitive.ts
  completeness/       ← Safety-critical omission checks
    index.ts
  confidence/         ← Uncertainty model
    index.ts
  safety/             ← High-risk detection + vital triggers
    index.ts
  authority/          ← Final decision maker → SSAL
    index.ts
```

## Rules

- Single source of truth: SSAL
- No legacy engines
- No string-based logic
- No hidden state mutations
- No parallel pipelines
- No post-SSAL modification
- Deterministic: same input → same output

## Contracts

1. **Canonical Contract**: Zero raw strings in reasoning layer
2. **Pipeline Contract**: Strict linear flow, no layer skipping
3. **Determinism Contract**: Identical inputs → identical outputs
4. **Authority Contract**: SSAL is final, immutable
5. **Explainability Contract**: Explanation = computation
6. **Traceability Contract**: Every run logs canonical mapping + states + scores
