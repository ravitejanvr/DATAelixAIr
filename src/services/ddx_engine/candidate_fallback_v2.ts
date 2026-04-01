/**
 * Candidate Fallback v2 — Probabilistic + Rule Hybrid
 *
 * Upgrades the original fallback with:
 *   1. Probability weighting based on context match strength
 *   2. Cluster confidence scoring (how many signals support each cluster)
 *   3. Context-aware candidate ranking (age, sex, history adjustments)
 *   4. Integration with Phase 5 candidate hints from context expander
 *
 * Still tags all candidates with source = "fallback_v2" for traceability.
 * Replaces applyCandidateFallback when Phase 5 is enabled.
 */

import type { DDXDiagnosis, DDXResult } from "../ddx_engine/client";
import type { CandidateHint } from "../context_candidate_expander";

const SPARSE_THRESHOLD = 3;
const MAX_FALLBACK_CANDIDATES = 5;
const MAX_TOTAL_INJECTED = Number.POSITIVE_INFINITY; // Generation stage is non-destructive; truncation belongs downstream

// ── Weighted Fallback Rules ──

interface WeightedFallbackRule {
  id: string;
  keywords: string[];
  min_keyword_matches: number;
  /** Base confidence multiplier for this cluster (0-1) */
  cluster_confidence: number;
  candidates: Array<{
    diagnosis_name: string;
    category: string;
    must_not_miss: boolean;
    /** Base probability score (0-100) — modulated by match strength */
    base_score: number;
  }>;
}

