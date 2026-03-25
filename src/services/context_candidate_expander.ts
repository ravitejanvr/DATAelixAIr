/**
 * Phase 5 — Context-Assisted Candidate Generation
 *
 * Runs BEFORE DDX to expand the candidate pool using:
 *   1. KG synonym expansion — ensures normalized symptoms reach the KG
 *   2. Phenotype inference — infers latent conditions from context signals
 *   3. Rare condition mapping — pattern-matches rare presentations
 *   4. Context-driven candidate hints — pre-seeds DDX with likely diagnoses
 *
 * Output: An enriched symptom list + candidate hints injected into DDX input.
 * Feature-flagged via `enable_phase5_context_candidates`.
 *
 * Invariants:
 *   - Does NOT modify ClinicalContext (pure function)
 *   - All expansions are tagged for traceability
 *   - Max 8 candidate hints (DDX still ranks them)
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import { normalizeSymptom } from "@/services/context_engine/terminology_normalizer";

// ── Types ──

export interface CandidateHint {
  diagnosis_name: string;
  source: "phenotype_inference" | "rare_pattern" | "context_signal" | "symptom_cluster";
  confidence: number; // 0-1
  reasoning: string;
}

export interface ExpansionResult {
  /** Original + expanded symptom set (deduplicated, normalized) */
  expanded_symptoms: string[];
  /** New symptoms added by expansion */
  added_symptoms: string[];
  /** Pre-seeded candidate hints for DDX */
  candidate_hints: CandidateHint[];
  /** Debug: which expansion rules fired */
  expansion_trace: string[];
}

// ── Phenotype Inference Rules ──
// Maps context signal combinations → inferred symptoms/candidates

interface PhenotypeRule {
  id: string;
  /** Conditions to check (ALL must match) */
  conditions: {
    age_range?: [number, number];
    sex?: string;
    history_keywords?: string[];     // any match in medical_history
    risk_keywords?: string[];        // any match in risk_factors
    medication_keywords?: string[];  // any match in current_medications
    symptom_keywords?: string[];     // any match in symptoms (min 1)
    vital_conditions?: {
      temperature_above?: number;
      pulse_above?: number;
      bp_systolic_above?: number;
      spo2_below?: number;
    };
  };
  /** Min conditions that must match (excluding symptom_keywords which always required if present) */
  min_context_signals: number;
  /** Symptoms to add to the pool */
  inferred_symptoms?: string[];
  /** Candidate diagnoses to hint */
  candidate_hints: CandidateHint[];
}

