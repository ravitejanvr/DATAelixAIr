/**
 * Phase 5.2 — Failure-Derived Rule Engine (KG-Native)
 *
 * Every rule traces back to specific v10 benchmark failure cases.
 * Rules are organized by failure cluster with strict trigger conditions.
 *
 * KG-NATIVE: Rules activate cluster NODES, not diagnoses directly.
 * The KG expander resolves nodes → diagnoses.
 *
 * Invariants:
 *   - Pure function — does NOT mutate ClinicalContext
 *   - Rules are pattern detectors ONLY (no diagnosis injection)
 *   - Max 6 cluster activations from failure rules
 *   - Max 3 cluster activations from must-not-miss rules
 *   - Feature-flagged via enable_phase5_context_candidates
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import { createEmptyActivation, activateNode, type KGActivation } from "@/services/kg/kg_activation";

// ── Types ──

export interface FailureRule {
  id: string;
  cluster: string;
  /** Cases this rule was derived from */
  derived_from: string[];
  /** ALL conditions must be met */
  trigger: (ctx: ClinicalContext, symptoms: Set<string>) => boolean;
  /** Cluster node to activate + weight */
  activate: { node: string; weight: number };
  /** Human-readable explanation */
  explanation: string;
}

export interface FailureRuleResult {
  /** KG activation (cluster nodes, not diagnoses) */
  activation: KGActivation;
  rules_fired: string[];
  total_activations: number;
}

const MAX_FAILURE_ACTIVATIONS = 6;

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
// FAILURE-DERIVED RULES — Activate clusters, NOT diagnoses
// ═══════════════════════════════════════════════════════

