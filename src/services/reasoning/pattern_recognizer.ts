/**
 * Phase 6.9 — Clinical Pattern Recognition Layer
 *
 * Detects MULTI-SYMPTOM PATTERNS (not isolated symptoms) and maps them
 * to domain activations + must-not-miss diagnosis injections.
 *
 * This upgrades the pipeline from symptom-based to pattern-based triggering:
 *   ❌ "fatigue" → anemia
 *   ✅ "fatigue + weight loss + night sweats" → malignancy / infection / autoimmune
 *
 * Pure function — no side effects, no mutation.
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import { normalizeSymptom } from "@/services/context_engine/terminology_normalizer";
import { createEmptyActivation, activateNode, type KGActivation } from "@/services/kg/kg_activation";
import type { CandidateHint } from "@/services/context_candidate_expander";

// ── Types ──

export interface PatternMatch {
  pattern_id: string;
  pattern_name: string;
  matched_symptoms: string[];
  confidence: number;
  domains_activated: string[];
  must_not_miss_diagnoses: string[];
}

export interface PatternRecognitionResult {
  activation: KGActivation;
  patterns_matched: PatternMatch[];
  injected_candidates: CandidateHint[];
  pattern_count: number;
}

// ── Pattern Definitions ──

interface ClinicalPattern {
  id: string;
  name: string;
  /** At least N of these symptoms must match (fuzzy) */
  symptoms: string[];
  /** Minimum number of symptom matches required */
  min_matches: number;
  /** Optional: contextual boosters (age, history, etc.) */
  context_boosters?: {
    age_range?: [number, number];
    history_keywords?: string[];
    risk_keywords?: string[];
    medication_keywords?: string[];
  };
  /** Domains to activate */
  domains: { node: string; weight: number }[];
  /** Must-not-miss diagnoses to inject at low confidence */
  must_not_miss: { name: string; confidence: number; domain: string }[];
  /** Base confidence for the pattern */
  base_confidence: number;
}