const PHENOTYPE_RULES: PhenotypeRule[] = [
  // ── Diabetic patient with infection signs ──
  {
    id: "diabetic_infection",
    conditions: {
      history_keywords: ["diabetes", "diabetic", "dm", "type 2", "type 1", "insulin"],
      symptom_keywords: ["fever", "chills", "wound", "ulcer", "foot pain"],
      vital_conditions: { temperature_above: 37.8 },
    },
    min_context_signals: 2,
    inferred_symptoms: ["diabetic foot infection risk"],
    candidate_hints: [
      { diagnosis_name: "Diabetic Foot Infection", source: "phenotype_inference", confidence: 0.6, reasoning: "Diabetic patient with infection signs" },
      { diagnosis_name: "Osteomyelitis", source: "phenotype_inference", confidence: 0.4, reasoning: "Diabetic with possible deep infection" },
    ],
  },
  // ── Elderly + confusion + fever → delirium/UTI/sepsis ──
  {
    id: "elderly_confusion",
    conditions: {
      age_range: [65, 120],
      symptom_keywords: ["confusion", "altered mental status", "disorientation"],
    },
    min_context_signals: 1,
    candidate_hints: [
      { diagnosis_name: "Urinary Tract Infection", source: "phenotype_inference", confidence: 0.5, reasoning: "Elderly patient with confusion — UTI is common cause" },
      { diagnosis_name: "Delirium", source: "phenotype_inference", confidence: 0.6, reasoning: "Confusion in elderly suggests delirium workup" },
    ],
  },
  // ── Young female + abdominal pain → ectopic/ovarian torsion ──
  {
    id: "young_female_abdominal",
    conditions: {
      age_range: [15, 45],
      sex: "female",
      symptom_keywords: ["abdominal pain", "pelvic pain", "lower abdominal pain"],
    },
    min_context_signals: 2,
    candidate_hints: [
      { diagnosis_name: "Ectopic Pregnancy", source: "phenotype_inference", confidence: 0.5, reasoning: "Reproductive-age female with abdominal pain" },
      { diagnosis_name: "Ovarian Torsion", source: "phenotype_inference", confidence: 0.4, reasoning: "Acute lower abdominal pain in young female" },
    ],
  },
  // ── Smoker + respiratory symptoms → COPD/Lung cancer ──
  {
    id: "smoker_respiratory",
    conditions: {
      risk_keywords: ["smoking", "smoker", "tobacco", "cigarette"],
      symptom_keywords: ["cough", "dyspnea", "hemoptysis", "shortness of breath", "productive cough"],
    },
    min_context_signals: 1,
    candidate_hints: [
      { diagnosis_name: "COPD Exacerbation", source: "phenotype_inference", confidence: 0.5, reasoning: "Smoker with respiratory symptoms" },
      { diagnosis_name: "Lung Cancer", source: "phenotype_inference", confidence: 0.3, reasoning: "Smoker with persistent respiratory symptoms" },
    ],
  },
  // ── Hypertensive + headache + visual disturbance → hypertensive emergency ──
  {
    id: "hypertensive_emergency",
    conditions: {
      history_keywords: ["hypertension", "high blood pressure", "htn"],
      symptom_keywords: ["headache", "blurred vision", "chest pain"],
      vital_conditions: { bp_systolic_above: 180 },
    },
    min_context_signals: 2,
    candidate_hints: [
      { diagnosis_name: "Hypertensive Emergency", source: "phenotype_inference", confidence: 0.7, reasoning: "Known hypertensive with acute symptoms and elevated BP" },
    ],
  },
  // ── Immunosuppressed + fever → opportunistic infection ──
  {
    id: "immunosuppressed_fever",
    conditions: {
      history_keywords: ["hiv", "aids", "transplant", "chemotherapy", "immunosuppressed", "immunodeficiency"],
      medication_keywords: ["methotrexate", "cyclosporine", "tacrolimus", "prednisone", "azathioprine"],
      symptom_keywords: ["fever", "weight loss", "night sweats"],
    },
    min_context_signals: 2,
    candidate_hints: [
      { diagnosis_name: "Opportunistic Infection", source: "phenotype_inference", confidence: 0.5, reasoning: "Immunosuppressed patient with systemic symptoms" },
      { diagnosis_name: "Tuberculosis", source: "phenotype_inference", confidence: 0.4, reasoning: "Immunocompromised with constitutional symptoms" },
    ],
  },
  // ── Child with rash + fever → Kawasaki/measles ──
  {
    id: "pediatric_rash_fever",
    conditions: {
      age_range: [0, 12],
      symptom_keywords: ["rash", "fever"],
    },
    min_context_signals: 1,
    candidate_hints: [
      { diagnosis_name: "Kawasaki Disease", source: "phenotype_inference", confidence: 0.4, reasoning: "Pediatric patient with fever and rash" },
      { diagnosis_name: "Measles", source: "phenotype_inference", confidence: 0.3, reasoning: "Child with rash and fever" },
    ],
  },
  // ── Post-surgical patient with fever ──
  {
    id: "post_surgical_fever",
    conditions: {
      history_keywords: ["surgery", "post-op", "postoperative", "recent surgery"],
      symptom_keywords: ["fever", "wound", "pain"],
    },
    min_context_signals: 1,
    candidate_hints: [
      { diagnosis_name: "Surgical Site Infection", source: "phenotype_inference", confidence: 0.5, reasoning: "Post-surgical patient with fever" },
      { diagnosis_name: "Deep Vein Thrombosis", source: "phenotype_inference", confidence: 0.4, reasoning: "Post-surgical patient — DVT risk elevated" },
    ],
  },
  // ── Pregnant + headache + high BP → pre-eclampsia ──
  {
    id: "pregnancy_preeclampsia",
    conditions: {
      history_keywords: ["pregnant", "pregnancy", "gravida"],
      symptom_keywords: ["headache", "visual disturbance", "edema", "blurred vision"],
      vital_conditions: { bp_systolic_above: 140 },
    },
    min_context_signals: 2,
    candidate_hints: [
      { diagnosis_name: "Pre-eclampsia", source: "phenotype_inference", confidence: 0.7, reasoning: "Pregnant patient with hypertension and neurological symptoms" },
      { diagnosis_name: "HELLP Syndrome", source: "phenotype_inference", confidence: 0.4, reasoning: "Possible severe pre-eclampsia variant" },
    ],
  },
  // ── Alcoholic + abdominal pain ──
  {
    id: "alcoholic_abdominal",
    conditions: {
      history_keywords: ["alcohol", "alcoholic", "heavy drinker", "cirrhosis", "liver disease"],
      symptom_keywords: ["abdominal pain", "nausea", "vomiting", "jaundice"],
    },
    min_context_signals: 1,
    candidate_hints: [
      { diagnosis_name: "Alcoholic Hepatitis", source: "phenotype_inference", confidence: 0.5, reasoning: "History of alcohol use with abdominal/GI symptoms" },
      { diagnosis_name: "Acute Pancreatitis", source: "phenotype_inference", confidence: 0.5, reasoning: "Alcohol is leading cause of pancreatitis" },
    ],
  },
];

