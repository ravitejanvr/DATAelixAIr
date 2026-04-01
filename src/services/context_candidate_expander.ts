/**
 * Phase 5 — Context-Assisted Candidate Generation (KG-Native)
 *
 * Runs BEFORE DDX to expand the candidate pool using:
 *   1. Phenotype inference → cluster activation
 *   2. Rare condition matching → cluster activation
 *
 * KG-NATIVE: This module activates cluster NODES, not diagnoses.
 * The KG expander resolves nodes → diagnoses.
 *
 * Invariants:
 *   - Does NOT mutate ClinicalContext (pure function)
 *   - All activations are tagged for traceability
 *   - Max 8 cluster activations
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import { normalizeSymptom } from "@/services/context_engine/terminology_normalizer";
import { createEmptyActivation, activateNode, type KGActivation } from "@/services/kg/kg_activation";

// ── Types ──

/** Legacy type preserved for backward compatibility */
export interface CandidateHint {
  diagnosis_name: string;
  source: "phenotype_inference" | "rare_pattern" | "context_signal" | "symptom_cluster";
  confidence: number;
  reasoning: string;
}

export interface ExpansionResult {
  /** KG activation (cluster nodes) */
  activation: KGActivation;
  /** Original + expanded symptom set (deduplicated, normalized) */
  expanded_symptoms: string[];
  /** New symptoms added by expansion */
  added_symptoms: string[];
  /** Debug: which expansion rules fired */
  expansion_trace: string[];
}

// ── Phenotype Inference Rules ──

interface PhenotypeRule {
  id: string;
  conditions: {
    age_range?: [number, number];
    sex?: string;
    history_keywords?: string[];
    risk_keywords?: string[];
    medication_keywords?: string[];
    symptom_keywords?: string[];
    vital_conditions?: {
      temperature_above?: number;
      pulse_above?: number;
      bp_systolic_above?: number;
      spo2_below?: number;
    };
  };
  min_context_signals: number;
  inferred_symptoms?: string[];
  /** Cluster node to activate + weight */
  activate: { node: string; weight: number };
}

