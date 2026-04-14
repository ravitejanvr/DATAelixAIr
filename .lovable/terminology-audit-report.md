# TERMINOLOGY SYSTEM AUDIT — Complete Report

**Date:** 2026-04-14  
**Status:** CRITICAL — 10 duplicate synonym systems, 50 missing canonical concepts, 69+ string-based reasoning leaks

---

## PHASE 1 — DISCOVERY

### A. Synonym Systems Found (10 total)

| # | File | Type | Entries | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | `src/services/canonical/normalizer.ts` | **CANONICAL_MAP** (V4 Authority) | ~85 concepts, ~450 synonyms | ✅ ACTIVE — Designated authority | Missing 50 concepts from other systems |
| 2 | `src/services/context_engine/terminology_normalizer.ts` | SYNONYM_MAP | ~320 entries | ⚠️ ACTIVE — Used by orchestrator | Largest synonym coverage, NOT canonical ID-based |
| 3 | `src/services/context_engine/language_processor.ts` | CODE_MIXED_MAP | 19 entries | ⚠️ DUPLICATE — Same map exists in canonical/normalizer.ts | Identical content |
| 4 | `src/services/context_engine/concept_mapper.ts` | BUILT_IN_SYNONYMS | 28 entries | ⚠️ ACTIVE — DB-backed concept resolver | Overlaps with canonical normalizer |
| 5 | `canonical/mappings.ts` | CANONICAL_MAP (old) | 10 concepts | 🔴 DEAD — Not imported by pipeline | Superseded by src/services/canonical/ |
| 6 | `src/services/benchmark_shared/diagnosis_matching.ts` | SYNONYM_MAP | ~80 diagnosis synonyms | ⚠️ BENCHMARK ONLY — Not in clinical pipeline | Diagnosis-level, acceptable for benchmarks |
| 7 | `src/services/benchmark_v8/runner.ts` | DIAGNOSIS_SYNONYM_MAP | ~30 entries | ⚠️ BENCHMARK ONLY | Duplicate of #6 |
| 8 | `supabase/functions/ddx-engine/index.ts` | SYNONYM_MAP | ~170 entries | 🔴 DRIFT RISK — Inline copy, no sync | Edge function isolation requires inline |
| 9 | `supabase/functions/clinical-reasoning-engine/index.ts` | SYNONYM_MAP | ~70 entries | 🔴 DRIFT RISK — Subset of #8 | Same pattern |
| 10 | `supabase/functions/load-reasoning-context/index.ts`, `test-hypotheses/index.ts`, `generate-physiological-context/index.ts` | SYNONYM_MAP | ~70 each | 🔴 DRIFT RISK — 3 more inline copies | Same pattern |

### B. String-Based Reasoning Leaks (HIGH RISK)

| File | Line(s) | Pattern | Risk | Impact |
|------|---------|---------|------|--------|
| `clinical_reasoning/evidenceEngine.ts` | 84-88 | `n.includes("sepsis")`, `n.includes("myocardial")` | **HIGH** | Diagnosis classification uses raw string matching — bypasses canonical system |
| `ddx_engine/candidate_fallback.ts` | 215, 234 | `m.includes("lithium")`, `s.includes(k)` | **HIGH** | Medication and symptom matching via raw strings |
| `ddx_engine/candidate_fallback_v2.ts` | 212 | `m.includes("lithium")` | **HIGH** | Duplicate of above |
| `context_engine/context_aware_safety.ts` | 269, 295 | `s.includes(t)` for all symptom matching | **HIGH** | Safety-critical layer uses raw string matching |
| `meta_reasoning/index.ts` | 322-340 | `d.toLowerCase().includes("myocardial")` | **MEDIUM** | Not in core pipeline but executes |
| `cognitive/clinical_cognitive_controller.ts` | 170, 199, 305 | `lower.includes(key)` for diagnosis tests | **MEDIUM** | Test recommendation via string matching |
| `clinical_pipeline/benchmark_mode.ts` | 119, 576-583 | `lower.includes(kw)`, cognitive pruning by string | **MEDIUM** | Benchmark mode only |
| `validation_suite/perturbation_harness.ts` | 444 | `d.name.toLowerCase().includes("sepsis")` | **LOW** | Test infrastructure only |

**Total: 69+ `.includes()` calls on clinical terms across 9 files**

### C. Normalization Pipelines

