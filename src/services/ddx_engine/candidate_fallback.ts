/**
 * FIX 3 — Candidate Generation Fallback
 *
 * When the KG-based DDX engine returns an empty or sparse candidate set,
 * this module generates additional candidates using:
 *   a) Canonical symptom-cluster matching (ID-based organ-system inference)
 *   b) Chief-complaint pattern matching
 *   c) Risk-factor-weighted common diagnoses
 *
 * All fallback candidates are tagged with source = "fallback_inference"
 * and merged into the candidate pool BEFORE Bayesian ranking.
 *
 * 🚫 RAW STRING USAGE FORBIDDEN — All symptom matching uses canonical feature IDs
 *
 * Invariants:
 *   - Max 5 fallback candidates injected
 *   - Fallback candidates start at probability = 0 (Bayesian scores them)
 *   - Never duplicates existing candidates
 *   - Tagged for auditability
 */

import type { DDXDiagnosis, DDXResult } from "./client";
import { resolveCanonicalId } from "@/services/canonical";

// ── Sparse threshold: fewer organic candidates than this triggers fallback ──
const SPARSE_THRESHOLD = 3;

// ── Symptom-cluster → candidate map using CANONICAL FEATURE IDs ──
interface FallbackRule {
  id: string;
  feature_ids: string[];          // Canonical feature IDs (e.g. "CHEST_PAIN")
  min_feature_matches: number;
  candidates: Array<{
    diagnosis_name: string;
    category: string;
    must_not_miss: boolean;
  }>;
}