const CLINICAL_PATTERNS: ClinicalPattern[] = [
  // ═══ 1. CONSTITUTIONAL / SYSTEMIC ═══
  {
    id: "constitutional_malignancy",
    name: "Constitutional symptoms suggesting malignancy",
    symptoms: ["weight loss", "fatigue", "night sweats", "loss of appetite", "malaise", "weakness"],
    min_matches: 2,
    domains: [
      { node: "malignancy", weight: 0.5 },
      { node: "hematological", weight: 0.4 },
      { node: "general_infectious", weight: 0.3 },
    ],
    must_not_miss: [
      { name: "Lymphoma", confidence: 0.15, domain: "hematological" },
      { name: "Leukemia", confidence: 0.10, domain: "hematological" },
    ],
    base_confidence: 0.3,
  },
  {
    id: "autoimmune_pattern",
    name: "Multi-system inflammatory / autoimmune",
    symptoms: ["joint pain", "fatigue", "rash", "fever", "muscle pain", "photosensitivity", "oral ulcers", "hair loss"],
    min_matches: 3,
    domains: [
      { node: "autoimmune", weight: 0.6 },
      { node: "hematological", weight: 0.3 },
    ],
    must_not_miss: [
      { name: "Systemic Lupus Erythematosus", confidence: 0.20, domain: "autoimmune" },
      { name: "Rheumatoid Arthritis", confidence: 0.15, domain: "autoimmune" },
    ],
    base_confidence: 0.35,
  },

  // ═══ 2. NEUROLOGICAL PATTERNS ═══
  {
    id: "episodic_neuro_deficit",
    name: "Episodic/intermittent neurological deficit",
    symptoms: ["vision loss", "numbness", "tingling", "weakness", "vertigo", "ataxia", "diplopia", "episodic", "intermittent", "relapsing"],
    min_matches: 2,
    domains: [
      { node: "atypical_neuro", weight: 0.6 },
    ],
    must_not_miss: [
      { name: "Multiple Sclerosis", confidence: 0.20, domain: "atypical_neuro" },
      { name: "Transient Ischemic Attack", confidence: 0.20, domain: "atypical_neuro" },
      { name: "Brain Tumor", confidence: 0.10, domain: "atypical_neuro" },
    ],
    base_confidence: 0.3,
  },
  {
    id: "elderly_confusion",
    name: "Elderly + confusion / altered mental status",
    symptoms: ["confusion", "altered mental status", "drowsy", "disorientation", "lethargy", "cognitive decline"],
    min_matches: 1,
    context_boosters: { age_range: [60, 120] },
    domains: [
      { node: "metabolic", weight: 0.5 },
      { node: "renal_gu", weight: 0.4 },
      { node: "atypical_neuro", weight: 0.4 },
    ],
    must_not_miss: [
      { name: "Acute Kidney Injury", confidence: 0.15, domain: "renal_gu" },
      { name: "Delirium", confidence: 0.15, domain: "atypical_neuro" },
      { name: "Stroke", confidence: 0.15, domain: "atypical_neuro" },
    ],
    base_confidence: 0.3,
  },

  // ═══ 3. CARDIAC PATTERNS ═══
  {
    id: "syncope_cardiac",
    name: "Syncope / presyncope with cardiac risk",
    symptoms: ["syncope", "presyncope", "fainting", "collapse", "palpitations", "dizziness", "lightheaded"],
    min_matches: 1,
    domains: [
      { node: "atypical_cardiac", weight: 0.6 },
      { node: "hemodynamic_instability", weight: 0.5 },
    ],
    must_not_miss: [
      { name: "Pulmonary Embolism", confidence: 0.15, domain: "hemodynamic_instability" },
      { name: "Cardiac Arrhythmia", confidence: 0.20, domain: "atypical_cardiac" },
      { name: "Aortic Stenosis", confidence: 0.10, domain: "atypical_cardiac" },
    ],
    base_confidence: 0.3,
  },
  {
    id: "irregular_rhythm",
    name: "Irregular heartbeat / palpitations pattern",
    symptoms: ["palpitations", "irregular heartbeat", "racing heart", "skipped beats", "chest fluttering", "fatigue", "dizziness", "breathless"],
    min_matches: 2,
    domains: [
      { node: "atypical_cardiac", weight: 0.6 },
    ],
    must_not_miss: [
      { name: "Atrial Fibrillation", confidence: 0.25, domain: "atypical_cardiac" },
      { name: "Supraventricular Tachycardia", confidence: 0.15, domain: "atypical_cardiac" },
    ],
    base_confidence: 0.35,
  },

  // ═══ 4. RESPIRATORY PATTERNS ═══
  {
    id: "respiratory_infection",
    name: "Respiratory infection pattern",
    symptoms: ["cough", "fever", "dyspnea", "chest pain", "sputum", "pleuritic", "tachypnea", "crackles"],
    min_matches: 2,
    domains: [
      { node: "respiratory", weight: 0.6 },
      { node: "general_infectious", weight: 0.4 },
    ],
    must_not_miss: [
      { name: "Pneumonia", confidence: 0.25, domain: "respiratory" },
      { name: "Pleural Effusion", confidence: 0.15, domain: "respiratory" },
      { name: "Tuberculosis", confidence: 0.10, domain: "respiratory" },
    ],
    base_confidence: 0.35,
  },
  {
    id: "dyspnea_multisystem",
    name: "Dyspnea with multi-system features",
    symptoms: ["dyspnea", "breathless", "shortness of breath", "edema", "orthopnea", "fatigue", "chest heaviness"],
    min_matches: 2,
    domains: [
      { node: "respiratory", weight: 0.5 },
      { node: "atypical_cardiac", weight: 0.5 },
    ],
    must_not_miss: [
      { name: "Heart Failure", confidence: 0.20, domain: "atypical_cardiac" },
      { name: "Pleural Effusion", confidence: 0.15, domain: "respiratory" },
      { name: "Pulmonary Embolism", confidence: 0.15, domain: "respiratory" },
    ],
    base_confidence: 0.3,
  },

  // ═══ 5. ABDOMINAL PATTERNS ═══
  {
    id: "biliary_pattern",
    name: "Biliary / hepatobiliary pattern",
    symptoms: ["right upper quadrant pain", "nausea", "vomiting", "jaundice", "postprandial pain", "fatty food intolerance", "epigastric pain", "murphy"],
    min_matches: 2,
    domains: [
      { node: "abdominal", weight: 0.6 },
    ],
    must_not_miss: [
      { name: "Cholecystitis", confidence: 0.25, domain: "abdominal" },
      { name: "Choledocholithiasis", confidence: 0.15, domain: "abdominal" },
      { name: "Pancreatitis", confidence: 0.15, domain: "abdominal" },
    ],
    base_confidence: 0.35,
  },
  {
    id: "acute_abdomen",
    name: "Acute abdomen with systemic signs",
    symptoms: ["abdominal pain", "rigidity", "guarding", "rebound", "vomiting", "distension", "absent bowel sounds"],
    min_matches: 2,
    domains: [
      { node: "abdominal", weight: 0.7 },
    ],
    must_not_miss: [
      { name: "Intestinal Obstruction", confidence: 0.20, domain: "abdominal" },
      { name: "Perforated Viscus", confidence: 0.15, domain: "abdominal" },
      { name: "Appendicitis", confidence: 0.20, domain: "abdominal" },
    ],
    base_confidence: 0.35,
  },

  // ═══ 6. RENAL / METABOLIC PATTERNS ═══
  {
    id: "renal_pattern",
    name: "Renal impairment pattern",
    symptoms: ["oliguria", "edema", "nausea", "fatigue", "confusion", "flank pain", "hematuria", "decreased urine output"],
    min_matches: 2,
    context_boosters: { history_keywords: ["diabetes", "hypertension", "ckd", "kidney"] },
    domains: [
      { node: "renal_gu", weight: 0.6 },
      { node: "metabolic", weight: 0.4 },
    ],
    must_not_miss: [
      { name: "Acute Kidney Injury", confidence: 0.25, domain: "renal_gu" },
      { name: "Chronic Kidney Disease", confidence: 0.15, domain: "renal_gu" },
    ],
    base_confidence: 0.3,
  },
  {
    id: "metabolic_derangement",
    name: "Metabolic derangement pattern",
    symptoms: ["polyuria", "polydipsia", "weight loss", "nausea", "vomiting", "confusion", "dehydration", "abdominal pain"],
    min_matches: 2,
    context_boosters: { history_keywords: ["diabetes", "type 1", "type 2"] },
    domains: [
      { node: "metabolic", weight: 0.6 },
    ],
    must_not_miss: [
      { name: "Diabetic Ketoacidosis", confidence: 0.20, domain: "metabolic" },
      { name: "Hyperosmolar Hyperglycemic State", confidence: 0.15, domain: "metabolic" },
    ],
    base_confidence: 0.3,
  },

  // ═══ 7. MUSCULOSKELETAL / SPINAL ═══
  {
    id: "spinal_compression",
    name: "Spinal / radicular pattern",
    symptoms: ["back pain", "leg pain", "numbness", "weakness", "radiating pain", "claudication", "difficulty walking", "tingling"],
    min_matches: 2,
    domains: [
      { node: "spinal", weight: 0.5 },
      { node: "musculoskeletal", weight: 0.4 },
    ],
    must_not_miss: [
      { name: "Spinal Stenosis", confidence: 0.20, domain: "spinal" },
      { name: "Herniated Disc", confidence: 0.15, domain: "musculoskeletal" },
      { name: "Cauda Equina Syndrome", confidence: 0.15, domain: "spinal" },
    ],
    base_confidence: 0.3,
  },

  // ═══ 8. PSYCHIATRIC / FUNCTIONAL ═══
  {
    id: "anxiety_panic",
    name: "Anxiety / panic pattern",
    symptoms: ["palpitations", "chest tightness", "shortness of breath", "dizziness", "trembling", "sweating", "numbness", "tingling", "fear", "impending doom"],
    min_matches: 3,
    domains: [
      { node: "psychiatric", weight: 0.5 },
      { node: "atypical_cardiac", weight: 0.3 },
    ],
    must_not_miss: [
      { name: "Panic Disorder", confidence: 0.20, domain: "psychiatric" },
      { name: "Generalized Anxiety Disorder", confidence: 0.15, domain: "psychiatric" },
    ],
    base_confidence: 0.3,
  },

  // ═══ 9. ENDOCRINE ═══
  {
    id: "thyroid_pattern",
    name: "Thyroid dysfunction pattern",
    symptoms: ["fatigue", "weight change", "tremor", "palpitations", "heat intolerance", "cold intolerance", "hair loss", "constipation", "anxiety"],
    min_matches: 3,
    domains: [
      { node: "endocrine", weight: 0.5 },
    ],
    must_not_miss: [
      { name: "Hyperthyroidism", confidence: 0.20, domain: "endocrine" },
      { name: "Hypothyroidism", confidence: 0.20, domain: "endocrine" },
    ],
    base_confidence: 0.3,
  },

  // ═══ 10. INFECTIOUS ═══
  {
    id: "systemic_infection",
    name: "Systemic infection pattern",
    symptoms: ["fever", "chills", "malaise", "body aches", "fatigue", "sweating", "tachycardia", "headache", "rigors", "confusion", "dizziness"],
    min_matches: 2,
    domains: [
      { node: "general_infectious", weight: 0.5 },
      { node: "sepsis", weight: 0.3 },
    ],
    context_boosters: {
      age_range: [55, 100] as [number, number],
      risk_keywords: ["diabetes", "diabetic", "immunocompromised", "chronic kidney", "dialysis"],
      history_keywords: ["diabetes", "diabetic", "dm", "type 2 diabetes", "transplant", "chemotherapy"],
    },
    must_not_miss: [
      { name: "Sepsis", confidence: 0.20, domain: "sepsis" },
      { name: "Endocarditis", confidence: 0.10, domain: "general_infectious" },
    ],
    base_confidence: 0.35,
  },
];