const PHENOTYPE_RULES: PhenotypeRule[] = [
  {
    id: "diabetic_infection",
    conditions: {
      history_keywords: ["diabetes", "diabetic", "dm", "type 2", "type 1", "insulin"],
      symptom_keywords: ["fever", "chills", "wound", "ulcer", "foot pain"],
      vital_conditions: { temperature_above: 37.8 },
    },
    min_context_signals: 2,
    inferred_symptoms: ["diabetic foot infection risk"],
    activate: { node: "diabetic", weight: 0.6 },
  },
  {
    id: "elderly_confusion",
    conditions: {
      age_range: [65, 120],
      symptom_keywords: ["confusion", "altered mental status", "disorientation"],
    },
    min_context_signals: 1,
    activate: { node: "elderly_confusion", weight: 0.6 },
  },
  {
    id: "young_female_abdominal",
    conditions: {
      age_range: [15, 45],
      sex: "female",
      symptom_keywords: ["abdominal pain", "pelvic pain", "lower abdominal pain"],
    },
    min_context_signals: 2,
    activate: { node: "obstetric", weight: 0.5 },
  },
  {
    id: "smoker_respiratory",
    conditions: {
      risk_keywords: ["smoking", "smoker", "tobacco", "cigarette"],
      symptom_keywords: ["cough", "dyspnea", "hemoptysis", "shortness of breath", "productive cough"],
    },
    min_context_signals: 1,
    activate: { node: "respiratory", weight: 0.5 },
  },
  {
    id: "hypertensive_emergency",
    conditions: {
      history_keywords: ["hypertension", "high blood pressure", "htn"],
      symptom_keywords: ["headache", "blurred vision", "chest pain"],
      vital_conditions: { bp_systolic_above: 180 },
    },
    min_context_signals: 2,
    activate: { node: "vascular", weight: 0.7 },
  },
  {
    id: "immunosuppressed_fever",
    conditions: {
      history_keywords: ["hiv", "aids", "transplant", "chemotherapy", "immunosuppressed", "immunodeficiency"],
      medication_keywords: ["methotrexate", "cyclosporine", "tacrolimus", "prednisone", "azathioprine"],
      symptom_keywords: ["fever", "weight loss", "night sweats"],
    },
    min_context_signals: 2,
    activate: { node: "sepsis", weight: 0.5 },
  },
  {
    id: "pediatric_rash_fever",
    conditions: {
      age_range: [0, 12],
      symptom_keywords: ["rash", "fever"],
    },
    min_context_signals: 1,
    activate: { node: "pediatric_ophtho", weight: 0.4 },
  },
  {
    id: "post_surgical_fever",
    conditions: {
      history_keywords: ["surgery", "post-op", "postoperative", "recent surgery"],
      symptom_keywords: ["fever", "wound", "pain"],
    },
    min_context_signals: 1,
    activate: { node: "vascular", weight: 0.5 },
  },
  {
    id: "pregnancy_preeclampsia",
    conditions: {
      history_keywords: ["pregnant", "pregnancy", "gravida"],
      symptom_keywords: ["headache", "visual disturbance", "edema", "blurred vision"],
      vital_conditions: { bp_systolic_above: 140 },
    },
    min_context_signals: 2,
    activate: { node: "obstetric", weight: 0.7 },
  },
  {
    id: "alcoholic_abdominal",
    conditions: {
      history_keywords: ["alcohol", "alcoholic", "heavy drinker", "cirrhosis", "liver disease"],
      symptom_keywords: ["abdominal pain", "nausea", "vomiting", "jaundice"],
    },
    min_context_signals: 1,
    activate: { node: "abdominal", weight: 0.5 },
  },
  // ── New rules for missing cluster activations ──
  {
    id: "joint_pain_pattern",
    conditions: {
      symptom_keywords: ["joint pain", "swollen joint", "knee pain", "arthralgia", "swelling", "knee swollen", "swollen knee"],
    },
    min_context_signals: 1,
    activate: { node: "musculoskeletal", weight: 0.5 },
  },
  {
    id: "syncope_dizziness_pattern",
    conditions: {
      symptom_keywords: ["syncope", "fainting", "dizziness", "lightheaded", "blackout", "presyncope", "vertigo", "collapse"],
    },
    min_context_signals: 1,
    activate: { node: "syncope", weight: 0.5 },
  },
  {
    id: "pelvic_urological",
    conditions: {
      symptom_keywords: ["pelvic pain", "dysuria", "urinary frequency", "perineal pain", "groin pain", "testicular pain"],
    },
    min_context_signals: 1,
    activate: { node: "renal_gu", weight: 0.5 },
  },
  {
    id: "psychiatric_somatic",
    conditions: {
      symptom_keywords: ["anxiety", "panic", "palpitations", "chronic pain", "multiple symptoms", "unexplained symptoms"],
    },
    min_context_signals: 1,
    activate: { node: "psychiatric", weight: 0.4 },
  },
  {
    id: "chest_wall_pain",
    conditions: {
      symptom_keywords: ["chest pain", "chest wall", "pleuritic", "costochondral", "tenderness"],
    },
    min_context_signals: 1,
    activate: { node: "musculoskeletal", weight: 0.4 },
  },
  {
    id: "back_pain_spinal",
    conditions: {
      symptom_keywords: ["back pain", "leg weakness", "claudication", "neurogenic", "numbness legs"],
    },
    min_context_signals: 1,
    activate: { node: "spinal", weight: 0.4 },
  },
  {
    id: "cardiac_rhythm_fatigue",
    conditions: {
      symptom_keywords: ["palpitations", "irregular heartbeat", "fatigue", "dyspnea on exertion", "exercise intolerance"],
    },
    min_context_signals: 1,
    activate: { node: "atypical_cardiac", weight: 0.5 },
  },
  {
    id: "lymphadenopathy_fever",
    conditions: {
      symptom_keywords: ["lymphadenopathy", "night sweats", "weight loss", "fever"],
    },
    min_context_signals: 2,
    activate: { node: "malignancy", weight: 0.5 },
  },
  // ── Broad symptom → domain activations ──
  {
    id: "fatigue_broad",
    conditions: {
      symptom_keywords: ["fatigue", "tiredness", "malaise", "lethargy", "weakness", "exhaustion"],
    },
    min_context_signals: 1,
    activate: { node: "general_infectious", weight: 0.3 },
  },
  {
    id: "fatigue_metabolic",
    conditions: {
      symptom_keywords: ["fatigue", "tiredness", "weight loss", "weight gain", "weakness"],
    },
    min_context_signals: 1,
    activate: { node: "metabolic", weight: 0.3 },
  },
  {
    id: "fatigue_hematological",
    conditions: {
      symptom_keywords: ["fatigue", "pallor", "weakness", "dizziness", "shortness of breath"],
    },
    min_context_signals: 1,
    activate: { node: "hematological", weight: 0.3 },
  },
  {
    id: "joint_autoimmune",
    conditions: {
      symptom_keywords: ["joint pain", "rash", "fatigue", "arthralgia", "muscle pain", "photosensitivity"],
    },
    min_context_signals: 1,
    activate: { node: "autoimmune", weight: 0.4 },
  },
  {
    id: "weight_loss_malignancy",
    conditions: {
      symptom_keywords: ["weight loss", "night sweats", "fatigue", "anorexia", "loss of appetite"],
    },
    min_context_signals: 2,
    activate: { node: "malignancy", weight: 0.4 },
  },
  {
    id: "edema_renal",
    conditions: {
      symptom_keywords: ["edema", "swelling", "oliguria", "decreased urine", "foamy urine", "leg swelling"],
    },
    min_context_signals: 1,
    activate: { node: "metabolic", weight: 0.4 },
  },
  {
    id: "anxiety_panic",
    conditions: {
      symptom_keywords: ["anxiety", "panic", "palpitations", "chest tightness", "hyperventilation", "trembling", "fear"],
    },
    min_context_signals: 1,
    activate: { node: "psychiatric", weight: 0.4 },
  },
  {
    id: "back_pain_broad",
    conditions: {
      symptom_keywords: ["back pain", "lower back pain", "sciatica", "leg numbness", "claudication"],
    },
    min_context_signals: 1,
    activate: { node: "spinal", weight: 0.4 },
  },
];

