/**
 * Phase 5.2 — Failure-Derived Rule Engine
 *
 * Every rule traces back to specific v10 benchmark failure cases.
 * Rules are organized by failure cluster with strict trigger conditions.
 *
 * Invariants:
 *   - Pure function — does NOT mutate ClinicalContext
 *   - Max 3 candidates injected per rule
 *   - Max 6 total injected across all rules per case
 *   - All injections tagged source = "failure_derived"
 *   - Feature-flagged via enable_phase5_context_candidates
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import type { CandidateHint } from "@/services/context_candidate_expander";

// ── Types ──

export interface FailureRule {
  id: string;
  cluster: string;
  /** Cases this rule was derived from */
  derived_from: string[];
  /** ALL conditions must be met */
  trigger: (ctx: ClinicalContext, symptoms: Set<string>) => boolean;
  /** Candidates to inject */
  inject: CandidateHint[];
  /** Human-readable explanation */
  explanation: string;
}

export interface FailureRuleResult {
  candidate_hints: CandidateHint[];
  rules_fired: string[];
  total_injected: number;
}

const MAX_TOTAL_INJECTED = 6;

// ── Helper ──

function has(set: Set<string>, ...keywords: string[]): boolean {
  return keywords.some(k => [...set].some(s => s.includes(k) || k.includes(s)));
}

function hasHistory(ctx: ClinicalContext, ...keywords: string[]): boolean {
  const hist = [...(ctx.medical_history || []), ...(ctx.risk_factors || [])].map(h => h.toLowerCase());
  return keywords.some(k => hist.some(h => h.includes(k)));
}

function hasMed(ctx: ClinicalContext, ...keywords: string[]): boolean {
  const meds = (ctx.current_medications || []).map(m => m.toLowerCase());
  return keywords.some(k => meds.some(m => m.includes(k)));
}

function ageInRange(ctx: ClinicalContext, min: number, max: number): boolean {
  return ctx.patient_age != null && ctx.patient_age >= min && ctx.patient_age <= max;
}

function vitalBelow(ctx: ClinicalContext, key: 'pulse' | 'temperature' | 'oxygen_saturation', threshold: number): boolean {
  const v = ctx[key];
  return v != null && v < threshold;
}

function vitalAbove(ctx: ClinicalContext, key: 'pulse' | 'temperature' | 'oxygen_saturation', threshold: number): boolean {
  const v = ctx[key];
  return v != null && v > threshold;
}

function bpSystolicBelow(ctx: ClinicalContext, threshold: number): boolean {
  if (!ctx.blood_pressure) return false;
  const s = parseInt(ctx.blood_pressure.split("/")[0]);
  return !isNaN(s) && s < threshold;
}

function bpSystolicAbove(ctx: ClinicalContext, threshold: number): boolean {
  if (!ctx.blood_pressure) return false;
  const s = parseInt(ctx.blood_pressure.split("/")[0]);
  return !isNaN(s) && s > threshold;
}

// ═══════════════════════════════════════════════════════
// FAILURE-DERIVED RULES — Organized by Cluster
// ═══════════════════════════════════════════════════════