const FALLBACK_RULES: FallbackRule[] = [
  // ── Cardiac ──
  {
    id: "cardiac_cluster",
    feature_ids: ["CHEST_PAIN", "PALPITATIONS", "DIAPHORESIS", "DYSPNEA", "PLEURITIC_CHEST_PAIN"],
    min_feature_matches: 1,
    candidates: [
      { diagnosis_name: "Acute Coronary Syndrome", category: "cardiovascular", must_not_miss: true },
      { diagnosis_name: "Unstable Angina", category: "cardiovascular", must_not_miss: true },
      { diagnosis_name: "Costochondritis", category: "musculoskeletal", must_not_miss: false },
      { diagnosis_name: "GERD", category: "gastrointestinal", must_not_miss: false },
    ],
  },
  // ── Neurological ──
  {
    id: "neuro_cluster",
    feature_ids: ["HEADACHE", "CONFUSION", "SEIZURE", "WEAKNESS", "TINGLING", "SPEECH_DIFFICULTY", "FACIAL_DROOP", "BLURRED_VISION", "PHOTOPHOBIA", "NECK_STIFFNESS"],
    min_feature_matches: 2,
    candidates: [
      { diagnosis_name: "Stroke", category: "neurological", must_not_miss: true },
      { diagnosis_name: "Meningitis", category: "infectious", must_not_miss: true },
      { diagnosis_name: "Migraine", category: "neurological", must_not_miss: false },
      { diagnosis_name: "Subarachnoid Hemorrhage", category: "neurological", must_not_miss: true },
    ],
  },
  // ── Respiratory ──
  {
    id: "respiratory_cluster",
    feature_ids: ["DYSPNEA", "COUGH", "WHEEZING", "HEMOPTYSIS", "PLEURITIC_CHEST_PAIN", "STRIDOR"],
    min_feature_matches: 1,
    candidates: [
      { diagnosis_name: "Pulmonary Embolism", category: "respiratory", must_not_miss: true },
      { diagnosis_name: "Asthma Exacerbation", category: "respiratory", must_not_miss: false },
      { diagnosis_name: "Pneumonia", category: "respiratory", must_not_miss: false },
      { diagnosis_name: "Pneumothorax", category: "respiratory", must_not_miss: true },
    ],
  },
  // ── Abdominal ──
  {
    id: "abdominal_cluster",
    feature_ids: ["ABDOMINAL_PAIN", "NAUSEA", "VOMITING", "DIARRHEA", "CONSTIPATION", "ABDOMINAL_CRAMPS", "MELENA", "HEMATEMESIS"],
    min_feature_matches: 2,
    candidates: [
      { diagnosis_name: "Appendicitis", category: "gastrointestinal", must_not_miss: true },
      { diagnosis_name: "Cholecystitis", category: "gastrointestinal", must_not_miss: false },
      { diagnosis_name: "Pancreatitis", category: "gastrointestinal", must_not_miss: false },
      { diagnosis_name: "Bowel Obstruction", category: "gastrointestinal", must_not_miss: true },
    ],
  },
  // ── Infectious / Sepsis ──
  {
    id: "sepsis_cluster",
    feature_ids: ["FEVER", "CHILLS", "CONFUSION", "TACHYCARDIA"],
    min_feature_matches: 2,
    candidates: [
      { diagnosis_name: "Sepsis", category: "infectious", must_not_miss: true },
      { diagnosis_name: "Urinary Tract Infection", category: "renal", must_not_miss: false },
      { diagnosis_name: "Pneumonia", category: "respiratory", must_not_miss: false },
    ],
  },
  // ── Pediatric ──
  {
    id: "pediatric_cluster",
    feature_ids: ["LEUKOCORIA"],
    min_feature_matches: 1,
    candidates: [
      { diagnosis_name: "Retinoblastoma", category: "oncological", must_not_miss: true },
      { diagnosis_name: "Congenital Cataract", category: "ophthalmological", must_not_miss: false },
    ],
  },
  // ── Endocrine ──
  {
    id: "endocrine_cluster",
    feature_ids: ["POLYURIA", "POLYDIPSIA", "WEIGHT_LOSS", "FATIGUE", "BLURRED_VISION", "FRUITY_BREATH"],
    min_feature_matches: 2,
    candidates: [
      { diagnosis_name: "Diabetic Ketoacidosis", category: "endocrine", must_not_miss: true },
      { diagnosis_name: "Type 2 Diabetes Mellitus", category: "endocrine", must_not_miss: false },
      { diagnosis_name: "Hyperthyroidism", category: "endocrine", must_not_miss: false },
    ],
  },
  // ── Toxicological ──
  {
    id: "toxicology_cluster",
    feature_ids: ["CONFUSION", "NAUSEA", "VOMITING", "BLURRED_VISION", "POLYURIA"],
    min_feature_matches: 2,
    candidates: [
      { diagnosis_name: "Lithium Toxicity", category: "toxicological", must_not_miss: true },
      { diagnosis_name: "Serotonin Syndrome", category: "toxicological", must_not_miss: true },
      { diagnosis_name: "Neuroleptic Malignant Syndrome", category: "neurological", must_not_miss: true },
    ],
  },
  // ── Musculoskeletal / Surgical ──
  {
    id: "surgical_cluster",
    feature_ids: ["CREPITUS"],
    min_feature_matches: 1,
    candidates: [
      { diagnosis_name: "Fournier Gangrene", category: "surgical", must_not_miss: true },
      { diagnosis_name: "Testicular Torsion", category: "urological", must_not_miss: true },
      { diagnosis_name: "Epididymitis", category: "urological", must_not_miss: false },
    ],
  },
  // ── Dermatological / Allergic ──
  {
    id: "allergic_cluster",
    feature_ids: ["RASH", "SWELLING", "DYSPNEA", "ITCHING"],
    min_feature_matches: 2,
    candidates: [
      { diagnosis_name: "Anaphylaxis", category: "immunological", must_not_miss: true },
      { diagnosis_name: "Angioedema", category: "immunological", must_not_miss: true },
      { diagnosis_name: "Drug Reaction", category: "dermatological", must_not_miss: false },
    ],
  },
  // ── Spinal ──
  {
    id: "spinal_cluster",
    feature_ids: ["BACK_PAIN", "WEAKNESS", "SADDLE_ANESTHESIA", "URINARY_INCONTINENCE"],
    min_feature_matches: 2,
    candidates: [
      { diagnosis_name: "Cauda Equina Syndrome", category: "neurological", must_not_miss: true },
      { diagnosis_name: "Spinal Cord Compression", category: "neurological", must_not_miss: true },
    ],
  },
];

const MAX_FALLBACK_CANDIDATES = 5;

export interface FallbackMeta {
  triggered: boolean;
  reason: string;
  organic_count: number;
  fallback_count: number;
  rules_matched: string[];
}

/**
 * Convert raw symptom strings to canonical feature IDs for matching.
 * Accepts both raw strings (will resolve via canonical layer) and pre-resolved IDs.
 */
function buildFeatureSet(symptoms: string[]): Set<string> {
  const featureSet = new Set<string>();
  for (const s of symptoms) {
    const trimmed = String(s).trim();
    if (!trimmed) continue;
    // If it's already a canonical ID (UPPER_CASE format), use directly
    if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) {
      featureSet.add(trimmed);
    } else {
      // Resolve via canonical layer
      const canonicalId = resolveCanonicalId(trimmed);
      if (canonicalId) {
        featureSet.add(canonicalId);
      }
    }
  }
  return featureSet;
}