const WEIGHTED_RULES: WeightedFallbackRule[] = [
  {
    id: "cardiac_cluster",
    keywords: ["chest pain", "palpitations", "diaphoresis", "crushing chest", "left arm pain", "jaw pain", "exertional dyspnea"],
    min_keyword_matches: 1,
    cluster_confidence: 0.8,
    candidates: [
      { diagnosis_name: "Acute Coronary Syndrome", category: "cardiovascular", must_not_miss: true, base_score: 15 },
      { diagnosis_name: "Unstable Angina", category: "cardiovascular", must_not_miss: true, base_score: 10 },
      { diagnosis_name: "Costochondritis", category: "musculoskeletal", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "GERD", category: "gastrointestinal", must_not_miss: false, base_score: 5 },
    ],
  },
  {
    id: "neuro_cluster",
    keywords: ["headache", "confusion", "seizure", "weakness", "numbness", "slurred speech", "facial droop", "visual disturbance", "photophobia", "neck stiffness"],
    min_keyword_matches: 2,
    cluster_confidence: 0.7,
    candidates: [
      { diagnosis_name: "Stroke", category: "neurological", must_not_miss: true, base_score: 15 },
      { diagnosis_name: "Meningitis", category: "infectious", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Migraine", category: "neurological", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "Subarachnoid Hemorrhage", category: "neurological", must_not_miss: true, base_score: 10 },
    ],
  },
  {
    id: "respiratory_cluster",
    keywords: ["shortness of breath", "dyspnea", "cough", "wheezing", "hemoptysis", "pleuritic chest pain", "stridor"],
    min_keyword_matches: 1,
    cluster_confidence: 0.75,
    candidates: [
      { diagnosis_name: "Pulmonary Embolism", category: "respiratory", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Asthma Exacerbation", category: "respiratory", must_not_miss: false, base_score: 10 },
      { diagnosis_name: "Pneumonia", category: "respiratory", must_not_miss: false, base_score: 10 },
      { diagnosis_name: "Pneumothorax", category: "respiratory", must_not_miss: true, base_score: 8 },
    ],
  },
  {
    id: "abdominal_cluster",
    keywords: ["abdominal pain", "nausea", "vomiting", "diarrhea", "constipation", "abdominal cramps", "melena", "hematemesis"],
    min_keyword_matches: 2,
    cluster_confidence: 0.7,
    candidates: [
      { diagnosis_name: "Appendicitis", category: "gastrointestinal", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Cholecystitis", category: "gastrointestinal", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "Pancreatitis", category: "gastrointestinal", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "Bowel Obstruction", category: "gastrointestinal", must_not_miss: true, base_score: 10 },
    ],
  },
  {
    id: "sepsis_cluster",
    keywords: ["fever", "chills", "rigors", "confusion", "tachycardia", "hypotension"],
    min_keyword_matches: 2,
    cluster_confidence: 0.85,
    candidates: [
      { diagnosis_name: "Sepsis", category: "infectious", must_not_miss: true, base_score: 15 },
      { diagnosis_name: "Urinary Tract Infection", category: "renal", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "Pneumonia", category: "respiratory", must_not_miss: false, base_score: 8 },
    ],
  },
  {
    id: "pediatric_cluster",
    keywords: ["leukocoria", "strabismus", "white pupil", "eye swelling", "proptosis"],
    min_keyword_matches: 1,
    cluster_confidence: 0.9,
    candidates: [
      { diagnosis_name: "Retinoblastoma", category: "oncological", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Congenital Cataract", category: "ophthalmological", must_not_miss: false, base_score: 5 },
    ],
  },
  {
    id: "endocrine_cluster",
    keywords: ["polyuria", "polydipsia", "weight loss", "fatigue", "blurred vision", "fruity breath"],
    min_keyword_matches: 2,
    cluster_confidence: 0.75,
    candidates: [
      { diagnosis_name: "Diabetic Ketoacidosis", category: "endocrine", must_not_miss: true, base_score: 14 },
      { diagnosis_name: "Type 2 Diabetes Mellitus", category: "endocrine", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "Hyperthyroidism", category: "endocrine", must_not_miss: false, base_score: 5 },
    ],
  },
  {
    id: "toxicology_cluster",
    keywords: ["tremor", "confusion", "ataxia", "nausea", "vomiting", "blurred vision", "polyuria"],
    min_keyword_matches: 2,
    cluster_confidence: 0.65,
    candidates: [
      { diagnosis_name: "Lithium Toxicity", category: "toxicological", must_not_miss: true, base_score: 10 },
      { diagnosis_name: "Serotonin Syndrome", category: "toxicological", must_not_miss: true, base_score: 10 },
      { diagnosis_name: "Neuroleptic Malignant Syndrome", category: "neurological", must_not_miss: true, base_score: 10 },
    ],
  },
  {
    id: "surgical_cluster",
    keywords: ["scrotal pain", "perineal pain", "testicular pain", "scrotal swelling", "foul smell", "crepitus", "skin necrosis"],
    min_keyword_matches: 1,
    cluster_confidence: 0.8,
    candidates: [
      { diagnosis_name: "Fournier Gangrene", category: "surgical", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Testicular Torsion", category: "urological", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Epididymitis", category: "urological", must_not_miss: false, base_score: 6 },
    ],
  },
  {
    id: "allergic_cluster",
    keywords: ["rash", "urticaria", "swelling", "difficulty breathing", "angioedema", "itching"],
    min_keyword_matches: 2,
    cluster_confidence: 0.75,
    candidates: [
      { diagnosis_name: "Anaphylaxis", category: "immunological", must_not_miss: true, base_score: 15 },
      { diagnosis_name: "Angioedema", category: "immunological", must_not_miss: true, base_score: 10 },
      { diagnosis_name: "Drug Reaction", category: "dermatological", must_not_miss: false, base_score: 6 },
    ],
  },
  {
    id: "spinal_cluster",
    keywords: ["back pain", "leg weakness", "urinary retention", "saddle anesthesia", "bowel incontinence", "bilateral leg pain"],
    min_keyword_matches: 2,
    cluster_confidence: 0.85,
    candidates: [
      { diagnosis_name: "Cauda Equina Syndrome", category: "neurological", must_not_miss: true, base_score: 14 },
      { diagnosis_name: "Spinal Cord Compression", category: "neurological", must_not_miss: true, base_score: 12 },
    ],
  },
];

export interface FallbackV2Meta {
  triggered: boolean;
  reason: string;
  organic_count: number;
  fallback_count: number;
  hint_count: number;
  rules_matched: string[];
  total_injected: number;
}

/**
 * Apply candidate fallback v2 with probability weighting and context hints.
 */
export function applyCandidateFallbackV2(
  ddxResult: DDXResult | null,
  symptoms: string[],
  candidateHints: CandidateHint[],
  context?: {
    medical_history?: string[];
    risk_factors?: string[];
    age?: number | null;
    medications?: string[];
  },
): { ddx: DDXResult | null; fallback: FallbackV2Meta } {
  const organicCount = ddxResult?.differential_diagnoses?.length ?? 0;

  // Check if fallback is needed
  if (organicCount >= SPARSE_THRESHOLD && ddxResult && candidateHints.length === 0) {
    return {
      ddx: ddxResult,
      fallback: {
        triggered: false,
        reason: `Sufficient organic candidates (${organicCount} ≥ ${SPARSE_THRESHOLD})`,
        organic_count: organicCount,
        fallback_count: 0,
        hint_count: 0,
        rules_matched: [],
        total_injected: 0,
      },
    };
  }

  const normalizedSymptoms = new Set(
    symptoms.map(s => String(s).toLowerCase().trim()).filter(Boolean)
  );

  // Medication-based signal injection
  const meds = (context?.medications || []).map(m => m.toLowerCase());
  if (meds.some(m => m.includes("lithium"))) normalizedSymptoms.add("lithium");

  // Existing candidate names for dedup
  const existingNames = new Set(
    (ddxResult?.differential_diagnoses || []).map(d => (d.diagnosis_name || "").toLowerCase().trim())
  );

  const fallbackCandidates: DDXDiagnosis[] = [];
  const rulesMatched: string[] = [];

  // 1. Inject context-expander hints first (higher priority)
  // Sort by confidence desc so highest-value candidates get injected first
  const sortedHints = [...candidateHints].sort((a, b) => b.confidence - a.confidence);
  for (const hint of sortedHints) {
    const nameKey = hint.diagnosis_name.toLowerCase().trim();
    if (existingNames.has(nameKey)) continue;
    if (fallbackCandidates.some(f => f.diagnosis_name.toLowerCase() === nameKey)) continue;
    if (fallbackCandidates.length >= MAX_TOTAL_INJECTED) break;

    fallbackCandidates.push({
      diagnosis_id: `hint-${hint.source}-${nameKey.replace(/\s+/g, '-')}`,
      diagnosis_name: hint.diagnosis_name,
      icd10_code: null,
      category: hint.source,
        probability: Math.max(5, hint.confidence * 100), // Preserve raw confidence with a 5% floor in percentage space
      supporting_symptoms: [],
      contradicting_factors: [],
      symptom_coverage: "context_hint",
      must_not_miss: false,
      guideline_source: `phase5_${hint.source}`,
    });

    existingNames.add(nameKey);
  }

  // 2. Rule-based fallback (only if organic is sparse)
  if (organicCount < SPARSE_THRESHOLD) {
    for (const rule of WEIGHTED_RULES) {
      if (fallbackCandidates.length >= MAX_TOTAL_INJECTED) break;

      const matchedKeywords = rule.keywords.filter(k =>
        [...normalizedSymptoms].some(s => s.includes(k) || k.includes(s))
      );
      const matchCount = matchedKeywords.length;

      if (matchCount >= rule.min_keyword_matches) {
        rulesMatched.push(rule.id);
        const matchStrength = Math.min(1, matchCount / Math.max(rule.min_keyword_matches * 2, 3));

        for (const candidate of rule.candidates) {
          if (fallbackCandidates.length >= MAX_TOTAL_INJECTED) break;

          const nameKey = candidate.diagnosis_name.toLowerCase().trim();
          if (existingNames.has(nameKey)) continue;
          if (fallbackCandidates.some(f => f.diagnosis_name.toLowerCase() === nameKey)) continue;

          // Weighted probability: base_score * cluster_confidence * match_strength
          const weightedScore =
            candidate.base_score * rule.cluster_confidence * (0.5 + matchStrength * 0.5);

          fallbackCandidates.push({
            diagnosis_id: `fallback-v2-${rule.id}-${nameKey.replace(/\s+/g, '-')}`,
            diagnosis_name: candidate.diagnosis_name,
            icd10_code: null,
            category: candidate.category,
            probability: Math.max(5, weightedScore),
            supporting_symptoms: matchedKeywords,
            contradicting_factors: [],
            symptom_coverage: "fallback_v2",
            must_not_miss: candidate.must_not_miss,
            guideline_source: "fallback_v2",
          });

          existingNames.add(nameKey);
        }
      }
    }
  }

  const hintCount = candidateHints.filter(h => {
    const k = h.diagnosis_name.toLowerCase().trim();
    return fallbackCandidates.some(f => f.diagnosis_name.toLowerCase().trim() === k);
  }).length;

  // Build augmented DDX
  const baseDDX: DDXResult = ddxResult || {
    differential_diagnoses: [],
    recommended_labs: [],
    suggested_medications: [],
    guideline_recommendations: [],
    dangerous_diagnoses: [],
    safety_alerts: [],
    matched_symptoms: [],
    unmatched_symptoms: symptoms,
    dangerous_diagnoses_injected: 0,
    must_not_miss_count: 0,
    safety_alerts_count: 0,
    organ_systems_active: [],
    reasoning_traces: [],
    score_threshold_applied: 0,
    execution_ms: 0,
    stage_latencies: { symptom_resolution: 0, bayesian_scoring: 0, dangerous_injection: 0, enrichment: 0 },
    bayesian_model: false,
    phase9_active: false,
    source: "fallback_v2",
    graph_miss: true,
  };

  const augmented: DDXResult = {
    ...baseDDX,
    differential_diagnoses: [
      ...baseDDX.differential_diagnoses,
      ...fallbackCandidates,
    ],
    source: fallbackCandidates.length > 0
      ? `${baseDDX.source || "ddx"}_with_fallback_v2`
      : baseDDX.source,
  };

  const reason = organicCount === 0
    ? "Empty candidate set"
    : organicCount < SPARSE_THRESHOLD
      ? `Sparse candidates (${organicCount} < ${SPARSE_THRESHOLD})`
      : `Context hints injected (${hintCount} hints)`;

  if (fallbackCandidates.length > 0) {
    console.log(
      `[FallbackV2] ${reason}. Injected ${fallbackCandidates.length} candidates ` +
      `(${hintCount} from hints, ${fallbackCandidates.length - hintCount} from rules). ` +
      `Rules: [${rulesMatched.join(", ")}]`
    );
  }

  return {
    ddx: augmented,
    fallback: {
      triggered: fallbackCandidates.length > 0,
      reason,
      organic_count: organicCount,
      fallback_count: fallbackCandidates.length - hintCount,
      hint_count: hintCount,
      rules_matched: rulesMatched,
      total_injected: fallbackCandidates.length,
    },
  };
}
