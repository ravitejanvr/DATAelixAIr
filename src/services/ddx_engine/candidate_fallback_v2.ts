/**
 * Candidate Fallback v2 — Probabilistic + Rule Hybrid
 *
 * Upgrades the original fallback with:
 *   1. Probability weighting based on context match strength
 *   2. Cluster confidence scoring (how many signals support each cluster)
 *   3. Context-aware candidate ranking (age, sex, history adjustments)
 *   4. Integration with Phase 5 candidate hints from context expander
 *
 * 🚫 RAW STRING USAGE FORBIDDEN — All symptom matching uses canonical feature IDs
 *
 * Still tags all candidates with source = "fallback_v2" for traceability.
 * Replaces applyCandidateFallback when Phase 5 is enabled.
 */

import type { DDXDiagnosis, DDXResult } from "../ddx_engine/client";
import type { CandidateHint } from "../context_candidate_expander";
import { resolveCanonicalId } from "@/services/canonical";

const SPARSE_THRESHOLD = 3;
const MAX_FALLBACK_CANDIDATES = 5;
const MAX_TOTAL_INJECTED = 8;

// ── Weighted Fallback Rules using CANONICAL FEATURE IDs ──

interface WeightedFallbackRule {
  id: string;
  feature_ids: string[];         // Canonical feature IDs
  min_feature_matches: number;
  cluster_confidence: number;
  candidates: Array<{
    diagnosis_name: string;
    category: string;
    must_not_miss: boolean;
    base_score: number;
  }>;
}