// ── Helpers ──

function collectSymptoms(ctx: ClinicalContext): Set<string> {
  const raw: string[] = [];
  if (ctx.chief_complaint) raw.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) raw.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) raw.push(...ctx.associated_symptoms);
  return new Set(raw.map(s => normalizeSymptom(s).toLowerCase()));
}

function fuzzyMatch(symptomSet: Set<string>, target: string): boolean {
  const t = target.toLowerCase();
  return [...symptomSet].some(s => s.includes(t) || t.includes(s));
}

function contextBoost(ctx: ClinicalContext, boosters?: ClinicalPattern["context_boosters"]): number {
  if (!boosters) return 0;
  let boost = 0;

  if (boosters.age_range && ctx.patient_age != null) {
    if (ctx.patient_age >= boosters.age_range[0] && ctx.patient_age <= boosters.age_range[1]) {
      boost += 0.1;
    }
  }

  const allHistory = [...(ctx.medical_history || []), ...(ctx.risk_factors || [])].map(h => h.toLowerCase());
  if (boosters.history_keywords) {
    if (boosters.history_keywords.some(k => allHistory.some(h => h.includes(k)))) {
      boost += 0.1;
    }
  }
  if (boosters.risk_keywords) {
    if (boosters.risk_keywords.some(k => allHistory.some(h => h.includes(k)))) {
      boost += 0.05;
    }
  }

  const meds = (ctx.current_medications || []).map(m => m.toLowerCase());
  if (boosters.medication_keywords) {
    if (boosters.medication_keywords.some(k => meds.some(m => m.includes(k)))) {
      boost += 0.05;
    }
  }

  return boost;
}