const FAILURE_RULES: FailureRule[] = [

  // ── CLUSTER 1: Atypical Cardiac ──
  {
    id: "fc1_silent_mi",
    cluster: "atypical_cardiac",
    derived_from: ["adv-001", "noisy-017"],
    trigger: (ctx, sym) =>
      hasHistory(ctx, "diabetes", "diabetic") &&
      (has(sym, "fatigue", "nausea", "malaise", "diaphoresis") || has(sym, "epigastric", "indigestion")) &&
      !has(sym, "chest pain"),
    activate: { node: "atypical_cardiac", weight: 0.7 },
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
    activate: { node: "atypical_cardiac", weight: 0.7 },
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
    activate: { node: "atypical_cardiac", weight: 0.7 },
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
    activate: { node: "atypical_cardiac", weight: 0.5 },
    explanation: "Episodic tachycardia in young adult",
  },

  // ── CLUSTER 2: Rare Infectious / Airway ──
  {
    id: "fc2_nec_fasc",
    cluster: "rare_infectious",
    derived_from: ["adv-013", "noisy-049"],
    trigger: (ctx, sym) =>
      has(sym, "pain out of proportion", "rapidly spreading", "rapid progression", "crepitus", "blistering") &&
      (vitalAbove(ctx, "pulse", 110) || vitalAbove(ctx, "temperature", 38.5)),
    activate: { node: "rare_infectious", weight: 0.8 },
    explanation: "Rapidly progressive soft tissue infection with disproportionate pain",
  },
  {
    id: "fc2_epiglottitis",
    cluster: "rare_infectious",
    derived_from: ["adv-016", "noisy-008"],
    trigger: (ctx, sym) =>
      has(sym, "drooling", "stridor", "muffled voice", "dysphagia") &&
      has(sym, "sore throat", "throat"),
    activate: { node: "rare_infectious", weight: 0.7 },
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
    activate: { node: "rare_infectious", weight: 0.8 },
    explanation: "Petechial rash with fever and shock signs",
  },

  // ── CLUSTER 3: Context-Dependent ──
  {
    id: "fc3_spinal_mets",
    cluster: "context_dependent",
    derived_from: ["adv-010"],
    trigger: (ctx, sym) =>
      hasHistory(ctx, "cancer", "malignancy", "prostate", "breast", "lung") &&
      has(sym, "back pain", "weakness", "urinary", "bladder"),
    activate: { node: "context_dependent", weight: 0.7 },
    explanation: "Known cancer with new back pain and neurological symptoms",
  },
  {
    id: "fc3_hypercalcemia",
    cluster: "context_dependent",
    derived_from: ["adv-017"],
    trigger: (ctx, sym) =>
      hasHistory(ctx, "cancer", "breast cancer", "lung cancer", "myeloma") &&
      has(sym, "confusion", "polydipsia", "constipation", "polyuria"),
    activate: { node: "context_dependent", weight: 0.7 },
    explanation: "Known malignancy with confusion + polyuria + constipation",
  },
  {
    id: "fc3_paracetamol_od",
    cluster: "context_dependent",
    derived_from: ["adv-020"],
    trigger: (ctx, sym) =>
      has(sym, "jaundice", "overdose") &&
      (hasHistory(ctx, "overdose", "paracetamol", "acetaminophen") || has(sym, "paracetamol", "acetaminophen")),
    activate: { node: "context_dependent", weight: 0.8 },
    explanation: "Paracetamol overdose history with delayed hepatic signs",
  },
  {
    id: "fc3_upper_dvt",
    cluster: "context_dependent",
    derived_from: ["adv-024"],
    trigger: (ctx, sym) =>
      has(sym, "arm swelling", "arm pain") &&
      hasHistory(ctx, "central line", "catheter", "cancer", "line"),
    activate: { node: "context_dependent", weight: 0.7 },
    explanation: "Arm swelling with central line/cancer history",
  },

  // ── CLUSTER 4: Hemodynamic Instability ──
  {
    id: "fc4_ruptured_aaa",
    cluster: "hemodynamic_instability",
    derived_from: ["adv-005"],
    trigger: (ctx, sym) =>
      has(sym, "back pain", "syncope", "abdominal pain", "near syncope") &&
      bpSystolicBelow(ctx, 95) &&
      (hasHistory(ctx, "aaa", "aneurysm") || ageInRange(ctx, 60, 120)),
    activate: { node: "hemodynamic_instability", weight: 0.8 },
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
    activate: { node: "hemodynamic_instability", weight: 0.7 },
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
    activate: { node: "hemodynamic_instability", weight: 0.8 },
    explanation: "Reproductive-age female with acute abdomen and shock",
  },
  {
    id: "fc4_adrenal_crisis",
    cluster: "hemodynamic_instability",
    derived_from: ["noisy-037"],
    trigger: (ctx, sym) =>
      has(sym, "collapse", "hypotension", "hyperpigmentation", "fatigue") &&
      (hasHistory(ctx, "steroid", "autoimmune", "addison") || hasMed(ctx, "prednis", "hydrocortisone", "dexameth")),
    activate: { node: "hemodynamic_instability", weight: 0.8 },
    explanation: "Hemodynamic collapse in patient on/recently stopped steroids",
  },

  // ── CLUSTER 5: Atypical Neuro ──
  {
    id: "fc5_posterior_stroke",
    cluster: "atypical_neuro",
    derived_from: ["adv-007"],
    trigger: (ctx, sym) =>
      has(sym, "vertigo", "ataxia", "spinning") &&
      has(sym, "dysarthria", "nystagmus", "vomiting") &&
      (hasHistory(ctx, "hypertension", "diabetes") || ageInRange(ctx, 55, 120)),
    activate: { node: "atypical_neuro", weight: 0.7 },
    explanation: "Vertigo with cerebellar signs and vascular risk factors",
  },
  {
    id: "fc5_epidural_hematoma",
    cluster: "atypical_neuro",
    derived_from: ["adv-008"],
    trigger: (ctx, sym) =>
      has(sym, "headache", "drowsiness", "drowsy", "vomiting") &&
      (hasHistory(ctx, "head trauma", "head injury", "trauma") || has(sym, "pupil dilation", "hemiparesis")),
    activate: { node: "atypical_neuro", weight: 0.7 },
    explanation: "Head trauma followed by lucid interval then deterioration",
  },
  {
    id: "fc5_ncse",
    cluster: "atypical_neuro",
    derived_from: ["adv-009"],
    trigger: (ctx, sym) =>
      has(sym, "altered consciousness", "automatisms", "unresponsive", "confusion") &&
      hasHistory(ctx, "epilepsy", "seizure"),
    activate: { node: "atypical_neuro", weight: 0.7 },
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
    activate: { node: "atypical_neuro", weight: 0.6 },
    explanation: "Progressive headache with visual symptoms in young obese female",
  },

  // ── CLUSTER 6: Pediatric/Surgical ──
  {
    id: "fc6_strangulated_hernia",
    cluster: "pediatric_surgical",
    derived_from: ["adv-027"],
    trigger: (ctx, sym) =>
      has(sym, "groin lump", "irreducible", "hernia") &&
      has(sym, "vomiting", "constipation", "distension"),
    activate: { node: "pediatric_surgical", weight: 0.8 },
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
    activate: { node: "pediatric_surgical", weight: 0.7 },
    explanation: "Projectile vomiting with post-feed hunger in neonate",
  },
  {
    id: "fc6_intussusception",
    cluster: "pediatric_surgical",
    derived_from: ["ambig-034"],
    trigger: (ctx, sym) =>
      has(sym, "colicky", "intermittent", "red jelly", "redcurrant", "bloody stool") &&
      ageInRange(ctx, 0, 3),
    activate: { node: "pediatric_surgical", weight: 0.7 },
    explanation: "Colicky pain with red-currant jelly stool in infant",
  },
  {
    id: "fc6_compartment_syndrome",
    cluster: "pediatric_surgical",
    derived_from: ["noisy-050"],
    trigger: (ctx, sym) =>
      has(sym, "increasing pain", "pain with passive stretch", "tense swelling", "numbness") &&
      hasHistory(ctx, "fracture", "cast", "trauma"),
    activate: { node: "pediatric_surgical", weight: 0.7 },
    explanation: "Post-fracture/cast pain out of proportion with neurovascular compromise",
  },

  // ── CLUSTER 7: Chronic/Subacute ──
  {
    id: "fc7_endocarditis",
    cluster: "chronic_subacute",
    derived_from: ["noisy-021"],
    trigger: (ctx, sym) =>
      has(sym, "intermittent fever", "fever") &&
      has(sym, "murmur", "arthralgia", "night sweats") &&
      (hasHistory(ctx, "dental", "valve", "mitral", "prosthetic") || has(sym, "splinter", "janeway", "osler")),
    activate: { node: "atypical_cardiac", weight: 0.7 },
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
    activate: { node: "chronic_subacute", weight: 0.6 },
    explanation: "Food fear with weight loss in patient with vascular disease",
  },

  // ── CLUSTER 8: Toxicological ──
  {
    id: "fc8_co_poisoning",
    cluster: "toxicological",
    derived_from: ["adv-018"],
    trigger: (ctx, sym) =>
      has(sym, "headache", "nausea", "dizziness") &&
      (has(sym, "worse indoors", "better outside", "multiple family") || hasHistory(ctx, "gas heater", "winter", "old heater")),
    activate: { node: "toxicological", weight: 0.8 },
    explanation: "Multiple household members with headache improving outdoors",
  },
  {
    id: "fc8_organophosphate",
    cluster: "toxicological",
    derived_from: ["adv-019"],
    trigger: (ctx, sym) =>
      has(sym, "salivation", "lacrimation", "miosis", "bradycardia", "wheezing") &&
      (hasHistory(ctx, "farm", "pesticide") || has(sym, "diaphoresis", "diarrhea")),
    activate: { node: "toxicological", weight: 0.8 },
    explanation: "Cholinergic excess syndrome with agricultural exposure",
  },
];

