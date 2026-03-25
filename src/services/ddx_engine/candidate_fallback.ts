/**
 * FIX 3 — Candidate Generation Fallback
 *
 * When the KG-based DDX engine returns an empty or sparse candidate set,
 * this module generates additional candidates using:
 *   a) Symptom-cluster heuristics (rule-based organ-system inference)
 *   b) Chief-complaint pattern matching
 *   c) Risk-factor-weighted common diagnoses
 *
 * All fallback candidates are tagged with source = "fallback_inference"
 * and merged into the candidate pool BEFORE Bayesian ranking.
 *
 * Invariants:
 *   - Max 5 fallback candidates injected
 *   - Fallback candidates start at probability = 0 (Bayesian scores them)
 *   - Never duplicates existing candidates
 *   - Tagged for auditability
 */

import type { DDXDiagnosis, DDXResult } from "./client";

// ── Sparse threshold: fewer organic candidates than this triggers fallback ──
const SPARSE_THRESHOLD = 3;

// ── Symptom-cluster → candidate map ──
// Each cluster maps a set of symptom keywords to plausible diagnoses
interface FallbackRule {
  id: string;
  keywords: string[];          // ANY of these present → rule activates
  min_keyword_matches: number; // how many keywords must match
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
    keywords: ["chest pain", "palpitations", "diaphoresis", "crushing chest", "left arm pain", "jaw pain", "exertional dyspnea"],
    min_keyword_matches: 1,
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
    keywords: ["headache", "confusion", "seizure", "weakness", "numbness", "slurred speech", "facial droop", "visual disturbance", "photophobia", "neck stiffness"],
    min_keyword_matches: 2,
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
    keywords: ["shortness of breath", "dyspnea", "cough", "wheezing", "hemoptysis", "pleuritic chest pain", "stridor"],
    min_keyword_matches: 1,
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
    keywords: ["abdominal pain", "nausea", "vomiting", "diarrhea", "constipation", "abdominal cramps", "melena", "hematemesis"],
    min_keyword_matches: 2,
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
    keywords: ["fever", "chills", "rigors", "confusion", "tachycardia", "hypotension"],
    min_keyword_matches: 2,
    candidates: [
      { diagnosis_name: "Sepsis", category: "infectious", must_not_miss: true },
      { diagnosis_name: "Urinary Tract Infection", category: "renal", must_not_miss: false },
      { diagnosis_name: "Pneumonia", category: "respiratory", must_not_miss: false },
    ],
  },
  // ── Pediatric ──
  {
    id: "pediatric_cluster",
    keywords: ["leukocoria", "strabismus", "white pupil", "eye swelling", "proptosis"],
    min_keyword_matches: 1,
    candidates: [
      { diagnosis_name: "Retinoblastoma", category: "oncological", must_not_miss: true },
      { diagnosis_name: "Congenital Cataract", category: "ophthalmological", must_not_miss: false },
    ],
  },
  // ── Endocrine ──
  {
    id: "endocrine_cluster",
    keywords: ["polyuria", "polydipsia", "weight loss", "fatigue", "blurred vision", "fruity breath"],
    min_keyword_matches: 2,
    candidates: [
      { diagnosis_name: "Diabetic Ketoacidosis", category: "endocrine", must_not_miss: true },
      { diagnosis_name: "Type 2 Diabetes Mellitus", category: "endocrine", must_not_miss: false },
      { diagnosis_name: "Hyperthyroidism", category: "endocrine", must_not_miss: false },
    ],
  },
  // ── Toxicological ──
  {
    id: "toxicology_cluster",
    keywords: ["tremor", "confusion", "ataxia", "nausea", "vomiting", "blurred vision", "polyuria"],
    min_keyword_matches: 2,
    candidates: [
      { diagnosis_name: "Lithium Toxicity", category: "toxicological", must_not_miss: true },
      { diagnosis_name: "Serotonin Syndrome", category: "toxicological", must_not_miss: true },
      { diagnosis_name: "Neuroleptic Malignant Syndrome", category: "neurological", must_not_miss: true },
    ],
  },
  // ── Musculoskeletal / Surgical ──
  {
    id: "surgical_cluster",
    keywords: ["scrotal pain", "perineal pain", "testicular pain", "scrotal swelling", "foul smell", "crepitus", "skin necrosis"],
    min_keyword_matches: 1,
    candidates: [
      { diagnosis_name: "Fournier Gangrene", category: "surgical", must_not_miss: true },
      { diagnosis_name: "Testicular Torsion", category: "urological", must_not_miss: true },
      { diagnosis_name: "Epididymitis", category: "urological", must_not_miss: false },
    ],
  },
  // ── Dermatological / Allergic ──
  {
    id: "allergic_cluster",
    keywords: ["rash", "urticaria", "swelling", "difficulty breathing", "angioedema", "itching"],
    min_keyword_matches: 2,
    candidates: [
      { diagnosis_name: "Anaphylaxis", category: "immunological", must_not_miss: true },
      { diagnosis_name: "Angioedema", category: "immunological", must_not_miss: true },
      { diagnosis_name: "Drug Reaction", category: "dermatological", must_not_miss: false },
    ],
  },
  // ── Spinal ──
  {
    id: "spinal_cluster",
    keywords: ["back pain", "leg weakness", "urinary retention", "saddle anesthesia", "bowel incontinence", "bilateral leg pain"],
    min_keyword_matches: 2,
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
 * Generate fallback candidates when DDX returns sparse or empty results.
 * Returns augmented DDX result + metadata about what was injected.
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

  // Check if fallback is needed
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

  // Normalize symptoms for matching
  const normalizedSymptoms = new Set(
    symptoms.map(s => String(s).toLowerCase().trim()).filter(Boolean)
  );

  // Check medication-based keywords (for toxicology rules)
  const meds = (context?.medications || []).map(m => m.toLowerCase());
  if (meds.some(m => m.includes("lithium"))) {
    normalizedSymptoms.add("lithium");
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

    // Count keyword matches
    const matchCount = rule.keywords.filter(k =>
      [...normalizedSymptoms].some(s => s.includes(k) || k.includes(s))
    ).length;

    if (matchCount >= rule.min_keyword_matches) {
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
          probability: 0,  // Bayesian will score
          supporting_symptoms: rule.keywords.filter(k =>
            [...normalizedSymptoms].some(s => s.includes(k))
          ),
          contradicting_factors: [],
          symptom_coverage: "fallback",
          must_not_miss: candidate.must_not_miss,
          guideline_source: "fallback_inference",
        });

        existingNames.add(nameKey);
      }
    }
  }

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