// ── Rare Condition Pattern Rules ──

interface RarePatternRule {
  id: string;
  /** ALL of these symptom keywords must be present */
  required_symptoms: string[];
  /** Additional context signals (any match) */
  supporting_signals?: {
    age_range?: [number, number];
    history_keywords?: string[];
    vital_conditions?: { temperature_above?: number; pulse_above?: number };
  };
  candidate: CandidateHint;
}

const RARE_PATTERN_RULES: RarePatternRule[] = [
  {
    id: "addisons",
    required_symptoms: ["fatigue", "weight loss", "hyperpigmentation"],
    candidate: { diagnosis_name: "Adrenal Insufficiency", source: "rare_pattern", confidence: 0.5, reasoning: "Triad: fatigue + weight loss + hyperpigmentation" },
  },
  {
    id: "pheochromocytoma",
    required_symptoms: ["headache", "palpitations", "diaphoresis"],
    supporting_signals: { vital_conditions: { pulse_above: 100 } },
    candidate: { diagnosis_name: "Pheochromocytoma", source: "rare_pattern", confidence: 0.4, reasoning: "Classic triad: episodic headache + palpitations + sweating" },
  },
  {
    id: "temporal_arteritis",
    required_symptoms: ["headache", "jaw claudication"],
    supporting_signals: { age_range: [50, 120] },
    candidate: { diagnosis_name: "Giant Cell Arteritis", source: "rare_pattern", confidence: 0.6, reasoning: "Headache + jaw claudication in elderly" },
  },
  {
    id: "guillain_barre",
    required_symptoms: ["ascending weakness", "areflexia"],
    candidate: { diagnosis_name: "Guillain-Barré Syndrome", source: "rare_pattern", confidence: 0.5, reasoning: "Ascending weakness + areflexia pattern" },
  },
  {
    id: "nph",
    required_symptoms: ["gait disturbance", "urinary incontinence", "cognitive decline"],
    supporting_signals: { age_range: [60, 120] },
    candidate: { diagnosis_name: "Normal Pressure Hydrocephalus", source: "rare_pattern", confidence: 0.6, reasoning: "Classic Hakim triad in elderly" },
  },
  {
    id: "cushings",
    required_symptoms: ["weight gain", "moon face"],
    candidate: { diagnosis_name: "Cushing Syndrome", source: "rare_pattern", confidence: 0.4, reasoning: "Weight gain + moon facies" },
  },
  {
    id: "myasthenia",
    required_symptoms: ["ptosis", "diplopia", "fatigue"],
    candidate: { diagnosis_name: "Myasthenia Gravis", source: "rare_pattern", confidence: 0.5, reasoning: "Fluctuating weakness + ptosis + diplopia" },
  },
  {
    id: "peritonsillar_abscess",
    required_symptoms: ["sore throat", "trismus", "muffled voice"],
    candidate: { diagnosis_name: "Peritonsillar Abscess", source: "rare_pattern", confidence: 0.6, reasoning: "Severe sore throat + trismus + hot potato voice" },
  },
];

const MAX_CANDIDATE_HINTS = 8;

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
 * Runs BEFORE DDX engine — enriches symptoms and pre-seeds candidate hints.
 */