| File | Function | Capabilities | Connected to Pipeline |
|------|----------|-------------|----------------------|
| `canonical/normalizer.ts` | `canonicalize()` | lowercase, code-mixed translation, synonym→ID, SNOMED mapping | **YES** (V4 pipeline) |
| `context_engine/terminology_normalizer.ts` | `normalizeSymptom()` | lowercase, synonym→canonical string | **YES** (orchestrator uses it) |
| `context_engine/language_processor.ts` | `detectLanguage()`, `normalizeText()`, `translateCodeMixed()` | language detection, whitespace, code-mixed | **YES** (context builder) |
| `context_engine/concept_mapper.ts` | `mapToClinicalConcepts()` | DB lookup + built-in synonyms + passthrough | **YES** (context builder) |
| `normalize-transcript/index.ts` (edge fn) | Lexicon-based annotation | DB regional_lexicon scan, inline annotation | **YES** (transcript processing) |

### D. Multilingual Handling

| Language | Supported | Where | Issues |
|----------|-----------|-------|--------|
| English | ✅ Yes | All systems | Canonical authority |
| Hindi (Devanagari) | ⚠️ Partial | canonical/normalizer.ts: script detection only | No Devanagari synonyms in CANONICAL_MAP (e.g. "बुखार" missing) |
| Hinglish (romanized) | ✅ Yes | CODE_MIXED_MAP in normalizer.ts (19 phrases) | Good coverage for common symptoms |
| Telugu | ⚠️ Partial | Script detection only | No Telugu synonyms in any system |
| Tamil | ⚠️ Partial | Script detection only | No Tamil synonyms in any system |

---

## PHASE 2 — CONFLICT ANALYSIS

### Critical Conflicts

| Term | Canonical normalizer | Terminology normalizer | Conflict |
|------|---------------------|----------------------|----------|
| "mild fever" | → FEVER | → "mild fever" (separate concept) | **INCONSISTENT** — normalizer resolves to FEVER ID, terminology keeps as string |
| "chest tightness" | → CHEST_PAIN | → "chest pain" (string) | **DRIFT** — Same mapping but different output format |
| "double vision" | → BLURRED_VISION | Not mapped | **MISSING** — terminology normalizer doesn't handle this |
| All hallmark signs | Missing 50 concepts | Present as string→string maps | **GAP** — terminology_normalizer has 50 concepts that canonical normalizer lacks |

### Duplicate Definition Summary
- **5 edge functions** each contain ~70-170 inline SYNONYM_MAP copies with NO sync mechanism
- **2 client-side systems** (canonical/normalizer + terminology_normalizer) overlap on ~80% of entries but output different formats (IDs vs strings)
- **concept_mapper** has 28 built-in synonyms that overlap with both systems

---

## PHASE 3 — CONSOLIDATION PLAN

### Files to Modify/Remove

| File | Action | Risk | Notes |
|------|--------|------|-------|
| `canonical/mappings.ts` (root) | **DELETE** | LOW | Superseded by src/services/canonical/ |
| `context_engine/terminology_normalizer.ts` | **DEPRECATE → delegate to canonical** | MEDIUM | Used by orchestrator — needs import swap |
| `context_engine/language_processor.ts` | **REMOVE CODE_MIXED_MAP** — duplicate | LOW | Canonical normalizer has identical map |
| `context_engine/concept_mapper.ts` | **REMOVE BUILT_IN_SYNONYMS** — delegate | MEDIUM | Keep DB lookup, remove built-in fallback |
| 5x edge function SYNONYM_MAPs | **KEEP (isolated runtime)** | N/A | Edge functions run in Deno — cannot share client modules |
| `benchmark_shared/diagnosis_matching.ts` | **KEEP** | LOW | Diagnosis-level matching for benchmarks — different domain |
| `benchmark_v8/runner.ts` | **KEEP** | LOW | Benchmark infrastructure |

### Canonical Normalizer Enrichment Required
- Add 50 missing concepts from terminology_normalizer (hallmark signs, pediatric, ophthalmological, etc.)
- This ensures canonical normalizer is a strict superset of all other systems

---

## PHASE 4 — SUMMARY METRICS

| Metric | Value |
|--------|-------|
| Total synonym systems | 10 |
| Systems to consolidate | 4 (client-side) |
| Systems to keep (isolated) | 6 (edge functions + benchmarks) |
| String-based reasoning leaks | 69+ occurrences in 9 files |
| Missing canonical concepts | 50 |
| Multilingual gaps | Telugu, Tamil (no synonyms), Hindi (script only) |
| Edge function drift risk | HIGH (5 unsynchronized copies) |