// ═══════════════════════════════════════════════════════
// Phase 5.3 — Must-Not-Miss Safety Layer (KG-Native)
// ═══════════════════════════════════════════════════════

interface MustNotMissRule {
  id: string;
  /** Cluster node to activate */
  activateNode: string;
  trigger: (ctx: ClinicalContext, symptoms: Set<string>) => boolean;
  weight: number;
  explanation: string;
}

const MUST_NOT_MISS_RULES: MustNotMissRule[] = [
  {
    id: "mnm_pe",
    activateNode: "respiratory",
    trigger: (ctx, sym) =>
      has(sym, "dyspnea", "breathless", "pleuritic") &&
      (vitalAbove(ctx, "pulse", 100) || vitalBelow(ctx, "oxygen_saturation", 95)) &&
      !has(sym, "wheez") &&
      (hasHistory(ctx, "surgery", "immobil", "contraceptive", "dvt", "cancer") || has(sym, "leg swelling", "calf pain")),
    weight: 0.6,
    explanation: "Unexplained dyspnea + tachycardia + VTE risk factors",
  },
  {
    id: "mnm_mi",
    activateNode: "atypical_cardiac",
    trigger: (ctx, sym) =>
      (has(sym, "diaphoresis", "chest pain", "chest pressure", "epigastric") || has(sym, "jaw pain", "arm pain")) &&
      (vitalAbove(ctx, "pulse", 100) || bpSystolicAbove(ctx, 160) || bpSystolicBelow(ctx, 90)) &&
      (hasHistory(ctx, "diabetes", "hypertension", "smoking", "cardiac") || ageInRange(ctx, 45, 120)),
    weight: 0.6,
    explanation: "Chest/arm/jaw symptoms + hemodynamic change + cardiac risk factors",
  },
  {
    id: "mnm_stroke",
    activateNode: "atypical_neuro",
    trigger: (ctx, sym) =>
      (has(sym, "weakness", "facial droop", "slurred speech", "hemiparesis", "visual field deficit") ||
       (has(sym, "confusion") && has(sym, "acute"))) &&
      (hasHistory(ctx, "hypertension", "atrial fibrillation", "diabetes") || ageInRange(ctx, 55, 120)),
    weight: 0.7,
    explanation: "Focal neurological deficit + vascular risk factors",
  },
  {
    id: "mnm_sepsis",
    activateNode: "sepsis",
    trigger: (ctx, sym) =>
      (vitalAbove(ctx, "temperature", 38.5) || vitalBelow(ctx, "temperature", 36.0)) &&
      (vitalAbove(ctx, "pulse", 100) || bpSystolicBelow(ctx, 100)) &&
      has(sym, "confusion", "tachycardia", "fever", "hypothermia", "mottled"),
    weight: 0.7,
    explanation: "Temperature derangement + hemodynamic compromise + altered mentation",
  },
  {
    id: "mnm_aortic_dissection",
    activateNode: "vascular",
    trigger: (ctx, sym) =>
      has(sym, "tearing", "sudden", "inter-scapular", "back pain") &&
      (has(sym, "sharp", "sudden onset") || bpSystolicAbove(ctx, 170)) &&
      (hasHistory(ctx, "marfan", "hypertension", "connective tissue") || ageInRange(ctx, 40, 120)),
    weight: 0.7,
    explanation: "Sudden tearing pain + hypertension/connective tissue risk",
  },
];