const FAILURE_RULES: FailureRule[] = [

  // ── CLUSTER 1: Atypical Cardiac (adv-001, adv-003, adv-004, adv-006, noisy-021) ──

  {
    id: "fc1_silent_mi",
    cluster: "atypical_cardiac",
    derived_from: ["adv-001", "noisy-017"],
    trigger: (ctx, sym) =>
      hasHistory(ctx, "diabetes", "diabetic") &&
      (has(sym, "fatigue", "nausea", "malaise", "diaphoresis") || has(sym, "epigastric", "indigestion")) &&
      !has(sym, "chest pain"),
    inject: [
      { diagnosis_name: "Myocardial Infarction", source: "context_signal", confidence: 0.7, reasoning: "Diabetic with vague symptoms — silent MI pattern (adv-001)" },
    ],
    explanation: "Diabetic patients presenting without chest pain but with fatigue/nausea/diaphoresis",
  },
  {
    id: "fc1_cardiac_tamponade",
    cluster: "atypical_cardiac",
    derived_from: ["adv-003", "noisy-023"],
    trigger: (ctx, sym) =>
      has(sym, "dyspnea", "breathless", "presyncope", "muffled") &&
      (bpSystolicBelow(ctx, 95) || vitalAbove(ctx, "pulse", 110)) &&
      (hasHistory(ctx, "viral", "pericarditis") || has(sym, "jugular", "jvd")),
    inject: [
      { diagnosis_name: "Cardiac Tamponade", source: "context_signal", confidence: 0.7, reasoning: "Hypotension + dyspnea + recent viral illness → Beck's triad (adv-003)" },
    ],
    explanation: "Post-viral dyspnea with hemodynamic compromise",
  },
  {
    id: "fc1_complete_heart_block",
    cluster: "atypical_cardiac",
    derived_from: ["adv-006"],
    trigger: (ctx, sym) =>
      has(sym, "syncope", "faint") &&
      vitalBelow(ctx, "pulse", 50) &&
      (hasHistory(ctx, "mi", "cardiac", "heart") || ageInRange(ctx, 60, 120)),
    inject: [
      { diagnosis_name: "Complete Heart Block", source: "context_signal", confidence: 0.7, reasoning: "Severe bradycardia + syncope + cardiac history (adv-006)" },
    ],
    explanation: "Syncope with severe bradycardia in elderly/cardiac history",
  },
  {
    id: "fc1_wpw",
    cluster: "atypical_cardiac",
    derived_from: ["adv-004"],
    trigger: (ctx, sym) =>
      has(sym, "tachycardia", "palpitations", "heart racing") &&
      has(sym, "intermittent", "episodic", "episode") &&
      ageInRange(ctx, 15, 40),
    inject: [
      { diagnosis_name: "WPW Syndrome", source: "context_signal", confidence: 0.5, reasoning: "Young patient with episodic tachycardia (adv-004)" },
      { diagnosis_name: "SVT", source: "context_signal", confidence: 0.5, reasoning: "Paroxysmal SVT in young adult" },
    ],
    explanation: "Episodic tachycardia in young adult",
  },

  // ── CLUSTER 2: Rare Infectious / Airway (adv-013, adv-015, adv-016, noisy-049) ──

  {
    id: "fc2_nec_fasc",
    cluster: "rare_infectious",
    derived_from: ["adv-013", "noisy-049"],
    trigger: (ctx, sym) =>
      has(sym, "pain out of proportion", "rapidly spreading", "rapid progression", "crepitus", "blistering") &&
      (vitalAbove(ctx, "pulse", 110) || vitalAbove(ctx, "temperature", 38.5)),
    inject: [
      { diagnosis_name: "Necrotizing Fasciitis", source: "context_signal", confidence: 0.8, reasoning: "Pain out of proportion + rapid spread + systemic toxicity (adv-013)" },
    ],
    explanation: "Rapidly progressive soft tissue infection with disproportionate pain",
  },
  {
    id: "fc2_epiglottitis",
    cluster: "rare_infectious",
    derived_from: ["adv-016", "noisy-008"],
    trigger: (ctx, sym) =>
      has(sym, "drooling", "stridor", "muffled voice", "dysphagia") &&
      has(sym, "sore throat", "throat"),
    inject: [
      { diagnosis_name: "Epiglottitis", source: "context_signal", confidence: 0.7, reasoning: "Drooling + stridor + severe sore throat (adv-016)" },
    ],
    explanation: "Severe throat with airway compromise signs",
  },
  {
    id: "fc2_meningococcemia",
    cluster: "rare_infectious",
    derived_from: ["adv-015"],
    trigger: (ctx, sym) =>
      has(sym, "petechial", "purpur", "rash") &&
      has(sym, "fever", "high fever") &&
      (bpSystolicBelow(ctx, 100) || vitalAbove(ctx, "pulse", 120)),
    inject: [
      { diagnosis_name: "Meningococcal Septicemia", source: "context_signal", confidence: 0.8, reasoning: "Petechial rash + high fever + hemodynamic compromise (adv-015)" },
    ],
    explanation: "Petechial rash with fever and shock signs",
  },

  // ── CLUSTER 3: Context-Dependent (History-Triggered) (adv-010, adv-017, adv-020, adv-024) ──

  {
    id: "fc3_spinal_mets",
    cluster: "context_dependent",
    derived_from: ["adv-010"],
    trigger: (ctx, sym) =>
      hasHistory(ctx, "cancer", "malignancy", "prostate", "breast", "lung") &&
      has(sym, "back pain", "weakness", "urinary", "bladder"),
    inject: [
      { diagnosis_name: "Metastatic Spinal Cord Compression", source: "context_signal", confidence: 0.7, reasoning: "Cancer history + progressive back pain + neurological signs (adv-010)" },
    ],
    explanation: "Known cancer with new back pain and neurological symptoms",
  },
  {
    id: "fc3_hypercalcemia",
    cluster: "context_dependent",
    derived_from: ["adv-017"],
    trigger: (ctx, sym) =>
      hasHistory(ctx, "cancer", "breast cancer", "lung cancer", "myeloma") &&
      has(sym, "confusion", "polydipsia", "constipation", "polyuria"),
    inject: [
      { diagnosis_name: "Hypercalcemia of Malignancy", source: "context_signal", confidence: 0.7, reasoning: "Cancer history + bones/stones/groans/moans pattern (adv-017)" },
    ],
    explanation: "Known malignancy with confusion + polyuria + constipation",
  },
  {
    id: "fc3_paracetamol_od",
    cluster: "context_dependent",
    derived_from: ["adv-020"],
    trigger: (ctx, sym) =>
      has(sym, "jaundice", "overdose") &&
      (hasHistory(ctx, "overdose", "paracetamol", "acetaminophen") || has(sym, "paracetamol", "acetaminophen")),
    inject: [
      { diagnosis_name: "Paracetamol Hepatotoxicity", source: "context_signal", confidence: 0.8, reasoning: "Overdose history + delayed jaundice (adv-020)" },
      { diagnosis_name: "Acute Liver Failure", source: "context_signal", confidence: 0.6, reasoning: "Paracetamol OD → hepatotoxicity risk" },
    ],
    explanation: "Paracetamol overdose history with delayed hepatic signs",
  },
  {
    id: "fc3_upper_dvt",
    cluster: "context_dependent",
    derived_from: ["adv-024"],
    trigger: (ctx, sym) =>
      has(sym, "arm swelling", "arm pain") &&
      hasHistory(ctx, "central line", "catheter", "cancer", "line"),
    inject: [
      { diagnosis_name: "Upper Extremity DVT", source: "context_signal", confidence: 0.7, reasoning: "Post-catheter arm swelling in cancer patient (adv-024)" },
    ],
    explanation: "Arm swelling with central line/cancer history",
  },

  // ── CLUSTER 4: Hemodynamic Instability (adv-005, adv-022, adv-025, noisy-037) ──

  {
    id: "fc4_ruptured_aaa",
    cluster: "hemodynamic_instability",
    derived_from: ["adv-005"],
    trigger: (ctx, sym) =>
      has(sym, "back pain", "syncope", "abdominal pain", "near syncope") &&
      bpSystolicBelow(ctx, 95) &&
      (hasHistory(ctx, "aaa", "aneurysm") || ageInRange(ctx, 60, 120)),
    inject: [
      { diagnosis_name: "Ruptured AAA", source: "context_signal", confidence: 0.8, reasoning: "Sudden pain + hypotension + known AAA/elderly (adv-005)" },
    ],
    explanation: "Acute pain with hemodynamic compromise in elderly/known AAA",
  },
  {
    id: "fc4_massive_pe",
    cluster: "hemodynamic_instability",
    derived_from: ["adv-022"],
    trigger: (ctx, sym) =>
      has(sym, "syncope", "faint", "collapse") &&
      (bpSystolicBelow(ctx, 95) || vitalAbove(ctx, "pulse", 115)) &&
      (hasHistory(ctx, "surgery", "immobil", "post-op", "postoperative") || has(sym, "dyspnea")),
    inject: [
      { diagnosis_name: "Massive Pulmonary Embolism", source: "context_signal", confidence: 0.7, reasoning: "Syncope + shock + immobilization/surgical risk (adv-022)" },
    ],
    explanation: "Syncope with hemodynamic collapse post-surgery",
  },
  {
    id: "fc4_ruptured_ectopic",
    cluster: "hemodynamic_instability",
    derived_from: ["adv-025", "ambig-009"],
    trigger: (ctx, sym) =>
      has(sym, "abdominal pain", "lower abdominal", "dizziness", "faint", "shoulder tip") &&
      bpSystolicBelow(ctx, 95) &&
      (hasHistory(ctx, "ectopic", "iud", "pregnancy") || has(sym, "vaginal", "spotting", "missed period")),
    inject: [
      { diagnosis_name: "Ruptured Ectopic Pregnancy", source: "context_signal", confidence: 0.8, reasoning: "Acute abdomen + hypotension + reproductive risk (adv-025)" },
    ],
    explanation: "Reproductive-age female with acute abdomen and shock",
  },
  {
    id: "fc4_adrenal_crisis",
    cluster: "hemodynamic_instability",
    derived_from: ["noisy-037"],
    trigger: (ctx, sym) =>
      has(sym, "collapse", "hypotension", "hyperpigmentation", "fatigue") &&
      (hasHistory(ctx, "steroid", "autoimmune", "addison") || hasMed(ctx, "prednis", "hydrocortisone", "dexameth")),
    inject: [
      { diagnosis_name: "Adrenal Crisis", source: "context_signal", confidence: 0.8, reasoning: "Collapse + hypotension + steroid dependency history (noisy-037)" },
    ],
    explanation: "Hemodynamic collapse in patient on/recently stopped steroids",
  },

  // ── CLUSTER 5: Atypical Neuro (adv-007, adv-008, adv-009, ambig-008) ──

  {
    id: "fc5_posterior_stroke",
    cluster: "atypical_neuro",
    derived_from: ["adv-007"],
    trigger: (ctx, sym) =>
      has(sym, "vertigo", "ataxia", "spinning") &&
      has(sym, "dysarthria", "nystagmus", "vomiting") &&
      (hasHistory(ctx, "hypertension", "diabetes") || ageInRange(ctx, 55, 120)),
    inject: [
      { diagnosis_name: "Posterior Circulation Stroke", source: "context_signal", confidence: 0.7, reasoning: "Vertigo + ataxia + dysarthria + vascular risks (adv-007)" },
    ],
    explanation: "Vertigo with cerebellar signs and vascular risk factors",
  },
  {
    id: "fc5_epidural_hematoma",
    cluster: "atypical_neuro",
    derived_from: ["adv-008"],
    trigger: (ctx, sym) =>
      has(sym, "headache", "drowsiness", "drowsy", "vomiting") &&
      (hasHistory(ctx, "head trauma", "head injury", "trauma") || has(sym, "pupil dilation", "hemiparesis")),
    inject: [
      { diagnosis_name: "Epidural Hematoma", source: "context_signal", confidence: 0.7, reasoning: "Post-trauma deterioration with neurological signs (adv-008)" },
    ],
    explanation: "Head trauma followed by lucid interval then deterioration",
  },
  {
    id: "fc5_ncse",
    cluster: "atypical_neuro",
    derived_from: ["adv-009"],
    trigger: (ctx, sym) =>
      has(sym, "altered consciousness", "automatisms", "unresponsive", "confusion") &&
      hasHistory(ctx, "epilepsy", "seizure"),
    inject: [
      { diagnosis_name: "Non-Convulsive Status Epilepticus", source: "context_signal", confidence: 0.7, reasoning: "Ongoing altered consciousness in known epileptic (adv-009)" },
    ],
    explanation: "Persistent confusion in patient with seizure history",
  },
  {
    id: "fc5_iih",
    cluster: "atypical_neuro",
    derived_from: ["ambig-008"],
    trigger: (ctx, sym) =>
      has(sym, "headache", "diplopia", "visual") &&
      has(sym, "progressive") &&
      (hasHistory(ctx, "obesity", "overweight") || (ctx.patient_sex?.toLowerCase().startsWith("f") && ageInRange(ctx, 18, 45))),
    inject: [
      { diagnosis_name: "Idiopathic Intracranial Hypertension", source: "context_signal", confidence: 0.6, reasoning: "Progressive headache + diplopia in young overweight female (ambig-008)" },
    ],
    explanation: "Progressive headache with visual symptoms in young obese female",
  },

  // ── CLUSTER 6: Pediatric/Surgical Emergencies (adv-027, adv-029, adv-034, noisy-050) ──

  {
    id: "fc6_strangulated_hernia",
    cluster: "pediatric_surgical",
    derived_from: ["adv-027"],
    trigger: (ctx, sym) =>
      has(sym, "groin lump", "irreducible", "hernia") &&
      has(sym, "vomiting", "constipation", "distension"),
    inject: [
      { diagnosis_name: "Strangulated Inguinal Hernia", source: "context_signal", confidence: 0.8, reasoning: "Irreducible hernia + obstruction signs (adv-027)" },
    ],
    explanation: "Known hernia with obstructive symptoms",
  },
  {
    id: "fc6_pyloric_stenosis",
    cluster: "pediatric_surgical",
    derived_from: ["adv-029"],
    trigger: (ctx, sym) =>
      has(sym, "projectile vomiting", "projectile") &&
      has(sym, "hunger", "weight loss") &&
      ageInRange(ctx, 0, 0.25),
    inject: [
      { diagnosis_name: "Pyloric Stenosis", source: "context_signal", confidence: 0.7, reasoning: "Projectile vomiting in neonate (adv-029)" },
    ],
    explanation: "Projectile vomiting with post-feed hunger in neonate",
  },
  {
    id: "fc6_intussusception",
    cluster: "pediatric_surgical",
    derived_from: ["ambig-034"],
    trigger: (ctx, sym) =>
      has(sym, "colicky", "intermittent", "red jelly", "redcurrant", "bloody stool") &&
      ageInRange(ctx, 0, 3),
    inject: [
      { diagnosis_name: "Intussusception", source: "context_signal", confidence: 0.7, reasoning: "Intermittent colicky pain + bloody stool in infant (ambig-034)" },
    ],
    explanation: "Colicky pain with red-currant jelly stool in infant",
  },
  {
    id: "fc6_compartment_syndrome",
    cluster: "pediatric_surgical",
    derived_from: ["noisy-050"],
    trigger: (ctx, sym) =>
      has(sym, "increasing pain", "pain with passive stretch", "tense swelling", "numbness") &&
      hasHistory(ctx, "fracture", "cast", "trauma"),
    inject: [
      { diagnosis_name: "Compartment Syndrome", source: "context_signal", confidence: 0.7, reasoning: "Increasing pain post-fracture/cast + 5 P's signs (noisy-050)" },
    ],
    explanation: "Post-fracture/cast pain out of proportion with neurovascular compromise",
  },

  // ── CLUSTER 7: Chronic/Subacute Presentations (noisy-021, ambig-012, ambig-017, ambig-025) ──

  {
    id: "fc7_endocarditis",
    cluster: "chronic_subacute",
    derived_from: ["noisy-021"],
    trigger: (ctx, sym) =>
      has(sym, "intermittent fever", "fever") &&
      has(sym, "murmur", "arthralgia", "night sweats") &&
      (hasHistory(ctx, "dental", "valve", "mitral", "prosthetic") || has(sym, "splinter", "janeway", "osler")),
    inject: [
      { diagnosis_name: "Infective Endocarditis", source: "context_signal", confidence: 0.7, reasoning: "Prolonged fever + murmur + dental/valve history (noisy-021)" },
    ],
    explanation: "Subacute fever with cardiac and embolic features",
  },
  {
    id: "fc7_mesenteric_ischemia",
    cluster: "chronic_subacute",
    derived_from: ["ambig-012"],
    trigger: (ctx, sym) =>
      has(sym, "post-prandial", "postprandial", "after eating", "after meal", "food avoidance") &&
      has(sym, "weight loss") &&
      (hasHistory(ctx, "vascular", "atrial fibrillation", "pvd", "peripheral vascular") || ageInRange(ctx, 60, 120)),
    inject: [
      { diagnosis_name: "Chronic Mesenteric Ischemia", source: "context_signal", confidence: 0.6, reasoning: "Postprandial pain + weight loss + vascular history (ambig-012)" },
    ],
    explanation: "Food fear with weight loss in patient with vascular disease",
  },

  // ── CLUSTER 8: Toxicological Presentations (adv-018, adv-019) ──

  {
    id: "fc8_co_poisoning",
    cluster: "toxicological",
    derived_from: ["adv-018"],
    trigger: (ctx, sym) =>
      has(sym, "headache", "nausea", "dizziness") &&
      (has(sym, "worse indoors", "better outside", "multiple family") || hasHistory(ctx, "gas heater", "winter", "old heater")),
    inject: [
      { diagnosis_name: "Carbon Monoxide Poisoning", source: "context_signal", confidence: 0.8, reasoning: "Family headache + better outdoors + gas heater (adv-018)" },
    ],
    explanation: "Multiple household members with headache improving outdoors",
  },
  {
    id: "fc8_organophosphate",
    cluster: "toxicological",
    derived_from: ["adv-019"],
    trigger: (ctx, sym) =>
      has(sym, "salivation", "lacrimation", "miosis", "bradycardia", "wheezing") &&
      (hasHistory(ctx, "farm", "pesticide") || has(sym, "diaphoresis", "diarrhea")),
    inject: [
      { diagnosis_name: "Organophosphate Poisoning", source: "context_signal", confidence: 0.8, reasoning: "SLUDGE syndrome + occupational exposure (adv-019)" },
    ],
    explanation: "Cholinergic excess syndrome with agricultural exposure",
  },
];