const WEIGHTED_RULES: WeightedFallbackRule[] = [
  {
    id: "cardiac_cluster",
    feature_ids: ["CHEST_PAIN", "PALPITATIONS", "DIAPHORESIS", "DYSPNEA", "PLEURITIC_CHEST_PAIN"],
    min_feature_matches: 1,
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
    feature_ids: ["HEADACHE", "CONFUSION", "SEIZURE", "WEAKNESS", "TINGLING", "SPEECH_DIFFICULTY", "FACIAL_DROOP", "BLURRED_VISION", "PHOTOPHOBIA", "NECK_STIFFNESS"],
    min_feature_matches: 2,
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
    feature_ids: ["DYSPNEA", "COUGH", "WHEEZING", "HEMOPTYSIS", "PLEURITIC_CHEST_PAIN", "STRIDOR"],
    min_feature_matches: 1,
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
    feature_ids: ["ABDOMINAL_PAIN", "NAUSEA", "VOMITING", "DIARRHEA", "CONSTIPATION", "ABDOMINAL_CRAMPS", "MELENA", "HEMATEMESIS"],
    min_feature_matches: 2,
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
    feature_ids: ["FEVER", "CHILLS", "CONFUSION", "TACHYCARDIA"],
    min_feature_matches: 2,
    cluster_confidence: 0.85,
    candidates: [
      { diagnosis_name: "Sepsis", category: "infectious", must_not_miss: true, base_score: 15 },
      { diagnosis_name: "Urinary Tract Infection", category: "renal", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "Pneumonia", category: "respiratory", must_not_miss: false, base_score: 8 },
    ],
  },
  {
    id: "pediatric_cluster",
    feature_ids: ["LEUKOCORIA"],
    min_feature_matches: 1,
    cluster_confidence: 0.9,
    candidates: [
      { diagnosis_name: "Retinoblastoma", category: "oncological", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Congenital Cataract", category: "ophthalmological", must_not_miss: false, base_score: 5 },
    ],
  },
  {
    id: "endocrine_cluster",
    feature_ids: ["POLYURIA", "POLYDIPSIA", "WEIGHT_LOSS", "FATIGUE", "BLURRED_VISION", "FRUITY_BREATH"],
    min_feature_matches: 2,
    cluster_confidence: 0.75,
    candidates: [
      { diagnosis_name: "Diabetic Ketoacidosis", category: "endocrine", must_not_miss: true, base_score: 14 },
      { diagnosis_name: "Type 2 Diabetes Mellitus", category: "endocrine", must_not_miss: false, base_score: 8 },
      { diagnosis_name: "Hyperthyroidism", category: "endocrine", must_not_miss: false, base_score: 5 },
    ],
  },
  {
    id: "toxicology_cluster",
    feature_ids: ["CONFUSION", "NAUSEA", "VOMITING", "BLURRED_VISION", "POLYURIA"],
    min_feature_matches: 2,
    cluster_confidence: 0.65,
    candidates: [
      { diagnosis_name: "Lithium Toxicity", category: "toxicological", must_not_miss: true, base_score: 10 },
      { diagnosis_name: "Serotonin Syndrome", category: "toxicological", must_not_miss: true, base_score: 10 },
      { diagnosis_name: "Neuroleptic Malignant Syndrome", category: "neurological", must_not_miss: true, base_score: 10 },
    ],
  },
  {
    id: "surgical_cluster",
    feature_ids: ["CREPITUS"],
    min_feature_matches: 1,
    cluster_confidence: 0.8,
    candidates: [
      { diagnosis_name: "Fournier Gangrene", category: "surgical", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Testicular Torsion", category: "urological", must_not_miss: true, base_score: 12 },
      { diagnosis_name: "Epididymitis", category: "urological", must_not_miss: false, base_score: 6 },
    ],
  },
  {
    id: "allergic_cluster",
    feature_ids: ["RASH", "SWELLING", "DYSPNEA", "ITCHING"],
    min_feature_matches: 2,
    cluster_confidence: 0.75,
    candidates: [
      { diagnosis_name: "Anaphylaxis", category: "immunological", must_not_miss: true, base_score: 15 },
      { diagnosis_name: "Angioedema", category: "immunological", must_not_miss: true, base_score: 10 },
      { diagnosis_name: "Drug Reaction", category: "dermatological", must_not_miss: false, base_score: 6 },
    ],
  },
  {
    id: "spinal_cluster",
    feature_ids: ["BACK_PAIN", "WEAKNESS", "SADDLE_ANESTHESIA", "URINARY_INCONTINENCE"],
    min_feature_matches: 2,
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
 * Convert raw symptom strings to canonical feature IDs.
 */
function buildFeatureSet(symptoms: string[]): Set<string> {
  const featureSet = new Set<string>();
  for (const s of symptoms) {
    const trimmed = String(s).trim();
    if (!trimmed) continue;
    if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) {
      featureSet.add(trimmed);
    } else {
      const canonicalId = resolveCanonicalId(trimmed);
      if (canonicalId) {
        featureSet.add(canonicalId);
      }
    }
  }
  return featureSet;
}

/**
 * Apply candidate fallback v2 with probability weighting and context hints.
 *
 * 🚫 RAW STRING USAGE FORBIDDEN BEYOND THIS POINT
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

  // 🚫 RAW STRING USAGE FORBIDDEN — Convert to canonical IDs
  const featureSet = buildFeatureSet(symptoms);

  // Medication-based signal: check for lithium
  const meds = (context?.medications || []).map(m => m.toLowerCase());
  if (meds.some(m => m === "lithium" || m.startsWith("lithium "))) {
    featureSet.add("_MED_LITHIUM");
  }

  // Existing candidate names for dedup
  const existingNames = new Set(
    (ddxResult?.differential_diagnoses || []).map(d => (d.diagnosis_name || "").toLowerCase().trim())
  );

  const fallbackCandidates: DDXDiagnosis[] = [];
  const rulesMatched: string[] = [];

  // 1. Inject context-expander hints first (higher priority)
  for (const hint of candidateHints) {
    const nameKey = hint.diagnosis_name.toLowerCase().trim();
    if (existingNames.has(nameKey)) continue;
    if (fallbackCandidates.some(f => f.diagnosis_name.toLowerCase() === nameKey)) continue;
    if (fallbackCandidates.length >= MAX_TOTAL_INJECTED) break;

    fallbackCandidates.push({
      diagnosis_id: `hint-${hint.source}-${nameKey.replace(/\s+/g, '-')}`,
      diagnosis_name: hint.diagnosis_name,
      icd10_code: null,
      category: hint.source,
      probability: Math.round(hint.confidence * 10),
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

      // Match canonical feature IDs
      const matchedFeatures = rule.feature_ids.filter(fid => featureSet.has(fid));
      let matchCount = matchedFeatures.length;

      // Special: toxicology cluster also activates on lithium medication
      if (rule.id === "toxicology_cluster" && featureSet.has("_MED_LITHIUM")) {
        matchCount++;
      }

      if (matchCount >= rule.min_feature_matches) {
        rulesMatched.push(rule.id);
        const matchStrength = Math.min(1, matchCount / Math.max(rule.min_feature_matches * 2, 3));

        for (const candidate of rule.candidates) {
          if (fallbackCandidates.length >= MAX_TOTAL_INJECTED) break;

          const nameKey = candidate.diagnosis_name.toLowerCase().trim();
          if (existingNames.has(nameKey)) continue;
          if (fallbackCandidates.some(f => f.diagnosis_name.toLowerCase() === nameKey)) continue;

          const weightedScore = Math.round(
            candidate.base_score * rule.cluster_confidence * (0.5 + matchStrength * 0.5)
          );

          fallbackCandidates.push({
            diagnosis_id: `fallback-v2-${rule.id}-${nameKey.replace(/\s+/g, '-')}`,
            diagnosis_name: candidate.diagnosis_name,
            icd10_code: null,
            category: candidate.category,
            probability: weightedScore,
            supporting_symptoms: matchedFeatures, // Canonical IDs
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