// ── Main Function ──

/**
 * Recognize multi-symptom clinical patterns and generate domain activations
 * + must-not-miss candidate injections.
 */
export function recognizeClinicalPatterns(ctx: ClinicalContext): PatternRecognitionResult {
  const symptomSet = collectSymptoms(ctx);
  const activation = createEmptyActivation();
  const patterns: PatternMatch[] = [];
  const injected: CandidateHint[] = [];

  for (const pattern of CLINICAL_PATTERNS) {
    // Count symptom matches
    const matched: string[] = [];
    for (const s of pattern.symptoms) {
      if (fuzzyMatch(symptomSet, s)) {
        matched.push(s);
      }
    }

    if (matched.length < pattern.min_matches) continue;

    // Calculate confidence with context boost
    const ctxBoost = contextBoost(ctx, pattern.context_boosters);
    const matchRatio = matched.length / pattern.symptoms.length;
    const confidence = Math.min(pattern.base_confidence + ctxBoost + (matchRatio * 0.2), 0.8);

    // Activate domains
    for (const domain of pattern.domains) {
      const boostedWeight = Math.min(domain.weight + ctxBoost, 0.9);
      activateNode(activation, domain.node, boostedWeight, `pattern_${pattern.id}`, "context_expander");
    }

    // Inject must-not-miss diagnoses
    for (const mnm of pattern.must_not_miss) {
      const existing = injected.find(c => c.diagnosis_name.toLowerCase() === mnm.name.toLowerCase());
      if (!existing) {
        injected.push({
          diagnosis_name: mnm.name,
          source: "context_signal",
          confidence: Math.max(0.05, mnm.confidence + ctxBoost),
          reasoning: `Pattern "${pattern.name}" matched [${matched.join(", ")}]`,
        });
      }
    }

    patterns.push({
      pattern_id: pattern.id,
      pattern_name: pattern.name,
      matched_symptoms: matched,
      confidence,
      domains_activated: pattern.domains.map(d => d.node),
      must_not_miss_diagnoses: pattern.must_not_miss.map(m => m.name),
    });
  }

  if (patterns.length > 0) {
    console.log(
      `[PatternRecognizer] Matched ${patterns.length} patterns: ` +
      `[${patterns.map(p => `${p.pattern_id}(${p.matched_symptoms.length}/${CLINICAL_PATTERNS.find(c => c.id === p.pattern_id)?.symptoms.length})`).join(", ")}]. ` +
      `Injected ${injected.length} MNM candidates.`
    );
  }

  return {
    activation,
    patterns_matched: patterns,
    injected_candidates: injected,
    pattern_count: patterns.length,
  };
}