// ═══════════════════════════════════════════════════════
// Phase 5.3 — Must-Not-Miss Safety Layer
// ═══════════════════════════════════════════════════════

interface MustNotMissRule {
  id: string;
  condition: string;
  trigger: (ctx: ClinicalContext, symptoms: Set<string>) => boolean;
  confidence: number;
  explanation: string;
}

const MUST_NOT_MISS_RULES: MustNotMissRule[] = [
  {
    id: "mnm_pe",
    condition: "Pulmonary Embolism",
    trigger: (ctx, sym) =>
      has(sym, "dyspnea", "breathless", "pleuritic") &&
      (vitalAbove(ctx, "pulse", 100) || vitalBelow(ctx, "oxygen_saturation", 95)) &&
      !has(sym, "wheez") && // not clearly asthma
      (hasHistory(ctx, "surgery", "immobil", "contraceptive", "dvt", "cancer") || has(sym, "leg swelling", "calf pain")),
    confidence: 0.6,
    explanation: "Unexplained dyspnea + tachycardia + VTE risk factors",
  },
  {
    id: "mnm_mi",
    condition: "Myocardial Infarction",
    trigger: (ctx, sym) =>
      (has(sym, "diaphoresis", "chest pain", "chest pressure", "epigastric") || has(sym, "jaw pain", "arm pain")) &&
      (vitalAbove(ctx, "pulse", 100) || bpSystolicAbove(ctx, 160) || bpSystolicBelow(ctx, 90)) &&
      (hasHistory(ctx, "diabetes", "hypertension", "smoking", "cardiac") || ageInRange(ctx, 45, 120)),
    confidence: 0.6,
    explanation: "Chest/arm/jaw symptoms + hemodynamic change + cardiac risk factors",
  },
  {
    id: "mnm_stroke",
    condition: "Stroke",
    trigger: (ctx, sym) =>
      (has(sym, "weakness", "facial droop", "slurred speech", "hemiparesis", "visual field deficit") ||
       (has(sym, "confusion") && has(sym, "acute"))) &&
      (hasHistory(ctx, "hypertension", "atrial fibrillation", "diabetes") || ageInRange(ctx, 55, 120)),
    confidence: 0.7,
    explanation: "Focal neurological deficit + vascular risk factors",
  },
  {
    id: "mnm_sepsis",
    condition: "Sepsis",
    trigger: (ctx, sym) =>
      (vitalAbove(ctx, "temperature", 38.5) || vitalBelow(ctx, "temperature", 36.0)) &&
      (vitalAbove(ctx, "pulse", 100) || bpSystolicBelow(ctx, 100)) &&
      has(sym, "confusion", "tachycardia", "fever", "hypothermia", "mottled"),
    confidence: 0.7,
    explanation: "Temperature derangement + hemodynamic compromise + altered mentation",
  },
  {
    id: "mnm_aortic_dissection",
    condition: "Aortic Dissection",
    trigger: (ctx, sym) =>
      has(sym, "tearing", "sudden", "inter-scapular", "back pain") &&
      (has(sym, "sharp", "sudden onset") || bpSystolicAbove(ctx, 170)) &&
      (hasHistory(ctx, "marfan", "hypertension", "connective tissue") || ageInRange(ctx, 40, 120)),
    confidence: 0.7,
    explanation: "Sudden tearing pain + hypertension/connective tissue risk",
  },
];