const MAX_MNM_ACTIVATIONS = 3;

// ═══════════════════════════════════════════════════════
// Main Execution Function
// ═══════════════════════════════════════════════════════

/**
 * Apply failure-derived rules and must-not-miss safety rules.
 * Returns KG cluster activations (NOT diagnosis candidates).
 */
export function applyFailureDerivedRules(ctx: ClinicalContext): FailureRuleResult {
  const rawSymptoms: string[] = [];
  if (ctx.chief_complaint) rawSymptoms.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) rawSymptoms.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) rawSymptoms.push(...ctx.associated_symptoms);

  const symptomSet = new Set(rawSymptoms.map(s => s.toLowerCase().trim()));
  const activation = createEmptyActivation();
  const rulesFired: string[] = [];
  let failureCount = 0;

  // 1. Apply failure-derived rules (cluster activation)
  for (const rule of FAILURE_RULES) {
    if (failureCount >= MAX_FAILURE_ACTIVATIONS) break;

    try {
      if (rule.trigger(ctx, symptomSet)) {
        rulesFired.push(rule.id);
        activateNode(activation, rule.activate.node, rule.activate.weight, rule.id, "failure_derived");
        failureCount++;
      }
    } catch (e) {
      console.warn(`[FailureRules] Rule ${rule.id} threw:`, e);
    }
  }

  // 2. Apply must-not-miss safety rules (cluster activation with MNM flag)
  let mnmCount = 0;
  for (const rule of MUST_NOT_MISS_RULES) {
    if (mnmCount >= MAX_MNM_ACTIVATIONS) break;

    try {
      if (rule.trigger(ctx, symptomSet)) {
        activateNode(activation, rule.activateNode, rule.weight, rule.id, "must_not_miss", true);
        rulesFired.push(rule.id);
        mnmCount++;
      }
    } catch (e) {
      console.warn(`[MustNotMiss] Rule ${rule.id} threw:`, e);
    }
  }

  if (rulesFired.length > 0) {
    console.log(
      `[FailureDerivedRules] Fired ${rulesFired.length} rules, activated ${activation.nodes.size} clusters. ` +
      `Rules: [${rulesFired.join(", ")}]`
    );
  }

  return {
    activation,
    rules_fired: rulesFired,
    total_activations: activation.nodes.size,
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