// ── Rare Condition Pattern Rules ──

interface RarePatternRule {
  id: string;
  required_symptoms: string[];
  supporting_signals?: {
    age_range?: [number, number];
    history_keywords?: string[];
    vital_conditions?: { temperature_above?: number; pulse_above?: number };
  };
  activate: { node: string; weight: number };
}

const RARE_PATTERN_RULES: RarePatternRule[] = [
  {
    id: "addisons",
    required_symptoms: ["fatigue", "weight loss", "hyperpigmentation"],
    activate: { node: "endocrine", weight: 0.5 },
  },
  {
    id: "pheochromocytoma",
    required_symptoms: ["headache", "palpitations", "diaphoresis"],
    supporting_signals: { vital_conditions: { pulse_above: 100 } },
    activate: { node: "pheochromocytoma", weight: 0.4 },
  },
  {
    id: "temporal_arteritis",
    required_symptoms: ["headache", "jaw claudication"],
    supporting_signals: { age_range: [50, 120] },
    activate: { node: "atypical_neuro", weight: 0.6 },
  },
  {
    id: "guillain_barre",
    required_symptoms: ["ascending weakness", "areflexia"],
    activate: { node: "atypical_neuro", weight: 0.5 },
  },
  {
    id: "nph",
    required_symptoms: ["gait disturbance", "urinary incontinence", "cognitive decline"],
    supporting_signals: { age_range: [60, 120] },
    activate: { node: "atypical_neuro", weight: 0.6 },
  },
  {
    id: "cushings",
    required_symptoms: ["weight gain", "moon face"],
    activate: { node: "endocrine", weight: 0.4 },
  },
  {
    id: "myasthenia",
    required_symptoms: ["ptosis", "diplopia", "fatigue"],
    activate: { node: "atypical_neuro", weight: 0.5 },
  },
  {
    id: "peritonsillar_abscess",
    required_symptoms: ["sore throat", "trismus", "muffled voice"],
    activate: { node: "rare_infectious", weight: 0.6 },
  },
  {
    id: "ms_pattern",
    required_symptoms: ["vision loss", "numbness", "weakness"],
    activate: { node: "atypical_neuro", weight: 0.5 },
  },
  {
    id: "seizure_neuro",
    required_symptoms: ["seizure", "convulsion", "loss of consciousness"],
    activate: { node: "atypical_neuro", weight: 0.5 },
  },
  {
    id: "mononucleosis",
    required_symptoms: ["sore throat", "lymphadenopathy", "fatigue"],
    activate: { node: "rare_infectious", weight: 0.4 },
  },
  {
    id: "perforated_viscus",
    required_symptoms: ["severe abdominal pain", "rigidity"],
    activate: { node: "abdominal", weight: 0.6 },
  },
];

const MAX_ACTIVATIONS = 8;

// ── Helper Functions ──

function matchesKeywords(haystack: string[], needles: string[]): boolean {
  const lower = haystack.map(h => h.toLowerCase());
  return needles.some(n => lower.some(h => h.includes(n.toLowerCase())));
}

function matchesVitals(
  ctx: ClinicalContext,
  conditions?: { temperature_above?: number; pulse_above?: number; bp_systolic_above?: number; spo2_below?: number },
): boolean {
  if (!conditions) return true;
  let matched = 0;
  let checked = 0;
  if (conditions.temperature_above != null) {
    checked++;
    if (ctx.temperature != null && ctx.temperature > conditions.temperature_above) matched++;
  }
  if (conditions.pulse_above != null) {
    checked++;
    if (ctx.pulse != null && ctx.pulse > conditions.pulse_above) matched++;
  }
  if (conditions.bp_systolic_above != null) {
    checked++;
    const bp = ctx.blood_pressure;
    if (bp) {
      const systolic = parseInt(bp.split("/")[0]);
      if (!isNaN(systolic) && systolic > conditions.bp_systolic_above) matched++;
    }
  }
  if (conditions.spo2_below != null) {
    checked++;
    if (ctx.oxygen_saturation != null && ctx.oxygen_saturation < conditions.spo2_below) matched++;
  }
  return checked === 0 || matched > 0;
}