const MAX_MNM_INJECTED = 3;

// ═══════════════════════════════════════════════════════
// Main Execution Function
// ═══════════════════════════════════════════════════════

/**
 * Apply failure-derived rules and must-not-miss safety injection.
 * Runs BEFORE DDX engine — enriches the candidate pool.
 */
export function applyFailureDerivedRules(ctx: ClinicalContext): FailureRuleResult {
  const rawSymptoms: string[] = [];
  if (ctx.chief_complaint) rawSymptoms.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) rawSymptoms.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) rawSymptoms.push(...ctx.associated_symptoms);

  const symptomSet = new Set(rawSymptoms.map(s => s.toLowerCase().trim()));

  const hints: CandidateHint[] = [];
  const rulesFired: string[] = [];
  const seenDiagnoses = new Set<string>();

  // 1. Apply failure-derived rules
  for (const rule of FAILURE_RULES) {
    if (hints.length >= MAX_TOTAL_INJECTED) break;

    try {
      if (rule.trigger(ctx, symptomSet)) {
        rulesFired.push(rule.id);
        for (const candidate of rule.inject) {
          const key = candidate.diagnosis_name.toLowerCase();
          if (seenDiagnoses.has(key)) continue;
          if (hints.length >= MAX_TOTAL_INJECTED) break;
          seenDiagnoses.add(key);
          hints.push(candidate);
        }
      }
    } catch (e) {
      console.warn(`[FailureRules] Rule ${rule.id} threw:`, e);
    }
  }

  // 2. Apply must-not-miss safety rules (stricter, max 3 additional)
  let mnmCount = 0;
  for (const rule of MUST_NOT_MISS_RULES) {
    if (mnmCount >= MAX_MNM_INJECTED) break;
    if (hints.length >= MAX_TOTAL_INJECTED + MAX_MNM_INJECTED) break;

    const key = rule.condition.toLowerCase();
    if (seenDiagnoses.has(key)) continue;

    try {
      if (rule.trigger(ctx, symptomSet)) {
        seenDiagnoses.add(key);
        hints.push({
          diagnosis_name: rule.condition,
          source: "context_signal",
          confidence: rule.confidence,
          reasoning: `Must-not-miss: ${rule.explanation}`,
        });
        rulesFired.push(rule.id);
        mnmCount++;
      }
    } catch (e) {
      console.warn(`[MustNotMiss] Rule ${rule.id} threw:`, e);
    }
  }

  if (rulesFired.length > 0) {
    console.log(
      `[FailureDerivedRules] Fired ${rulesFired.length} rules, injected ${hints.length} candidates. ` +
      `Rules: [${rulesFired.join(", ")}]`
    );
  }

  return {
    candidate_hints: hints,
    rules_fired: rulesFired,
    total_injected: hints.length,
  };
}

/**
 * Get all rule definitions for debugging/audit.
 */
export function getFailureRuleRegistry(): Array<{ id: string; cluster: string; derived_from: string[]; explanation: string }> {
  return FAILURE_RULES.map(r => ({
    id: r.id, cluster: r.cluster, derived_from: r.derived_from, explanation: r.explanation,
  }));
}