export function expandCandidatesFromContext(ctx: ClinicalContext): ExpansionResult {
  const trace: string[] = [];
  const addedSymptoms: string[] = [];
  const hints: CandidateHint[] = [];
  const seenHints = new Set<string>();

  // Collect all input symptoms (normalized)
  const rawSymptoms: string[] = [];
  if (ctx.chief_complaint) rawSymptoms.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) rawSymptoms.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) rawSymptoms.push(...ctx.associated_symptoms);

  const normalizedSymptoms = [...new Set(rawSymptoms.map(s => normalizeSymptom(s)))];
  const symptomSet = new Set(normalizedSymptoms.map(s => s.toLowerCase()));

  // 1. Phenotype Inference
  for (const rule of PHENOTYPE_RULES) {
    const c = rule.conditions;
    let signalCount = 0;

    // Check age
    if (c.age_range && ctx.patient_age != null) {
      if (ctx.patient_age >= c.age_range[0] && ctx.patient_age <= c.age_range[1]) signalCount++;
    }
    // Check sex
    if (c.sex && ctx.patient_sex) {
      if (ctx.patient_sex.toLowerCase().startsWith(c.sex.toLowerCase())) signalCount++;
    }
    // Check history
    if (c.history_keywords) {
      if (matchesKeywords(ctx.medical_history || [], c.history_keywords)) signalCount++;
    }
    // Check risk factors
    if (c.risk_keywords) {
      if (matchesKeywords(ctx.risk_factors || [], c.risk_keywords)) signalCount++;
    }
    // Check medications
    if (c.medication_keywords) {
      if (matchesKeywords(ctx.current_medications || [], c.medication_keywords)) signalCount++;
    }
    // Check vitals
    if (c.vital_conditions) {
      if (matchesVitals(ctx, c.vital_conditions)) signalCount++;
    }
    // Check symptoms (REQUIRED if present in rule)
    if (c.symptom_keywords) {
      const hasSymptom = c.symptom_keywords.some(k =>
        [...symptomSet].some(s => s.includes(k.toLowerCase()) || k.toLowerCase().includes(s))
      );
      if (!hasSymptom) continue; // Symptoms are mandatory when specified
    }

    if (signalCount >= rule.min_context_signals) {
      trace.push(`phenotype:${rule.id} (signals=${signalCount})`);

      // Add inferred symptoms
      if (rule.inferred_symptoms) {
        for (const s of rule.inferred_symptoms) {
          const norm = normalizeSymptom(s);
          if (!symptomSet.has(norm.toLowerCase())) {
            symptomSet.add(norm.toLowerCase());
            addedSymptoms.push(norm);
          }
        }
      }

      // Add candidate hints
      for (const h of rule.candidate_hints) {
        const key = h.diagnosis_name.toLowerCase();
        if (!seenHints.has(key) && hints.length < MAX_CANDIDATE_HINTS) {
          seenHints.add(key);
          hints.push(h);
        }
      }
    }
  }

  // 2. Rare Condition Pattern Matching
  for (const rule of RARE_PATTERN_RULES) {
    const allRequired = rule.required_symptoms.every(rs =>
      [...symptomSet].some(s => s.includes(rs.toLowerCase()) || rs.toLowerCase().includes(s))
    );
    if (!allRequired) continue;

    // Check supporting signals
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
      const key = rule.candidate.diagnosis_name.toLowerCase();
      if (!seenHints.has(key) && hints.length < MAX_CANDIDATE_HINTS) {
        seenHints.add(key);
        hints.push(rule.candidate);
        trace.push(`rare:${rule.id}`);
      }
    }
  }

  // 3. Build expanded symptom list
  const expandedSymptoms = [
    ...normalizedSymptoms,
    ...addedSymptoms.filter(s => !normalizedSymptoms.includes(s)),
  ];

  if (trace.length > 0) {
    console.log(
      `[ContextExpander] Fired ${trace.length} rules. ` +
      `Added ${addedSymptoms.length} symptoms, ${hints.length} candidate hints. ` +
      `Rules: [${trace.join(", ")}]`
    );
  }

  return {
    expanded_symptoms: expandedSymptoms,
    added_symptoms: addedSymptoms,
    candidate_hints: hints,
    expansion_trace: trace,
  };
}