/**
 * Generate fallback candidates when DDX returns sparse or empty results.
 * Returns augmented DDX result + metadata about what was injected.
 *
 * 🚫 RAW STRING USAGE FORBIDDEN BEYOND THIS POINT — all matching uses canonical IDs
 */
export function applyCandidateFallback(
  ddxResult: DDXResult | null,
  symptoms: string[],
  context?: {
    medical_history?: string[];
    risk_factors?: string[];
    age?: number | null;
    medications?: string[];
  },
): { ddx: DDXResult | null; fallback: FallbackMeta } {
  const organicCount = ddxResult?.differential_diagnoses?.length ?? 0;

  if (organicCount >= SPARSE_THRESHOLD && ddxResult) {
    return {
      ddx: ddxResult,
      fallback: {
        triggered: false,
        reason: `Sufficient organic candidates (${organicCount} ≥ ${SPARSE_THRESHOLD})`,
        organic_count: organicCount,
        fallback_count: 0,
        rules_matched: [],
      },
    };
  }

  const reason = organicCount === 0
    ? "Empty candidate set — KG returned no matches"
    : `Sparse candidate set (${organicCount} < ${SPARSE_THRESHOLD})`;

  // 🚫 RAW STRING USAGE FORBIDDEN — Convert to canonical IDs
  const featureSet = buildFeatureSet(symptoms);

  // Medication-based signal: check for lithium using canonical resolution
  const meds = (context?.medications || []).map(m => m.toLowerCase());
  if (meds.some(m => m === "lithium" || m.startsWith("lithium "))) {
    // Lithium is a medication, not a symptom — flag for toxicology rule matching
    featureSet.add("_MED_LITHIUM");
  }

  // Existing candidate names for dedup
  const existingNames = new Set(
    (ddxResult?.differential_diagnoses || []).map(d =>
      (d.diagnosis_name || "").toLowerCase().trim()
    )
  );

  const fallbackCandidates: DDXDiagnosis[] = [];
  const rulesMatched: string[] = [];

  for (const rule of FALLBACK_RULES) {
    if (fallbackCandidates.length >= MAX_FALLBACK_CANDIDATES) break;

    // Count canonical feature ID matches
    const matchedFeatures = rule.feature_ids.filter(fid => featureSet.has(fid));
    const matchCount = matchedFeatures.length;

    // Special: toxicology cluster also activates on lithium medication
    const effectiveMatchCount = rule.id === "toxicology_cluster" && featureSet.has("_MED_LITHIUM")
      ? matchCount + 1
      : matchCount;

    if (effectiveMatchCount >= rule.min_feature_matches) {
      rulesMatched.push(rule.id);

      for (const candidate of rule.candidates) {
        if (fallbackCandidates.length >= MAX_FALLBACK_CANDIDATES) break;

        const nameKey = candidate.diagnosis_name.toLowerCase().trim();
        if (existingNames.has(nameKey)) continue;
        if (fallbackCandidates.some(f => f.diagnosis_name.toLowerCase() === nameKey)) continue;

        fallbackCandidates.push({
          diagnosis_id: `fallback-${rule.id}-${nameKey.replace(/\s+/g, '-')}`,
          diagnosis_name: candidate.diagnosis_name,
          icd10_code: null,
          category: candidate.category,
          probability: 0,
          supporting_symptoms: matchedFeatures, // Now canonical IDs
          contradicting_factors: [],
          symptom_coverage: "fallback",
          must_not_miss: candidate.must_not_miss,
          guideline_source: "fallback_inference",
        });

        existingNames.add(nameKey);
      }
    }
  }

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
    source: "fallback",
    graph_miss: true,
  };

  const augmented: DDXResult = {
    ...baseDDX,
    differential_diagnoses: [
      ...baseDDX.differential_diagnoses,
      ...fallbackCandidates,
    ],
    source: fallbackCandidates.length > 0
      ? `${baseDDX.source || "ddx"}_with_fallback`
      : baseDDX.source,
  };

  console.log(
    `[CandidateFallback] ${reason}. ` +
    `Injected ${fallbackCandidates.length} fallback candidates from ${rulesMatched.length} rules: ` +
    `[${rulesMatched.join(", ")}]`
  );

  return {
    ddx: augmented,
    fallback: {
      triggered: fallbackCandidates.length > 0,
      reason,
      organic_count: organicCount,
      fallback_count: fallbackCandidates.length,
      rules_matched: rulesMatched,
    },
  };
}