// ── Main Expansion Function ──

/**
 * Expand candidate pool using clinical context intelligence.
 * Returns KG cluster activations (NOT diagnosis candidates).
 */
export function expandCandidatesFromContext(ctx: ClinicalContext): ExpansionResult {
  const trace: string[] = [];
  const addedSymptoms: string[] = [];
  const activation = createEmptyActivation();

  // Collect all input symptoms (normalized)
  const rawSymptoms: string[] = [];
  if (ctx.chief_complaint) rawSymptoms.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) rawSymptoms.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) rawSymptoms.push(...ctx.associated_symptoms);

  const normalizedSymptoms = [...new Set(rawSymptoms.map(s => normalizeSymptom(s)))];
  const symptomSet = new Set(normalizedSymptoms.map(s => s.toLowerCase()));

  // 1. Phenotype Inference → cluster activation
  for (const rule of PHENOTYPE_RULES) {
    if (activation.nodes.size >= MAX_ACTIVATIONS) break;
    const c = rule.conditions;
    let signalCount = 0;

    if (c.age_range && ctx.patient_age != null) {
      if (ctx.patient_age >= c.age_range[0] && ctx.patient_age <= c.age_range[1]) signalCount++;
    }
    if (c.sex && ctx.patient_sex) {
      if (ctx.patient_sex.toLowerCase().startsWith(c.sex.toLowerCase())) signalCount++;
    }
    if (c.history_keywords) {
      if (matchesKeywords(ctx.medical_history || [], c.history_keywords)) signalCount++;
    }
    if (c.risk_keywords) {
      if (matchesKeywords(ctx.risk_factors || [], c.risk_keywords)) signalCount++;
    }
    if (c.medication_keywords) {
      if (matchesKeywords(ctx.current_medications || [], c.medication_keywords)) signalCount++;
    }
    if (c.vital_conditions) {
      if (matchesVitals(ctx, c.vital_conditions)) signalCount++;
    }
    if (c.symptom_keywords) {
      const hasSymptom = c.symptom_keywords.some(k =>
        [...symptomSet].some(s => s.includes(k.toLowerCase()) || k.toLowerCase().includes(s))
      );
      if (!hasSymptom) continue;
    }

    if (signalCount >= rule.min_context_signals) {
      trace.push(`phenotype:${rule.id} (signals=${signalCount})`);
      activateNode(activation, rule.activate.node, rule.activate.weight, rule.id, "phenotype");

      if (rule.inferred_symptoms) {
        for (const s of rule.inferred_symptoms) {
          const norm = normalizeSymptom(s);
          if (!symptomSet.has(norm.toLowerCase())) {
            symptomSet.add(norm.toLowerCase());
            addedSymptoms.push(norm);
          }
        }
      }
    }
  }

  // 2. Rare Condition Pattern Matching → cluster activation
  for (const rule of RARE_PATTERN_RULES) {
    if (activation.nodes.size >= MAX_ACTIVATIONS) break;

    const allRequired = rule.required_symptoms.every(rs =>
      [...symptomSet].some(s => s.includes(rs.toLowerCase()) || rs.toLowerCase().includes(s))
    );
    if (!allRequired) continue;

    let supportMatch = true;
    if (rule.supporting_signals) {
      if (rule.supporting_signals.age_range && ctx.patient_age != null) {
        if (ctx.patient_age < rule.supporting_signals.age_range[0] || ctx.patient_age > rule.supporting_signals.age_range[1]) {
          supportMatch = false;
        }
      }
      if (rule.supporting_signals.vital_conditions) {
        if (!matchesVitals(ctx, rule.supporting_signals.vital_conditions)) {
          supportMatch = false;
        }
      }
    }

    if (supportMatch) {
      activateNode(activation, rule.activate.node, rule.activate.weight, rule.id, "rare_pattern");
      trace.push(`rare:${rule.id}`);
    }
  }

  const expandedSymptoms = [
    ...normalizedSymptoms,
    ...addedSymptoms.filter(s => !normalizedSymptoms.includes(s)),
  ];

  if (trace.length > 0) {
    console.log(
      `[ContextExpander] Fired ${trace.length} rules. ` +
      `Activated ${activation.nodes.size} clusters, added ${addedSymptoms.length} symptoms. ` +
      `Rules: [${trace.join(", ")}]`
    );
  }

  return {
    activation,
    expanded_symptoms: expandedSymptoms,
    added_symptoms: addedSymptoms,
    expansion_trace: trace,
  };
}
